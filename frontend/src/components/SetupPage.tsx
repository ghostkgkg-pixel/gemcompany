import { useState, useEffect } from 'react';
import axios from 'axios';
import { spawnAgent, hireAgent, saveMap } from '../services/api';
import { useGameStore } from '../store/useGameStore';
import { Play, Map as MapIcon, Users, Hammer, X, Eraser, RotateCw, FlipHorizontal, Plus, Building, Save } from 'lucide-react';
import { GameCanvas } from './GameCanvas';

interface SetupPageProps {
  onStart: () => void;
}

const CharacterPreview = ({ form }: { form: any }) => {
  const skinColors: any = { body_light: '#FFE0BD', body_tan: '#E0AC69', body_dark: '#8D5524' };
  const outfitImages: any = {
    agent_dev: 'assets/agent_dev.png',
    agent_design: 'assets/agent_design.png',
    agent_manage: 'assets/agent_manage.png',
    agent_market: 'assets/agent_market.png'
  };

  return (
    <div className="relative w-48 h-48 bg-blue-50 border-4 border-black mx-auto mb-4 flex items-center justify-center shadow-inner group">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:10px_10px]" />
      
      <div className="relative w-32 h-32 flex items-center justify-center scale-150">
        {/* Base Body (Circle for head/chest) - Shape could change by gender in future */}
        <div 
          className={`absolute w-12 h-14 border-2 border-black z-0 shadow-sm ${form.gender === 'female' ? 'rounded-3xl' : 'rounded-full'}`} 
          style={{ backgroundColor: skinColors[form.body] }}
        />
        
        {/* Outfit Asset Overlay */}
        <img 
          src={outfitImages[form.outfit]} 
          className="absolute w-20 h-20 object-contain pixelated z-10" 
          alt="outfit"
        />
        
        {/* Procedural Hair Style Overlay */}
        {form.hair_style !== 'none' && (
          <div className="absolute top-[18px] z-20 flex flex-col items-center">
            {form.hair_style === 'hair_short' && (
              <div className="w-10 h-5 border-2 border-black rounded-t-lg" style={{ backgroundColor: form.hair_color }} />
            )}
            {form.hair_style === 'hair_long' && (
              <div className="relative">
                <div className="w-10 h-5 border-2 border-black rounded-t-lg" style={{ backgroundColor: form.hair_color }} />
                <div className="absolute top-0 -left-1 w-3 h-10 border-2 border-black rounded-b-md" style={{ backgroundColor: form.hair_color }} />
                <div className="absolute top-0 -right-1 w-3 h-10 border-2 border-black rounded-b-md" style={{ backgroundColor: form.hair_color }} />
              </div>
            )}
            {form.hair_style === 'hair_spiky' && (
              <div className="flex gap-1 -mt-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-3 h-5 border-2 border-black origin-bottom rotate-12" style={{ backgroundColor: form.hair_color, transform: `rotate(${(i-2)*25}deg)` }} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="absolute bottom-2 right-2 bg-black text-white text-[8px] px-1 font-bold italic uppercase">{form.gender}</div>
    </div>
  );
};

export function SetupPage({ onStart }: SetupPageProps) {
  const [spawnDesc, setSpawnDesc] = useState('');
  const [isSpawning, setIsSpawning] = useState(false);
  const [templates, setTemplates] = useState<any>(null);
  
  const [isEditingMap, setIsEditingMap] = useState(false);
  const [isHiringModalOpen, setIsHiringModalOpen] = useState(false);
  
  // Hiring Form State
  const [hiringForm, setHiringForm] = useState({
    name: '',
    job: '',
    persona: '',
    body: 'body_light',
    hair_style: 'hair_short',
    hair_color: '#4B2C20',
    outfit: 'agent_dev',
    gender: 'male'
  });

  const [isSavingMap, setIsSavingMap] = useState(false);
  const [mapName, setMapName] = useState('');
  
  const currentMap = useGameStore((state) => state.currentMap);
  const agentsObj = useGameStore((state) => state.agents);
  const buildMode = useGameStore((state: any) => state.buildMode);
  const toggleBuildMode = useGameStore((state: any) => state.toggleBuildMode);
  const selectedTool = useGameStore((state: any) => state.selectedTool);
  const setSelectedTool = useGameStore((state: any) => state.setSelectedTool);
  const selectedRotation = useGameStore((state: any) => state.selectedRotation);
  const setRotation = useGameStore((state: any) => state.setRotation);
  const selectedFlipX = useGameStore((state: any) => state.selectedFlipX);
  const toggleFlipX = useGameStore((state: any) => state.toggleFlipX);
  const agents = Object.values(agentsObj || {});

  // Keyboard Shortcuts for Map Editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditingMap) return;
      if (e.key.toLowerCase() === 'r') {
        setRotation((selectedRotation + 90) % 360);
      }
      if (e.key.toLowerCase() === 'f') {
        toggleFlipX();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditingMap, selectedRotation, setRotation, toggleFlipX]);

  const fetchTemplates = async () => {
    try {
      const t = await axios.get('http://localhost:8000/map/templates');
      console.log("Loaded Templates:", t.data);
      setTemplates(t.data);
      
      // Always refresh current map when entering lobby to ensure sync
      const m = await axios.get('http://localhost:8000/map/current');
      useGameStore.getState().setMap(m.data);

      // Fetch existing agents for persistence
      const a = await axios.get('http://localhost:8000/agents');
      useGameStore.getState().setAgents(a.data);
    } catch (err) {
      console.error("Failed to load map templates", err);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSpawn = async () => {
    if (!spawnDesc.trim()) return;
    setIsSpawning(true);
    try {
      await spawnAgent(spawnDesc);
      setSpawnDesc('');
    } catch (error) {
      console.error("Failed to spawn agent:", error);
    } finally {
      setIsSpawning(false);
    }
  };

  const handleHire = async () => {
    if (!hiringForm.name || !hiringForm.job) return;
    setIsSpawning(true);
    try {
      await hireAgent(hiringForm);
      setIsHiringModalOpen(false);
      setHiringForm({
        name: '', job: '', persona: '',
        body: 'body_light', hair_style: 'hair_short', hair_color: '#4B2C20', outfit: 'agent_dev', gender: 'male'
      });
    } catch (error) {
      console.error("Failed to hire agent:", error);
    } finally {
      setIsSpawning(false);
    }
  };

  const handleSelectTemplate = async (id: string) => {
    try {
      const response = await axios.post(`http://localhost:8000/map/select/${id}`);
      // Explicitly update store to ensure UI reflects change immediately
      useGameStore.getState().setMap(response.data.map);
    } catch (error) {
      console.error("Failed to change map:", error);
    }
  };

  const handleSaveMap = async () => {
    if (!mapName.trim()) return;
    try {
      await saveMap(mapName);
      setIsSavingMap(false);
      setMapName('');
      await fetchTemplates();
    } catch (err) {
      console.error("Failed to save map:", err);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#86efac] flex flex-col items-center pt-4 pb-24 font-['NeoDunggeunmo'] text-black p-4">
      
      {/* Title */}
      <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-4 mb-8 w-full max-w-6xl">
          <Building size={48} className="text-blue-500" />
          <div className="flex flex-col">
            <h1 className="text-5xl font-black text-black tracking-tight leading-none uppercase italic">AI 회사 본부</h1>
            <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-widest">오피스 관리 대시보드 v1.4</p>
          </div>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        
        {/* Column 1: Map Selection */}
        <section className="bg-white p-6 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col h-[650px]">
          <h2 className="text-2xl font-black border-b-4 border-black pb-3 mb-4 flex items-center gap-2 italic uppercase tracking-tighter">
            <MapIcon className="text-blue-500" /> 01. 사무실 설정
          </h2>
          
          <div className="flex flex-col gap-4 h-full">
            <button 
              onClick={() => { setIsEditingMap(true); if(!buildMode) toggleBuildMode(); }}
              className="w-full py-4 border-2 border-black bg-yellow-400 hover:bg-yellow-500 font-black text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none mb-2 flex items-center justify-center gap-2 flex-shrink-0 uppercase"
            >
              <Hammer size={20} /> 맵 편집기 열기
            </button>
            
            <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar border-t-2 border-black/5 pt-4">
              <div className="text-[10px] font-black mb-1 text-blue-600 uppercase tracking-widest">기본 템플릿</div>
              {!templates ? (
                <div className="flex flex-col gap-2">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="h-14 bg-gray-50 border-2 border-dashed border-gray-200 animate-pulse flex-shrink-0" />
                  ))}
                </div>
              ) : (
                <>
                  {templates.defaults && Object.entries(templates.defaults).map(([id, t]: [string, any], index) => (
                    <button 
                      key={id}
                      onClick={() => handleSelectTemplate(id)}
                      className={`text-left px-4 py-3 border-4 border-black font-bold text-sm transition-all flex-shrink-0 my-1 mx-1 hover:scale-[1.02] active:scale-95 ${
                        currentMap?.id === id 
                          ? '-translate-y-1 z-10 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white' 
                          : 'bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}

                  {templates.saved && Object.keys(templates.saved).length > 0 && (
                    <>
                      <div className="text-[10px] font-black mt-6 mb-1 text-purple-600 uppercase tracking-widest border-t-2 border-purple-50 pt-4">저장된 커스텀 맵</div>
                      {Object.entries(templates.saved).map(([id, t]: [string, any], index) => (
                        <button 
                          key={id}
                          onClick={() => handleSelectTemplate(id)}
                          className={`text-left px-4 py-3 border-4 border-black font-bold text-sm transition-all flex-shrink-0 my-1 mx-1 hover:scale-[1.02] active:scale-95 ${
                            currentMap?.id === id 
                              ? '-translate-y-1 z-10 shadow-[8px_8px_0px_0px_rgba(168,85,247,0.5)] border-purple-500 bg-white' 
                              : 'bg-white border-purple-200 shadow-[2px_2px_0px_0px_rgba(168,85,247,0.1)]'
                          }`}
                        >
                          {t.name}
                        </button>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        {/* Column 2: Staff Management */}
        <section className="bg-white p-6 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col h-[650px]">
          <h2 className="text-2xl font-black border-b-4 border-black pb-3 mb-4 flex items-center gap-2 italic uppercase tracking-tighter">
            <Users className="text-green-500" /> 02. 직원 관리
          </h2>

          <button 
            onClick={() => setIsHiringModalOpen(true)}
            className="w-full py-4 border-2 border-black bg-[#4ade80] hover:bg-[#22c55e] font-black text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none mb-6 flex items-center justify-center gap-2 flex-shrink-0 uppercase"
          >
            <Plus size={24} /> 신규 직원 채용하기
          </button>

          <div className="text-[10px] font-black mb-2 text-gray-500 uppercase tracking-widest">현재 대기열 ({agents.length}명)</div>
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-2">
            {agents.map((agent: any) => (
              <div key={agent?.id} className="border-2 border-black p-3 bg-gray-50 flex items-center gap-3 group hover:bg-blue-50 transition-all hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] my-1">
                <div className="w-10 h-10 bg-white border-2 border-black flex items-center justify-center overflow-hidden">
                   <div className="w-6 h-6 rounded-full" style={{ backgroundColor: agent?.appearance?.hair_color || '#444' }} />
                </div>
                <div className="flex flex-col flex-1">
                  <div className="font-black text-sm uppercase leading-none">{agent?.name}</div>
                  <div className="text-[10px] font-bold text-blue-600 uppercase mt-1">
                    {agent?.persona?.Job || agent?.persona?.Role || '직원'}
                  </div>
                </div>
              </div>
            ))}
            {agents.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 text-gray-400 font-bold p-10 text-center">
                <Users size={48} className="mb-2 opacity-20" />
                채용된 직원이 없습니다.
              </div>
            )}
          </div>
        </section>

        {/* Column 3: Operations */}
        <div className="flex flex-col gap-6 h-[650px]">
          {/* AI Spawner Mini Section */}
          <section className="bg-[#fde047] p-6 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-xl font-black border-b-4 border-black pb-2 mb-4 flex items-center gap-2 uppercase tracking-tighter italic">
              03. 즉시 AI 소환
            </h2>
            <div className="flex flex-col gap-3">
              <input 
                type="text" 
                value={spawnDesc}
                onChange={(e) => setSpawnDesc(e.target.value)}
                placeholder="직원 설명을 입력하세요 (예: 디자이너)"
                className="w-full p-3 border-2 border-black font-bold text-sm focus:outline-none focus:bg-white"
              />
              <button 
                onClick={handleSpawn}
                disabled={isSpawning}
                className="w-full bg-black text-white py-3 font-black uppercase hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
              >
                {isSpawning ? '소환 중...' : '즉시 소환'}
              </button>
            </div>
          </section>

          {/* Status & Action */}
          <section className="bg-white p-6 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex-1 flex flex-col justify-between overflow-hidden">
             <div>
                <h2 className="text-xl font-black border-b-4 border-black pb-2 mb-4 uppercase tracking-tighter italic">
                  04. 상태 요약
                </h2>
                <div className="space-y-2">
                  <div className="flex justify-between font-bold text-xs uppercase">
                    <span>선택된 맵</span>
                    <span className="text-blue-600 truncate ml-2" title={currentMap?.name}>{currentMap?.name || '없음'}</span>
                  </div>
                  <div className="flex justify-between font-bold text-xs uppercase">
                    <span>총 직원</span>
                    <span className="text-green-600">{agents.length} 명</span>
                  </div>
                </div>
             </div>

             <div className="mt-8 flex flex-col gap-3">
                <button 
                  onClick={onStart}
                  className="group relative w-full h-32 bg-[#f87171] hover:bg-[#ef4444] border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none transition-all flex flex-col items-center justify-center gap-1"
                >
                  <Play size={40} className="text-white group-hover:scale-110 transition-transform" />
                  <span className="text-white font-black text-3xl uppercase tracking-tighter italic">출근하기!</span>
                </button>
                <p className="text-[9px] font-bold text-center text-gray-400 uppercase tracking-widest italic animate-pulse">
                  가상 오피스로 출근할 준비가 되었나요?
                </p>
             </div>
          </section>
        </div>

      </div>
      {/* Map Editor Overlay */}
      {isEditingMap && (
        <div className="fixed inset-0 z-50 bg-[#86efac] flex flex-col p-4 animate-in fade-in duration-300">
          <div className="bg-white border-4 border-black p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-4 flex justify-between items-center">
            <h2 className="text-3xl font-bold flex items-center gap-2">
              <Hammer /> 오피스 맵 편집기
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  const { selectedRotation, setRotation } = useGameStore.getState();
                  setRotation((selectedRotation + 90) % 360);
                }}
                className="bg-purple-400 border-2 border-black p-2 hover:bg-purple-500 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none text-white font-bold flex items-center gap-1"
                title="회전 (R)"
              >
                <RotateCw size={24} /> 회전
              </button>
              <button 
                onClick={() => {
                  const { toggleFlipX } = useGameStore.getState();
                  toggleFlipX();
                }}
                className="bg-indigo-400 border-2 border-black p-2 hover:bg-indigo-500 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none text-white font-bold flex items-center gap-1"
                title="반전 (F)"
              >
                <FlipHorizontal size={24} /> 반전
              </button>
              <button 
                onClick={() => { setIsEditingMap(false); if(buildMode) toggleBuildMode(); }}
                className="bg-red-400 border-2 border-black p-2 hover:bg-red-500 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none text-white"
              >
                <X size={32} />
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex gap-4 overflow-hidden">
            {/* Editor Sidebar */}
            <aside className="w-64 bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
              <h3 className="font-bold border-b-2 border-black pb-2 flex items-center gap-2 uppercase tracking-tighter">
                바닥(구역) 타일링
              </h3>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { id: 'zone_work', name: '업무 구역', color: 'bg-gray-100' },
                  { id: 'zone_meeting', name: '회의실 구역', color: 'bg-blue-100' },
                  { id: 'zone_break', name: '휴게 구역', color: 'bg-green-100' },
                ].map((item, index) => (
                  <button 
                    key={item.id}
                    onClick={() => setSelectedTool(item.id)}
                    className={`p-2 border-4 border-black flex flex-col items-center gap-1 transition-all hover:scale-[1.02] active:scale-95 ${
                      selectedTool === item.id ? '-translate-y-1 z-10 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : 'opacity-80'
                    } ${item.color}`}
                  >
                    <div className="w-8 h-8 border border-black shadow-inner" />
                    <span className="text-[9px] font-bold">{item.name}</span>
                  </button>
                ))}
              </div>

              <h3 className="font-bold border-b-2 border-black pb-2 flex items-center gap-2 uppercase tracking-tighter mt-4">
                가구 및 오브젝트
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'obstacle_desk', name: '책상 A', img: 'assets/obstacle_desk.png' },
                  { id: 'obstacle_desk_2', name: '책상 B', img: 'assets/obstacle_desk.png' },
                  { id: 'obstacle_desk_3', name: '책상 C', img: 'assets/obstacle_desk.png' },
                  { id: 'obstacle_table', name: '테이블 A', img: 'assets/obstacle_table.png' },
                  { id: 'obstacle_table_2', name: '테이블 B', img: 'assets/obstacle_table.png' },
                  { id: 'obstacle_table_3', name: '테이블 C', img: 'assets/obstacle_table.png' },
                  { id: 'obstacle_plant', name: '화분 A', img: 'assets/obstacle_plant.png' },
                  { id: 'obstacle_plant_2', name: '화분 B', img: 'assets/obstacle_plant.png' },
                  { id: 'obstacle_plant_3', name: '화분 C', img: 'assets/obstacle_plant.png' },
                  { id: 'obstacle_wall', name: '벽 (구분선)', img: '' },
                ].map((item, index) => (
                  <button 
                    key={item.id}
                    onClick={() => setSelectedTool(item.id)}
                    className={`p-3 border-4 border-black flex flex-col items-center gap-2 transition-all hover:scale-[1.02] active:scale-95 bg-white ${
                      selectedTool === item.id ? '-translate-y-2 z-10 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]' : 'opacity-80'
                    }`}
                  >
                    {item.img ? (
                      <img src={item.img} alt={item.name} className="w-12 h-12 object-contain pixelated" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-800 border-2 border-black" />
                    )}
                    <span className="text-[10px] font-bold">{item.name}</span>
                  </button>
                ))}
              </div>
                
                <button 
                  onClick={() => setSelectedTool('eraser')}
                  className={`p-3 border-2 border-black flex flex-col items-center gap-2 transition-all ${
                    selectedTool === 'eraser' ? 'bg-red-100 ring-2 ring-red-500' : 'bg-gray-50'
                  }`}
                >
                  <div className="w-12 h-12 flex items-center justify-center text-red-500">
                    <Eraser size={32} />
                  </div>
                  <span className="text-xs font-bold text-red-600">지우개 (철거)</span>
                </button>
              
                <button 
                  onClick={() => setIsSavingMap(true)}
                  className="w-full py-4 border-2 border-black bg-blue-500 hover:bg-blue-600 text-white font-bold text-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none mt-4 flex items-center justify-center gap-2"
                >
                  <Save /> 현재 맵 저장하기
                </button>

                <div className="mt-auto bg-blue-50 p-3 border-2 border-black text-[10px] leading-tight font-bold">
                  * 맵 위를 클릭하면 가구가 배치됩니다.<br/>
                  * 지우개로 기존 가구를 지울 수 있습니다.
                </div>
            </aside>
            
            {/* Editor Canvas */}
            <main className="flex-1 bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
               <GameCanvas />
            </main>
          </div>
        </div>
      )}

      {/* HIRING MODAL */}
      {isHiringModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000] p-4 backdrop-blur-sm">
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b-4 border-black pb-4">
              <h2 className="text-3xl font-black italic uppercase tracking-tighter text-blue-600">신규 직원 채용</h2>
              <button onClick={() => setIsHiringModalOpen(false)} className="hover:rotate-90 transition-transform"><X size={32} /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Info */}
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block font-black text-xs uppercase mb-1">직원 성함</label>
                  <input 
                    type="text" 
                    value={hiringForm.name}
                    onChange={e => setHiringForm({...hiringForm, name: e.target.value})}
                    placeholder="홍길동"
                    className="w-full p-3 border-2 border-black font-bold focus:bg-yellow-50"
                  />
                </div>
                <div>
                  <label className="block font-black text-xs uppercase mb-1">직책 / 역할</label>
                  <input 
                    type="text" 
                    value={hiringForm.job}
                    onChange={e => setHiringForm({...hiringForm, job: e.target.value})}
                    placeholder="프로덕트 디자이너"
                    className="w-full p-3 border-2 border-black font-bold focus:bg-yellow-50"
                  />
                </div>
                <div>
                  <label className="block font-black text-xs uppercase mb-1">페르소나 / 성격</label>
                  <textarea 
                    rows={4}
                    value={hiringForm.persona}
                    onChange={e => setHiringForm({...hiringForm, persona: e.target.value})}
                    placeholder="열정적이고 창의적이며 커피를 좋아하는..."
                    className="w-full p-3 border-2 border-black font-bold focus:bg-yellow-50 resize-none"
                  />
                </div>
              </div>

              {/* Right Column: Visuals */}
              <div className="flex flex-col gap-4">
                <CharacterPreview form={hiringForm} />

                <div>
                  <label className="block font-black text-xs uppercase mb-2 text-red-600">성별 / 체형</label>
                  <div className="flex gap-2">
                    {[
                      { id: 'male', name: '남성' },
                      { id: 'female', name: '여성' }
                    ].map(g => (
                      <button 
                        key={g.id}
                        onClick={() => setHiringForm({...hiringForm, gender: g.id})}
                        className={`flex-1 py-2 border-2 border-black font-bold transition-all ${hiringForm.gender === g.id ? 'bg-red-100 ring-2 ring-red-500' : 'bg-white'}`}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block font-black text-xs uppercase mb-2 text-blue-600">피부색</label>
                  <div className="flex gap-2">
                    {[
                      { id: 'body_light', color: '#FFE0BD' },
                      { id: 'body_tan', color: '#E0AC69' },
                      { id: 'body_dark', color: '#8D5524' }
                    ].map(t => (
                      <button 
                        key={t.id}
                        onClick={() => setHiringForm({...hiringForm, body: t.id})}
                        className={`w-10 h-10 border-2 border-black transition-all ${hiringForm.body === t.id ? 'ring-2 ring-blue-500 scale-110' : ''}`}
                        style={{ backgroundColor: t.color }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-black text-xs uppercase mb-2 text-purple-600">헤어 스타일</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'hair_short', name: '숏컷' },
                      { id: 'hair_long', name: '장발' },
                      { id: 'hair_spiky', name: '스파이키' },
                      { id: 'none', name: '없음' }
                    ].map(s => (
                      <button 
                        key={s.id}
                        onClick={() => setHiringForm({...hiringForm, hair_style: s.id})}
                        className={`p-2 border-2 border-black text-[10px] font-bold transition-all ${hiringForm.hair_style === s.id ? 'bg-purple-100 ring-2 ring-purple-500' : 'bg-white'}`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-black text-xs uppercase mb-2 text-amber-600">머리카락 색상</label>
                  <div className="flex flex-wrap gap-2">
                    {['#000000', '#4B2C20', '#D4AF37', '#FFFFFF', '#FF0000', '#0000FF'].map(c => (
                      <button 
                        key={c}
                        onClick={() => setHiringForm({...hiringForm, hair_color: c})}
                        className={`w-8 h-8 border-2 border-black transition-all ${hiringForm.hair_color === c ? 'ring-2 ring-amber-500 scale-110' : ''}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-black text-xs uppercase mb-2 text-gray-600">작업 복장</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'agent_dev', name: '개발자' },
                      { id: 'agent_design', name: '디자이너' },
                      { id: 'agent_manage', name: '매니저' },
                      { id: 'agent_market', name: '마케터' }
                    ].map(o => (
                      <button 
                        key={o.id}
                        onClick={() => setHiringForm({...hiringForm, outfit: o.id})}
                        className={`p-2 border-2 border-black text-[10px] font-bold transition-all ${hiringForm.outfit === o.id ? 'bg-gray-200 ring-2 ring-black' : 'bg-white'}`}
                      >
                        {o.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={handleHire}
              disabled={isSpawning || !hiringForm.name || !hiringForm.job}
              className="w-full py-5 bg-black text-white text-2xl font-black uppercase tracking-widest hover:bg-gray-800 disabled:bg-gray-400 shadow-[4px_4px_0px_0px_rgba(50,50,50,1)] active:translate-y-1 active:shadow-none transition-all mt-4"
            >
              {isSpawning ? '채용 중...' : '채용 확정'}
            </button>
          </div>
        </div>
      )}
      {/* SAVE MAP MODAL */}
      {isSavingMap && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[3000] p-4 backdrop-blur-md">
          <div className="bg-white border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] w-full max-w-md p-8 flex flex-col gap-6 animate-in slide-in-from-bottom-8 duration-300">
            <h2 className="text-3xl font-black italic uppercase tracking-tighter border-b-4 border-black pb-4 text-purple-600">
              사무실 맵 저장
            </h2>
            
            <div>
              <label className="block font-black text-xs uppercase mb-2">맵 이름</label>
              <input 
                type="text" 
                value={mapName}
                onChange={e => setMapName(e.target.value)}
                placeholder="나만의 멋진 오피스..."
                autoFocus
                className="w-full p-4 border-4 border-black font-bold text-xl focus:bg-blue-50 outline-none"
              />
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setIsSavingMap(false)}
                className="flex-1 py-4 border-4 border-black font-bold text-xl hover:bg-gray-100"
              >
                취소
              </button>
              <button 
                onClick={handleSaveMap}
                disabled={!mapName.trim()}
                className="flex-1 py-4 bg-black text-white font-bold text-xl hover:bg-gray-800 disabled:bg-gray-400"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

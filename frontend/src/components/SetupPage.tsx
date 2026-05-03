import { useState, useEffect } from 'react';
import axios from 'axios';
import { spawnAgent } from '../services/api';
import { useGameStore } from '../store/useGameStore';
import { Plus, Map as MapIcon, Users, Building, Play, Hammer, Eraser, X } from 'lucide-react';
import { GameCanvas } from './GameCanvas';

interface SetupPageProps {
  onStart: () => void;
}

export function SetupPage({ onStart }: SetupPageProps) {
  const [spawnDesc, setSpawnDesc] = useState('');
  const [isSpawning, setIsSpawning] = useState(false);
  const [templates, setTemplates] = useState<any>(null);
  
  const [isEditingMap, setIsEditingMap] = useState(false);
  
  const currentMap = useGameStore((state) => state.currentMap);
  const agentsObj = useGameStore((state) => state.agents);
  const buildMode = useGameStore((state: any) => state.buildMode);
  const toggleBuildMode = useGameStore((state: any) => state.toggleBuildMode);
  const selectedTool = useGameStore((state: any) => state.selectedTool);
  const setSelectedTool = useGameStore((state: any) => state.setSelectedTool);
  const agents = Object.values(agentsObj || {});

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const t = await axios.get('http://localhost:8000/map/templates');
        setTemplates(t.data);
      } catch (err) {
        console.error("Failed to load map templates", err);
      }
    };
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

  const handleSelectTemplate = async (id: string) => {
    try {
      await axios.post(`http://localhost:8000/map/select/${id}`);
    } catch (error) {
      console.error("Failed to change map:", error);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#86efac] flex flex-col items-center py-10 font-['NeoDunggeunmo'] text-black p-4">
      
      {/* Title */}
      <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-4 mb-8 w-full max-w-4xl">
          <Building size={48} className="text-blue-500" />
          <h1 className="text-5xl font-bold text-black tracking-wider">AI 회사 로비</h1>
      </div>

      <div className="w-full max-w-4xl flex gap-6 flex-col md:flex-row">
        
        {/* Left Column: Settings */}
        <div className="flex-1 flex flex-col gap-6">
          
          {/* Map Selection */}
          <section className="bg-white p-5 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-xl font-bold border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
              <MapIcon /> 1. 사무실(맵) 구조 선택
            </h2>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => { setIsEditingMap(true); if(!buildMode) toggleBuildMode(); }}
                className="w-full py-4 border-2 border-black bg-yellow-400 hover:bg-yellow-500 font-bold text-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none mb-2 flex items-center justify-center gap-2"
              >
                <Hammer /> 맵 편집기 열기 (가구 배치)
              </button>
              
              <div className="text-sm font-bold mb-2">기본 템플릿:</div>
              {templates ? (
                Object.entries(templates).map(([id, t]: [string, any]) => (
                  <button 
                    key={id}
                    onClick={() => handleSelectTemplate(id)}
                    className={`text-left px-4 py-3 border-2 border-black font-bold text-lg transition-all ${
                      currentMap?.name === t.name 
                        ? 'bg-[#4ade80] text-black shadow-inner translate-y-[2px] translate-x-[2px]' 
                        : 'bg-white hover:bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1'
                    }`}
                  >
                    {t.name}
                  </button>
                ))
              ) : (
                <div className="text-gray-500">맵 데이터를 불러오는 중...</div>
              )}
            </div>
          </section>

          {/* Spawn Agent */}
          <section className="bg-[#fde047] p-5 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-xl font-bold border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
              <Plus /> 2. 직원 채용 (소환)
            </h2>
            <textarea 
              value={spawnDesc}
              onChange={(e) => setSpawnDesc(e.target.value)}
              placeholder="예: 성실하고 꼼꼼한 마케팅 담당자, 항상 웃는 얼굴..."
              className="w-full bg-white border-2 border-black p-3 text-lg focus:outline-none focus:ring-0 h-32 resize-none text-black placeholder-gray-400 mb-3"
            />
            <button 
              onClick={handleSpawn}
              disabled={isSpawning || !spawnDesc.trim()}
              className="w-full bg-[#60a5fa] hover:bg-[#3b82f6] disabled:opacity-50 py-3 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none font-bold text-xl flex items-center justify-center gap-2 text-white"
            >
              {isSpawning ? <span className="animate-pulse">서류 심사 중...</span> : <span>채용하기!</span>}
            </button>
          </section>

        </div>

        {/* Right Column: Active Agents & Start Button */}
        <div className="w-80 flex flex-col gap-6">
          
          <section className="bg-white p-5 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex-1 flex flex-col">
            <h2 className="text-xl font-bold border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
              <Users /> 현재 대기열 ({agents.length}명)
            </h2>
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-2 h-64">
              {agents.map((agent: any) => (
                <div key={agent?.id} className="border-2 border-black p-3 bg-gray-50 flex flex-col">
                  <div className="font-bold text-lg text-blue-700">{agent?.name}</div>
                  <div className="text-sm bg-yellow-200 px-2 py-1 border border-black inline-block mt-1 w-max">
                    {agent?.persona?.Role || '직원'}
                  </div>
                </div>
              ))}
              {agents.length === 0 && (
                <div className="text-center text-gray-400 mt-10">채용된 직원이 없습니다.</div>
              )}
            </div>
          </section>

          <button 
            onClick={onStart}
            className="w-full bg-[#f87171] hover:bg-[#ef4444] py-6 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none font-bold text-3xl flex items-center justify-center gap-2 text-white"
          >
            <Play size={32} /> 출근하기!
          </button>

        </div>

      </div>
      {/* Map Editor Overlay */}
      {isEditingMap && (
        <div className="fixed inset-0 z-50 bg-[#86efac] flex flex-col p-4 animate-in fade-in duration-300">
          <div className="bg-white border-4 border-black p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-4 flex justify-between items-center">
            <h2 className="text-3xl font-bold flex items-center gap-2">
              <Hammer /> 오피스 맵 편집기
            </h2>
            <button 
              onClick={() => { setIsEditingMap(false); if(buildMode) toggleBuildMode(); }}
              className="bg-red-400 border-2 border-black p-2 hover:bg-red-500 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none text-white"
            >
              <X size={32} />
            </button>
          </div>
          
          <div className="flex-1 flex gap-4 overflow-hidden">
            {/* Editor Sidebar */}
            <aside className="w-64 bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-4 flex flex-col gap-4 overflow-y-auto">
              <h3 className="font-bold border-b-2 border-black pb-2 flex items-center gap-2 uppercase tracking-tighter">
                가구 선택
              </h3>
              
              <div className="grid grid-cols-1 gap-4">
                {[
                  { id: 'obstacle_desk', name: '업무용 책상', img: 'assets/obstacle_desk.png' },
                  { id: 'obstacle_table', name: '회의용 테이블', img: 'assets/obstacle_table.png' },
                  { id: 'obstacle_plant', name: '인테리어 화분', img: 'assets/obstacle_plant.png' },
                ].map(item => (
                  <button 
                    key={item.id}
                    onClick={() => setSelectedTool(item.id)}
                    className={`p-3 border-2 border-black flex flex-col items-center gap-2 transition-all ${
                      selectedTool === item.id ? 'bg-blue-100 ring-2 ring-blue-500' : 'bg-gray-50'
                    }`}
                  >
                    <img src={item.img} alt={item.name} className="w-12 h-12 object-contain pixelated" />
                    <span className="text-xs font-bold">{item.name}</span>
                  </button>
                ))}
                
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
              </div>
              
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
    </div>
  );
}

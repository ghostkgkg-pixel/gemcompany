import { useState, useEffect } from 'react';
import axios from 'axios';
import { spawnAgent } from '../services/api';
import { useGameStore } from '../store/useGameStore';
import { Plus, Map as MapIcon, Users, Building, Play } from 'lucide-react';

interface SetupPageProps {
  onStart: () => void;
}

export function SetupPage({ onStart }: SetupPageProps) {
  const [spawnDesc, setSpawnDesc] = useState('');
  const [isSpawning, setIsSpawning] = useState(false);
  const [templates, setTemplates] = useState<any>(null);
  
  const currentMap = useGameStore((state) => state.currentMap);
  const agentsObj = useGameStore((state) => state.agents);
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
                    {t.name} {currentMap?.name === t.name && '(현재 선택됨)'}
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
    </div>
  );
}

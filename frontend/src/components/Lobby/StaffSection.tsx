import { useState, useEffect } from 'react';
import { Users, Plus, Target, Zap, Shield, Brain } from 'lucide-react';
import { CyberPanel, CyberButton, CyberStatBar } from '../Common/CyberUI';

interface StaffSectionProps {
  agents: any[];
  setIsHiringModalOpen: (val: boolean) => void;
}

export const StaffSection = ({ agents, setIsHiringModalOpen }: StaffSectionProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Auto-select first agent when they are loaded
  useEffect(() => {
    if (!selectedId && agents.length > 0) {
      setSelectedId(agents[0].id);
    }
  }, [agents, selectedId]);

  const selectedAgent = agents.find(a => a.id === selectedId) || agents[0];

  return (
    <CyberPanel title="02. 에이전트 관리" idTag="AGENT-HQ" className="h-full text-[#00f2ff]">
      <div className="flex flex-col h-full gap-4">
        {/* Main Action Button */}
        <CyberButton 
          onClick={() => setIsHiringModalOpen(true)}
          className="w-full py-2.5"
        >
          <Plus size={20} /> 새 에이전트 영입
        </CyberButton>

        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* Left: Agent List */}
          <div className="w-1/3 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-2 border-r border-white/5">
             <div className="text-[9px] font-black mb-1.5 text-[#00f2ff]/40 uppercase tracking-widest">활성 로스터</div>
             {agents.map((agent) => (
               <button 
                 key={agent.id}
                 onClick={() => setSelectedId(agent.id)}
                 className={`flex items-center gap-2 p-2.5 transition-all rounded-lg border-2 ${selectedId === agent.id ? 'border-[#00f2ff] bg-[#00f2ff]/10' : 'border-transparent bg-white/5 opacity-60 hover:opacity-100'}`}
               >
                 <div className="w-8 h-8 rounded-md bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: agent.appearance?.hair_color || '#00f2ff' }} />
                 </div>
                 <div className="flex flex-col items-start overflow-hidden">
                    <span className="text-[10px] font-black text-white truncate w-full uppercase italic">{agent.name}</span>
                    <span className="text-[8px] font-bold text-[#00f2ff]/60 uppercase tracking-tighter">LV. {agent.stats?.level || 1}</span>
                 </div>
               </button>
             ))}
          </div>

          {/* Right: Agent Detail */}
          <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar pr-2">
            {selectedAgent ? (
              <div className="flex flex-col gap-4 animate-fade-in">
                 {/* Identity Header */}
                 <div className="flex items-start justify-between border-b border-white/10 pb-2">
                    <div className="flex flex-col min-w-0">
                       <span className="text-[8px] font-black text-[#00f2ff] uppercase tracking-widest bg-[#00f2ff]/10 px-1.5 py-0.5 rounded-sm self-start mb-1.5">
                         {selectedAgent.persona?.Job || '요원'}
                       </span>
                       <h2 className="text-2xl font-black italic text-white tracking-tighter uppercase leading-none neon-text-intense truncate">{selectedAgent.name}</h2>
                       <p className="text-[10px] font-medium text-white/40 mt-1 italic line-clamp-1">
                         "{selectedAgent.persona?.Role || 'Gem Company의 전략적 자산입니다.'}"
                       </p>
                    </div>
                    <div className="flex flex-col items-end shrink-0 ml-2">
                       <span className="text-xl font-black text-white italic">LV.{selectedAgent.stats?.level || 1}</span>
                    </div>
                 </div>

                 {/* Stats Visualization */}
                 <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div className="col-span-2">
                       <CyberStatBar label="진화 단계 (XP)" value={65} color="#00f2ff" />
                    </div>
                    <div className="flex flex-col gap-3">
                       <CyberStatBar label="전략적 파워" value={78} color="#ff00ff" />
                       <CyberStatBar label="효율성" value={92} color="#00f2ff" />
                    </div>
                    <div className="flex flex-col gap-3">
                       <CyberStatBar label="순응도" value={85} color="#f59e0b" />
                       <CyberStatBar label="시스템 친화력" value={45} color="#10b981" />
                    </div>
                 </div>

                 {/* Traits/Skills */}
                 <div className="mt-2">
                    <div className="text-[9px] font-black mb-2 text-white/20 uppercase tracking-widest">활성 특성 모듈</div>
                    <div className="grid grid-cols-1 gap-1.5">
                       <div className="bg-white/5 p-2 rounded-lg border border-white/10 flex items-center gap-3">
                          <Brain size={14} className="text-[#00f2ff]" />
                          <div className="flex flex-col">
                             <span className="text-[9px] font-black text-white uppercase">신경 적응성</span>
                             <span className="text-[7px] text-white/40 uppercase font-bold">+15% XP 획득</span>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-white/20 gap-4 opacity-50">
                 <Target size={64} className="animate-pulse" />
                 <span className="font-black uppercase tracking-widest text-sm">Select Agent for Bio-Metrics</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </CyberPanel>
  );
};

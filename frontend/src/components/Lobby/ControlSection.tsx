import { Play } from 'lucide-react';
import { CyberPanel, CyberButton } from '../Common/CyberUI';

interface ControlSectionProps {
  spawnDesc: string;
  setSpawnDesc: (val: string) => void;
  handleSpawn: () => void;
  isSpawning: boolean;
  currentMap: any;
  agents: any[];
  onStart: () => void;
}

export const ControlSection = ({
  spawnDesc,
  setSpawnDesc,
  handleSpawn,
  isSpawning,
  currentMap,
  agents,
  onStart
}: ControlSectionProps) => {
  return (
    <div className="flex flex-col gap-3 h-full font-['NeoDunggeunmo']">
      {/* AI Spawner Section */}
      <CyberPanel title="03. 현장 지원" idTag="AI-GEN">
        <div className="flex flex-col gap-2">
          <div className="text-[9px] font-bold text-[#00f2ff]/40 uppercase mb-0.5">AI 지원 요청</div>
          <input 
            type="text" 
            value={spawnDesc}
            onChange={(e) => setSpawnDesc(e.target.value)}
            placeholder="역할 설명 (예: 연구원)"
            className="w-full p-2 bg-black/40 border-2 border-[#00f2ff]/20 font-bold text-sm focus:outline-none focus:border-[#00f2ff] text-white placeholder:text-white/10 rounded-lg transition-all"
          />
          <CyberButton 
            onClick={handleSpawn}
            disabled={isSpawning}
            className="w-full py-2 text-[10px]"
          >
            {isSpawning ? '전송 중...' : '생성 시작'}
          </CyberButton>
        </div>
      </CyberPanel>

      {/* Final Deployment Section */}
      <CyberPanel title="04. 미션 제어" idTag="OPS-EXE" className="flex-1 min-h-0">
         <div className="flex flex-col h-full">
            {/* Top Checklist */}
            <div className="p-3 bg-[#00f2ff]/5 border border-[#00f2ff]/10 rounded-xl mb-2">
               <div className="text-[10px] font-black text-[#00f2ff] uppercase tracking-widest mb-2 border-b border-[#00f2ff]/20 pb-1.5">출격 준비 리스트</div>
               <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-white/40 uppercase">할당 구역</span>
                    <span className="text-xs font-black text-white truncate max-w-[120px]">{currentMap?.name || '없음'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-white/40 uppercase">배치 가능 유닛</span>
                    <span className="text-xs font-black text-[#00f2ff]">{agents.length} AGENTS 준비됨</span>
                  </div>
               </div>
            </div>

            {/* Middle Tactical Display */}
            <div className="flex-1 min-h-[60px] border-2 border-dashed border-[#00f2ff]/10 rounded-xl relative overflow-hidden group flex flex-col items-center justify-center bg-black/20 mb-2">
               <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#00f2ff_1px,transparent_1px)] [background-size:10px_10px]" />
               <div className="relative flex flex-col items-center gap-1">
                  <div className="w-10 h-10 border border-[#00f2ff]/30 rounded-full flex items-center justify-center animate-spin-slow">
                     <div className="w-6 h-6 border-2 border-[#00f2ff]/20 border-t-[#00f2ff] rounded-full" />
                  </div>
                  <span className="text-[7px] font-black text-[#00f2ff]/40 uppercase tracking-[0.4em] animate-pulse">스캔 중...</span>
               </div>
               <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-[#00f2ff]/20" />
               <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-[#00f2ff]/20" />
            </div>

            {/* DEPLOY Button */}
            <div className="mt-auto">
               <button 
                 onClick={onStart}
                 className="w-full group relative overflow-hidden rounded-2xl transition-all duration-500 hover:scale-[1.01] active:scale-95"
               >
                 <div className="absolute inset-0 bg-[#00f2ff] opacity-80 group-hover:opacity-100 transition-opacity" />
                 <div className="relative py-4 flex flex-col items-center justify-center gap-1 border-4 border-white/20">
                   <Play size={32} fill="currentColor" className="text-[#0a1120]" />
                   <div className="flex flex-col items-center">
                      <span className="text-2xl font-[1000] text-[#0a1120] tracking-tighter uppercase italic leading-none">출격하기</span>
                      <span className="text-[7px] font-black text-[#0a1120]/60 uppercase tracking-[0.5em] mt-0.5">시뮬레이션 시작</span>
                   </div>
                 </div>
               </button>
               <div className="mt-2 flex justify-between items-center px-2 pb-1">
                  <span className="text-[7px] font-black text-white/15 uppercase tracking-widest">안전 잠금: 해제</span>
                  <span className="text-[7px] font-black text-white/15 uppercase tracking-widest">신호: 양호</span>
               </div>
            </div>
         </div>
      </CyberPanel>
    </div>
  );
};

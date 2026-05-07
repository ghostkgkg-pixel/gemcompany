import { useEffect, useState, useMemo, useRef } from 'react';
import { GameCanvas } from './GameCanvas';
import { useGameStore } from '../store/useGameStore';
import { MapService } from '../services/MapService';
import { AgentService } from '../services/AgentService';
import { initSocket } from '../services/socket';
import { Users, Navigation, MessageCircle, Share2, LogOut, X } from 'lucide-react';
import { KnowledgeGraph } from './GraphView/KnowledgeGraph';
import { CharacterPreview } from './CharacterPreview';

interface SimulationPageProps {
  onGoBack: () => void;
}

/**
 * 시뮬레이션 메인 페이지 컴포넌트
 * 게임 캔버스, 에이전트 목록, 채팅 인터페이스 등을 포함함
 */
export function SimulationPage({ onGoBack }: SimulationPageProps) {
  // 전역 상태(Store)에서 데이터 추출
  const setMap = useGameStore((state: any) => state.setMap);
  const agentsObj = useGameStore((state: any) => state.agents);
  const currentMap = useGameStore((state: any) => state.currentMap);

  // 에이전트 객체를 배열 형태로 변환하여 메모이제이션
  const agents = useMemo(() => Object.values(agentsObj || {}), [agentsObj]);
  
  // 로컬 상태 관리
  const [error, setError] = useState<string | null>(null);         // 에러 메시지
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null); // 선택된 에이전트 ID
  const [chatMessage, setChatMessage] = useState('');              // 채팅 입력 메시지
  const [isSending, setIsSending] = useState(false);               // 메시지 전송 중 여부
  const [showGraph, setShowGraph] = useState(false);               // 지식 그래프 표시 여부
  const [fireConfirmId, setFireConfirmId] = useState<string | null>(null); // 해고 확인 대상 ID
  const [expandLog, setExpandLog] = useState(false);               // 로그 창 확장 여부
  const [isChatFocused, setIsChatFocused] = useState(false);       // 채팅창 포커스 여부

  // 초기화: 맵 정보 조회 및 소켓 연결
  useEffect(() => {
    const fetchData = async () => {
      try {
        const m = await MapService.getCurrentMap();
        setMap(m);
      } catch (err) {
        console.error("데이터 로드 실패:", err);
        setError("백엔드 엔진 연결에 실패했습니다.");
      }
    };
    
    fetchData();
    initSocket(); // 실시간 상태 동기화를 위한 소켓 초기화
  }, [setMap]);

  // 에이전트에게 메시지 전송
  const handleSendMessage = async () => {
    if (!selectedAgentId || !chatMessage.trim()) return;
    
    setIsSending(true);
    try {
      await AgentService.chatWithAgent(selectedAgentId, chatMessage);
      setChatMessage('');
    } catch (err) {
      console.error("채팅 전송 실패:", err);
    } finally {
      setIsSending(false);
    }
  };

  // 에이전트 해고 처리
  const handleFireAgent = async (agentId: string) => {
    try {
      await AgentService.fireAgent(agentId);
      setSelectedAgentId(null);
      setFireConfirmId(null);
    } catch (err: any) {
      console.error("해고 처리 실패:", err);
      const detail = err.response?.data?.detail || "알 수 없는 에러가 발생했습니다.";
      alert(`해고 처리에 실패했습니다: ${detail}`);
    }
  };

  // 에러 발생 시 표시되는 화면
  if (error) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center gap-4 bg-[#0a1120] text-red-500 font-['NeoDunggeunmo']">
        <div className="p-6 bg-red-500/10 border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)] font-black italic">
          시스템 오류: {error}
        </div>
        <button onClick={() => window.location.reload()} className="px-6 py-2 bg-white text-[#0a1120] font-black italic hover:bg-red-500 hover:text-white transition-all">재접속 시도</button>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-[#0a0f1e] text-[#00f2ff] font-['NeoDunggeunmo'] flex flex-col relative overflow-hidden scanline-effect">
      
      {/* 배경 앰비언스 (그리드 레이어) */}
      <div className="absolute inset-0 opacity-10 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(#00f2ff_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      {/* 측면 장식 라인 */}
      <div className="absolute top-0 left-12 w-px h-full bg-gradient-to-b from-transparent via-[#00f2ff]/20 to-transparent pointer-events-none z-[100]" />
      <div className="absolute top-0 right-12 w-px h-full bg-gradient-to-b from-transparent via-[#00f2ff]/20 to-transparent pointer-events-none z-[100]" />

      {/* 상단 HUD (Header) */}
      <header className="h-16 cyber-panel-v2 panel-scanline border-x-0 px-6 flex items-center justify-between z-50 mx-4 mt-2">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-[#00f2ff]/10 border border-[#00f2ff]/30 rounded-lg flex items-center justify-center neon-text-intense animate-pulse">
                <Navigation size={18} />
             </div>
             <div className="flex flex-col">
               <span className="text-[10px] font-bold opacity-60 uppercase italic tracking-widest">작전 구역</span>
               <span className="text-lg font-black text-white uppercase tracking-tighter italic leading-none neon-text-intense">{currentMap?.name || '초기화 중...'}</span>
             </div>
          </div>
          
          <div className="h-8 w-px bg-white/10 hidden md:block" />
          
          <div className="hidden md:flex gap-6">
             <div className="flex flex-col">
               <span className="text-[10px] font-bold opacity-60 uppercase italic tracking-widest">활성 유닛</span>
               <span className="text-sm font-black text-[#00f2ff]">{agents.length} AGENTS</span>
             </div>
          </div>
        </div>

        <button 
          onClick={onGoBack} 
          className="group flex items-center gap-2 px-4 py-1.5 border border-red-500/50 hover:bg-red-500/20 text-red-500 transition-all italic text-sm font-bold"
        >
          <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" /> 
          퇴근하기
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* 왼쪽 사이드바: 에이전트 목록 */}
        <aside className="w-72 cyber-panel-v2 panel-scanline flex flex-col z-40">
          <div className="p-4 border-b border-white/5 bg-[#00f2ff]/5">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] italic flex items-center gap-2 text-white/80 neon-text-intense">
               <Users size={14} className="text-[#00f2ff]" /> 인원 데이터베이스
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
            {agents.map((agent: any) => (
              <div 
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={`p-3 cursor-pointer border transition-all duration-300 group ${
                  selectedAgentId === agent.id 
                  ? 'bg-[#00f2ff]/20 border-[#00f2ff] shadow-[0_0_10px_rgba(0,242,255,0.2)]' 
                  : 'bg-white/5 border-white/10 hover:border-white/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden">
                       <div className="w-6 h-6 rounded-full" style={{ backgroundColor: agent?.appearance?.hair_color || '#444' }} />
                    </div>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-black uppercase text-white truncate">{agent.name}</span>
                    <span className="text-[9px] font-bold text-[#00f2ff]/60 uppercase truncate italic">
                      {agent?.persona?.Job || 'AI UNIT'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* 중앙 메인 영역: 게임 캔버스 */}
        <main className="flex-1 relative bg-transparent flex items-center justify-center group cyber-panel-v2 panel-scanline p-0 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none border-[12px] border-[#151b2d]/50 z-10" />
          <div className="w-full h-full relative">
            <GameCanvas />
            
            {/* 지식 그래프 토글 버튼 */}
            <button 
              onClick={() => setShowGraph(!showGraph)}
              className={`absolute top-4 right-4 z-30 p-3 border-2 transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)] ${
                showGraph ? 'bg-[#00f2ff] text-[#0a1120] border-white' : 'bg-black/80 text-[#00f2ff] border-[#00f2ff]/50 hover:bg-[#00f2ff]/10'
              }`}
            >
              <Share2 size={24} />
            </button>
            
            {/* 지식 그래프 오버레이 뷰 */}
            {showGraph && (
              <div className="absolute inset-0 z-20 bg-[#0a1120]/95 backdrop-blur-md animate-in fade-in duration-300 p-8 flex flex-col">
                <div className="flex justify-between items-center mb-8 border-b-2 border-[#00f2ff]/20 pb-4">
                   <h2 className="text-3xl font-black italic uppercase tracking-tighter text-[#00f2ff] neon-text">Neural Network Graph</h2>
                   <button onClick={() => setShowGraph(false)} className="text-[#00f2ff]/60 hover:text-white transition-colors">
                      <X size={32} />
                   </button>
                </div>
                <div className="flex-1 border border-white/5 bg-black/20 overflow-hidden relative">
                   <KnowledgeGraph />
                   <div className="absolute inset-0 pointer-events-none scanline-effect opacity-30" />
                </div>
              </div>
            )}
          </div>

          {/* 하단 채팅 및 로그 영역 (오버레이 스타일) */}
          <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-4xl z-30 transition-all duration-500 transform ${expandLog ? 'translate-y-0' : 'translate-y-[85%]'}`}>
             <div className={`cyber-panel-v2 panel-scanline shadow-[0_10px_50px_rgba(0,0,0,0.8)] transition-all duration-500`}>
                {/* 드래그/토글 핸들 */}
                <div 
                  onClick={() => setExpandLog(!expandLog)}
                  className="h-8 flex items-center justify-center cursor-pointer hover:bg-white/5 transition-colors group border-b border-white/5"
                >
                   <div className={`w-12 h-1 bg-[#00f2ff]/30 rounded-full group-hover:bg-[#00f2ff] transition-colors ${expandLog ? 'rotate-180' : ''}`} />
                </div>

                <div className="p-6 h-[400px] flex gap-6 overflow-hidden">
                   {/* 에이전트 상세 정보 패널 */}
                   <div className="w-64 border-r border-white/10 pr-6 flex flex-col gap-4">
                      {selectedAgentId ? (
                        <>
                          <div className="relative aspect-square bg-black/40 border border-[#00f2ff]/20 flex items-center justify-center p-4">
                             <div className="w-20 h-20 bg-[#00f2ff]/10 rounded-full blur-xl absolute" />
                             <CharacterPreview form={agentsObj[selectedAgentId]?.appearance} />
                          </div>
                          <div className="space-y-1">
                             <div className="text-lg font-black text-white uppercase italic truncate">{agentsObj[selectedAgentId]?.name}</div>
                             <div className="text-[10px] font-bold text-[#00f2ff] uppercase tracking-widest">{agentsObj[selectedAgentId]?.persona?.Job}</div>
                             <p className="text-[9px] text-white/50 leading-relaxed mt-2 line-clamp-3 italic">
                                "{agentsObj[selectedAgentId]?.persona?.Personality || 'Active and ready for work.'}"
                             </p>
                          </div>
                          <button 
                            onClick={() => setFireConfirmId(selectedAgentId)}
                            className="mt-auto py-2 border border-red-500/30 text-red-500/50 hover:bg-red-500/10 hover:text-red-500 transition-all text-[10px] font-bold uppercase tracking-widest italic"
                          >
                            유닛 해고 처리 (Termination)
                          </button>
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-[#00f2ff]/20 italic text-[10px] text-center p-4 border-2 border-dashed border-white/5">
                           모니터링할 에이전트를 선택하세요
                        </div>
                      )}
                   </div>

                   {/* 활동 로그 및 채팅 창 */}
                   <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                        {selectedAgentId ? (
                          <>
                            <div className="text-[10px] font-black text-[#00f2ff]/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                               <MessageCircle size={12} /> Neural Feed / Communications
                            </div>
                            <div className="p-2 bg-white/5 border-l-2 border-[#00f2ff] text-[11px]">
                               <span className="text-[#00f2ff] font-black mr-2">[시스템]</span> 에이전트가 초기화되었으며 명령을 대기 중입니다.
                            </div>
                          </>
                        ) : (
                          <div className="h-full flex items-center justify-center text-white/10 uppercase font-black text-2xl italic tracking-tighter">
                             Standby for Data
                          </div>
                        )}
                      </div>

                      {/* 채팅 입력 영역 */}
                      <div className={`transition-all duration-300 ${selectedAgentId ? 'opacity-100 translate-y-0' : 'opacity-20 pointer-events-none translate-y-4'}`}>
                        <div className={`relative border-2 transition-all ${isChatFocused ? 'border-[#00f2ff] shadow-[0_0_15px_rgba(0,242,255,0.2)]' : 'border-white/10'}`}>
                          <input 
                            type="text" 
                            value={chatMessage}
                            onChange={(e) => setChatMessage(e.target.value)}
                            onFocus={() => setIsChatFocused(true)}
                            onBlur={() => setIsChatFocused(false)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder={`에이전트 ${agentsObj[selectedAgentId]?.name?.toUpperCase() || ''}에게 명령 하달...`}
                            className="w-full p-4 bg-transparent outline-none font-bold text-[#00f2ff] placeholder:text-white/10"
                          />
                          <button 
                            onClick={handleSendMessage}
                            disabled={isSending || !chatMessage.trim()}
                            className="absolute right-2 top-2 bottom-2 px-6 cyber-button text-xs"
                          >
                             {isSending ? '송신 중...' : '명령 전송'}
                          </button>
                        </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </main>
      </div>

      {/* 해고 확인 모달 */}
      {fireConfirmId && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[5000] p-4 backdrop-blur-xl">
           <div className="bg-[#151b2d] border-4 border-red-500 p-8 max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.3)] animate-pop-in">
              <h2 className="text-3xl font-black text-red-500 italic uppercase tracking-tighter mb-4">해고 프로토콜 실행</h2>
              <p className="text-white/80 mb-8 leading-relaxed">
                 정말로 에이전트 <span className="text-red-500 font-black">"{agentsObj[fireConfirmId]?.name}"</span>를 영구 해고하시겠습니까? 
                 해당 유닛의 모든 신경 데이터가 소거됩니다.
              </p>
              <div className="flex gap-4">
                 <button onClick={() => setFireConfirmId(null)} className="flex-1 py-3 border-2 border-white/20 text-white font-bold hover:bg-white/5 transition-all">취소 (ABORT)</button>
                 <button onClick={() => handleFireAgent(fireConfirmId)} className="flex-1 py-3 bg-red-500 text-white font-black hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.4)]">실행 (EXECUTE)</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

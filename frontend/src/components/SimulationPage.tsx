import { useEffect, useState, useMemo } from 'react';
import { GameCanvas } from './GameCanvas';
import { useGameStore } from '../store/useGameStore';
import { getMapCurrent, moveAgent, chatWithAgent } from '../services/api';
import { initSocket } from '../services/socket';
import { Users, Map as MapIcon, Navigation, MessageCircle } from 'lucide-react';
import { LogOut } from 'lucide-react';

interface SimulationPageProps {
  onGoBack: () => void;
}

export function SimulationPage({ onGoBack }: SimulationPageProps) {
  console.log("SimulationPage Rendering...");
  
  const setMap = useGameStore((state: any) => state.setMap);
  const agentsObj = useGameStore((state: any) => state.agents);
  const currentMap = useGameStore((state: any) => state.currentMap);

  const agents = useMemo(() => Object.values(agentsObj || {}), [agentsObj]);
  
  const [error, setError] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const m = await getMapCurrent();
        setMap(m);
      } catch (err) {
        console.error("Data fetch failed:", err);
        setError("Failed to connect to the backend engine.");
      }
    };
    
    fetchData();
    initSocket();
  }, [setMap]);

  if (error) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center gap-4 bg-red-100">
        <div className="p-4 bg-red-200 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-red-800 font-bold">
          {error}
        </div>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-400 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none hover:bg-blue-500 font-bold text-white">다시 연결</button>
      </div>
    );
  }

  // Templates loading check removed since it's handled in setup



  const handleMove = async (id: string) => {
    // For testing, pick a random coordinate
    const targetX = Math.floor(Math.random() * 10);
    const targetY = Math.floor(Math.random() * 10);
    try {
      await moveAgent(id, targetX, targetY);
    } catch (error) {
      console.error("Failed to move agent:", error);
    }
  };



  const handleChat = async () => {
    if (!selectedAgentId || !chatMessage.trim()) return;
    setIsSending(true);
    try {
      await chatWithAgent(selectedAgentId, chatMessage);
      setChatMessage('');
    } catch (error) {
      console.error("Chat failed:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="w-full h-screen flex overflow-hidden fixed inset-0 font-['NeoDunggeunmo'] text-black p-4 gap-4">
      
      {/* Sidebar */}
      <aside className="w-80 h-full flex flex-col gap-4 flex-shrink-0 relative z-10">
        
        {/* Title Box */}
        <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 relative">
            <h1 className="text-xl font-bold text-black tracking-wider">직원 모니터링</h1>
            <button 
              onClick={onGoBack}
              className="absolute right-[-10px] top-[-10px] bg-red-400 border-2 border-black p-1 hover:bg-red-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none text-white"
              title="로비로 돌아가기 (퇴근)"
            >
              <LogOut size={16} />
            </button>
        </div>

        {/* Agent List */}
        <section className="flex-1 bg-white p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 text-black mb-2 text-sm font-bold uppercase tracking-wider border-b-2 border-black pb-1">
            <Users size={16} />
            <span>현재 직원 목록 ({agents.length}명)</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-2">
            {agents.map((agent: any) => (
              <div 
                key={agent?.id} 
                onClick={() => setSelectedAgentId(agent?.id)}
                className={`border-2 p-2 cursor-pointer transition-all ${selectedAgentId === agent?.id ? 'border-black bg-[#bfdbfe] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -translate-y-1 -translate-x-1' : 'border-gray-300 hover:border-black bg-gray-50'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="font-bold text-lg text-blue-700">{agent?.name}</div>
                  <div className="text-[10px] bg-yellow-200 px-1 border border-black">{agent?.persona?.Role || '직원'}</div>
                </div>
                <div className="text-xs text-gray-700 truncate mb-1">
                  행동: {agent?.current_action}
                </div>
                {agent?.current_speech && (
                  <div className="text-xs bg-white border border-gray-400 p-1 italic text-gray-800 line-clamp-2">
                    "{agent.current_speech}"
                  </div>
                )}
              </div>
            ))}
            {agents.length === 0 && (
              <div className="text-center text-gray-400 mt-10 text-sm">출근한 직원이 없습니다.</div>
            )}
          </div>
        </section>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col gap-4 min-w-0">
        
        {/* Top Bar */}
        <header className="bg-white border-4 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex justify-between items-center z-10 relative">
          <div className="flex items-center gap-2 font-bold text-lg">
            <MapIcon size={20} className="text-green-600" />
            <span>오피스 맵</span>
            <span className="text-sm font-normal text-gray-500 ml-2">({currentMap?.name || '로딩중'})</span>
          </div>
          <button 
            onClick={onGoBack}
            className="px-4 py-1 bg-red-400 border-2 border-black hover:bg-red-500 text-white font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none"
          >
            퇴근하기 (로비)
          </button>
        </header>

        {/* Game Canvas Container */}
        <div className="flex-1 bg-[#86efac] border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden flex items-center justify-center p-2">
           <div className="w-full h-full border-2 border-black bg-white overflow-hidden relative">
             <GameCanvas />
           </div>
        </div>

        {/* Chat / Command Panel */}
        <section className="bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-3 flex gap-3 h-32 z-10 relative">
          <div className="flex-1 flex flex-col">
            <div className="text-sm font-bold text-black mb-1 flex items-center gap-1">
              <MessageCircle size={14} /> 
              {selectedAgentId ? `${(agents.find((a:any) => a.id === selectedAgentId) as any)?.name || ''}에게 말걸기` : '직원을 선택하세요'}
            </div>
            <textarea
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              disabled={!selectedAgentId}
              placeholder={selectedAgentId ? "메시지를 입력하세요..." : "대화할 직원을 왼쪽에서 클릭하세요."}
              className="flex-1 w-full bg-gray-50 border-2 border-black p-2 text-sm focus:outline-none resize-none disabled:bg-gray-200"
            />
          </div>
          <div className="flex flex-col gap-2 justify-end w-32">
             <button 
                onClick={handleChat}
                disabled={!selectedAgentId || !chatMessage.trim() || isSending}
                className="w-full bg-[#f87171] hover:bg-[#ef4444] disabled:opacity-50 py-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none font-bold text-white flex items-center justify-center gap-1"
              >
                {isSending ? <span className="animate-pulse">전송중..</span> : <span>말하기</span>}
              </button>
              <button 
                onClick={() => selectedAgentId && handleMove(selectedAgentId)}
                disabled={!selectedAgentId}
                className="w-full bg-[#4ade80] hover:bg-[#22c55e] disabled:opacity-50 py-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none font-bold text-white flex items-center justify-center gap-1"
              >
                <Navigation size={14} /> 랜덤이동
              </button>
          </div>
        </section>

      </main>
    </div>
  );
}



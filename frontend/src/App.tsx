import { useEffect, useState, useMemo } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { useGameStore } from './store/useGameStore';
import { getMapCurrent, spawnAgent, moveAgent } from './services/api';
import { initSocket } from './services/socket';
import { Users, Map as MapIcon, Terminal, Plus, Loader2, Navigation } from 'lucide-react';
import axios from 'axios';

function App() {
  console.log("App Rendering...");
  
  const setMap = useGameStore((state) => state.setMap);
  const agentsObj = useGameStore((state) => state.agents);
  const currentMap = useGameStore((state) => state.currentMap);

  const agents = useMemo(() => Object.values(agentsObj || {}), [agentsObj]);
  
  const [spawnDesc, setSpawnDesc] = useState('');
  const [isSpawning, setIsSpawning] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<any>(null); // Start with null to detect loading
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const m = await getMapCurrent();
        setMap(m);
        const t = await axios.get('http://localhost:8000/map/templates');
        setTemplates(t.data);
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
      <div className="w-full h-screen bg-slate-900 text-white flex flex-col items-center justify-center gap-4">
        <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-2xl text-red-200">
          {error}
        </div>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-indigo-600 rounded-lg">Retry Connection</button>
      </div>
    );
  }

  if (!templates) {
    return (
      <div className="w-full h-screen bg-slate-900 text-white flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-indigo-500" size={48} />
        <p className="text-slate-400 animate-pulse">Initializing Virtual Office Engine...</p>
      </div>
    );
  }

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

  const handleSelectTemplate = async (id: string) => {
    try {
      await axios.post(`http://localhost:8000/map/select/${id}`);
      setShowTemplates(false);
    } catch (error) {
      console.error("Failed to change map:", error);
    }
  };

  return (
    <div className="w-full h-screen bg-slate-900 text-white flex overflow-hidden fixed inset-0">
      {/* Sidebar */}
      <aside className="w-80 h-full bg-slate-800 border-r border-slate-700 p-6 flex flex-col gap-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-lg">
            <Terminal size={24} />
          </div>
          <h1 className="text-xl font-bold">AI Agent Office</h1>
        </div>

        <section className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 shadow-inner">
          <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3 flex items-center gap-2">
            <Plus size={14} /> Summon New Agent
          </h3>
          <textarea 
            value={spawnDesc}
            onChange={(e) => setSpawnDesc(e.target.value)}
            placeholder="Describe persona..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none transition-all text-white"
          />
          <button 
            onClick={handleSpawn}
            disabled={isSpawning || !spawnDesc.trim()}
            className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all"
          >
            {isSpawning ? <Loader2 className="animate-spin" size={18} /> : <span>Spawn Agent</span>}
          </button>
        </section>

        <section className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-2 text-slate-400 mb-4 text-xs font-semibold uppercase tracking-wider">
            <Users size={14} />
            <span>Active Agents ({agents.length})</span>
          </div>
          <div className="flex flex-col gap-3">
            {agents.map((agent: any) => (
              <div key={agent?.id} className="bg-slate-700/40 border border-slate-600/50 p-3 rounded-xl hover:border-indigo-500/50 transition-all group">
                <div className="flex justify-between items-start">
                  <div className="font-bold text-indigo-300 truncate pr-2">{agent?.name}</div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleMove(agent?.id)}
                      className="text-xs bg-slate-600 hover:bg-indigo-500 text-white p-1 rounded transition-colors"
                      title="Move to random location"
                    >
                      <Navigation size={12} />
                    </button>
                    <div className="text-[10px] bg-indigo-900/30 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-700/50">LVL 1</div>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  {agent?.current_action || "Idle"}
                </div>
              </div>
            ))}
          </div>
        </section>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-full p-8 flex flex-col items-center gap-8 bg-slate-900 overflow-y-auto custom-scrollbar relative">
        <div className="w-full flex justify-between items-center max-w-5xl flex-shrink-0">
           <div>
             <h2 className="text-2xl font-bold flex items-center gap-3">
               <MapIcon className="text-indigo-500" />
               {currentMap?.name || "Virtual Environment"}
             </h2>
           </div>
           <div className="relative">
             <button 
               onClick={() => setShowTemplates(!showTemplates)}
               className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-5 py-2.5 rounded-xl transition-all font-semibold"
             >
               <MapIcon size={18} className="text-indigo-400" />
               Change Template
             </button>
             
             {showTemplates && (
               <div className="absolute right-0 mt-3 w-56 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                 {Object.values(templates || {}).map((t: any) => (
                   <button 
                     key={t?.id}
                     onClick={() => handleSelectTemplate(t?.id)}
                     className="w-full text-left px-5 py-3.5 hover:bg-indigo-600 transition-colors"
                   >
                     <span className="font-medium">{t?.name}</span>
                   </button>
                 ))}
               </div>
             )}
           </div>
        </div>

        <div className="flex-shrink-0">
          <GameCanvas />
        </div>
        
        <div className="w-full max-w-5xl bg-slate-800/50 border border-slate-700 p-6 rounded-2xl flex-shrink-0">
           <div className="bg-slate-950 p-4 rounded-xl font-mono text-xs h-32 overflow-y-auto custom-scrollbar">
             <div className="text-emerald-500">[System] Real-time engine connected.</div>
             {agents.map((a: any, i: number) => (
               <div key={i} className="text-slate-400 mt-1">[{new Date().toLocaleTimeString()}] Agent {a?.name} ready.</div>
             ))}
           </div>
        </div>
      </main>
    </div>
  );
}

export default App;

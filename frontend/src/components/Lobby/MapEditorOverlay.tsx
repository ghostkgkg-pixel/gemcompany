import React, { useEffect, useState } from 'react';
import { Hammer, RotateCw, FlipHorizontal, Eraser, Save, X, Trash2, Box } from 'lucide-react';
import { GameCanvas } from '../GameCanvas';
import { getMapTemplates } from '../../services/api';
import { useGameStore } from '../../store/useGameStore';

interface MapEditorOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  currentMap: any;
  buildMode: boolean;
  toggleBuildMode: () => void;
  setBuildBrush: (brush: string) => void;
  buildBrush: string;
  handleSaveMap: () => void;
  setIsZoneModalOpen: (val: boolean) => void;
  handleRemoveZone: (name: string) => void;
}

export const MapEditorOverlay = ({
  isOpen,
  onClose,
  currentMap,
  buildMode,
  toggleBuildMode,
  setBuildBrush,
  buildBrush,
  handleSaveMap,
  setIsZoneModalOpen,
  handleRemoveZone
}: MapEditorOverlayProps) => {
  const [savedMaps, setSavedMaps] = useState<any[]>([]);
  const { selectedModule, setSelectedModule } = useGameStore();

  useEffect(() => {
    if (isOpen) {
      const fetchTemplates = async () => {
        try {
          const data = await getMapTemplates();
          setSavedMaps(Object.values(data.saved || {}));
        } catch (err) {
          console.error("Failed to fetch templates:", err);
        }
      };
      fetchTemplates();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const brush = buildBrush || 'none';

  const selectModule = (map: any) => {
    setSelectedModule(map.name, { width: map.width, height: map.height });
    setBuildBrush('module_stamp');
  };

  return (
    <div className="fixed inset-0 bg-[#0a0f1e] z-[1000] flex flex-col font-['NeoDunggeunmo']">
      {/* Editor Header */}
      <div className="h-16 cyber-panel panel-grid border-x-0 border-t-0 flex items-center justify-between px-6 shadow-lg">
        <div className="flex items-center gap-4">
          <Hammer className="text-[#00f2ff] neon-text-intense" size={28} />
          <div>
            <h2 className="text-xl font-black text-white italic uppercase tracking-tighter neon-text-intense">Office Blueprint Architect</h2>
            <p className="text-[10px] text-[#00f2ff]/60 uppercase font-bold tracking-widest italic">Live Map Construction Suite</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <button 
             onClick={handleSaveMap}
             className="cyber-button px-6 py-2 text-sm"
           >
             <Save size={18} /> 블루프린트 저장
           </button>
           <button onClick={onClose} className="p-2 text-white/40 hover:text-white hover:rotate-90 transition-all">
             <X size={32} />
           </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Editor Sidebar */}
        <aside className="w-72 cyber-panel panel-grid border-y-0 border-l-0 flex flex-col p-4 gap-6 overflow-y-auto custom-scrollbar">
           <div>
              <h3 className="text-[10px] font-black text-[#00f2ff]/50 uppercase tracking-[0.2em] mb-3 italic">Construction Tools</h3>
              <div className="grid grid-cols-2 gap-2">
                 <button 
                   onClick={() => { setBuildBrush('obstacle_wall'); setSelectedModule(null); }}
                   className={`p-3 border-2 flex flex-col items-center gap-1 transition-all ${brush === 'obstacle_wall' ? 'border-[#00f2ff] bg-[#00f2ff]/10 shadow-[0_0_15px_rgba(0,242,255,0.2)]' : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20'}`}
                 >
                    <div className="w-8 h-10 bg-slate-700 border-x border-t border-[#00f2ff]/40" />
                    <span className="text-[9px] font-bold">네온 외벽</span>
                 </button>
                 <button 
                   onClick={() => { setBuildBrush('obstacle_desk'); setSelectedModule(null); }}
                   className={`p-3 border-2 flex flex-col items-center gap-1 transition-all ${brush === 'obstacle_desk' ? 'border-[#00f2ff] bg-[#00f2ff]/10' : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20'}`}
                 >
                    <div className="w-8 h-8 bg-purple-900/40 border border-purple-500/50" />
                    <span className="text-[9px] font-bold">워크스테이션</span>
                 </button>
                 <button 
                   onClick={() => { setBuildBrush('obstacle_plant'); setSelectedModule(null); }}
                   className={`p-3 border-2 flex flex-col items-center gap-1 transition-all ${brush === 'obstacle_plant' ? 'border-[#00f2ff] bg-[#00f2ff]/10' : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20'}`}
                 >
                    <div className="w-6 h-6 rounded-full bg-emerald-500/30 border border-emerald-400" />
                    <span className="text-[9px] font-bold">바이오 플랜트</span>
                 </button>
                 <button 
                   onClick={() => { setBuildBrush('obstacle_server'); setSelectedModule(null); }}
                   className={`p-3 border-2 flex flex-col items-center gap-1 transition-all ${brush === 'obstacle_server' ? 'border-[#00f2ff] bg-[#00f2ff]/10' : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20'}`}
                 >
                    <div className="w-8 h-10 bg-blue-900/40 border-2 border-blue-400 shadow-[inset_0_0_10px_rgba(0,242,255,0.5)]" />
                    <span className="text-[9px] font-bold">메인프레임</span>
                 </button>
                 <button 
                   onClick={() => { setBuildBrush('tile_eraser'); setSelectedModule(null); }}
                   className={`p-3 border-2 flex flex-col items-center gap-1 transition-all ${brush === 'tile_eraser' ? 'border-orange-500 bg-orange-500/10 text-white' : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20'}`}
                 >
                    <Eraser size={20} className="text-orange-500" />
                    <span className="text-[9px] font-bold">플랫폼 삭제</span>
                 </button>
                 <button 
                   onClick={() => { setBuildBrush('eraser'); setSelectedModule(null); }}
                   className={`p-3 border-2 flex flex-col items-center gap-1 transition-all ${brush === 'eraser' ? 'border-red-500 bg-red-500/10 text-white' : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20'}`}
                 >
                    <Eraser size={20} />
                    <span className="text-[9px] font-bold">에셋 삭제</span>
                 </button>
              </div>
           </div>

           <div>
              <h3 className="text-[10px] font-black text-[#00f2ff]/50 uppercase tracking-[0.2em] mb-3 italic">Module Library</h3>
              <div className="flex flex-col gap-2">
                 {savedMaps.length === 0 ? (
                   <p className="text-[9px] text-white/20 italic p-4 border border-dashed border-white/10 text-center">No saved modules found</p>
                 ) : (
                   savedMaps.map(m => (
                     <button
                       key={m.name}
                       onClick={() => selectModule(m)}
                       className={`p-3 border-2 flex items-center gap-3 transition-all ${selectedModule === m.name ? 'border-[#00f2ff] bg-[#00f2ff]/10' : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20'}`}
                     >
                       <Box size={16} className={selectedModule === m.name ? 'text-[#00f2ff]' : ''} />
                       <div className="flex flex-col items-start">
                          <span className="text-[10px] font-black text-white uppercase">{m.name}</span>
                          <span className="text-[8px] opacity-60">{m.width}x{m.height} Unit</span>
                       </div>
                     </button>
                   ))
                 )}
              </div>
           </div>

           <div>
              <h3 className="text-[10px] font-black text-[#00f2ff]/50 uppercase tracking-[0.2em] mb-3 italic">Zone Brush</h3>
              <div className="grid grid-cols-2 gap-2">
                 {[
                   { id: 'zone_work',    label: '업무 구역',  color: '#4488ff' },
                   { id: 'zone_meeting', label: '회의실',     color: '#44ff88' },
                   { id: 'zone_break',   label: '휴게실',     color: '#ffcc44' },
                   { id: 'zone_lab',     label: '연구실',     color: '#aa44ff' },
                   { id: 'zone_ceo',     label: 'CEO 오피스', color: '#ff4444' },
                 ].map(z => (
                   <button
                     key={z.id}
                     onClick={() => { setBuildBrush(z.id); setSelectedModule(null); }}
                     className={`p-2 border-2 flex items-center gap-2 transition-all ${brush === z.id ? 'border-[#00f2ff] bg-[#00f2ff]/10' : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20'}`}
                   >
                     <div className="w-3 h-3 rounded-full" style={{ backgroundColor: z.color }} />
                     <span className="text-[9px] font-bold">{z.label}</span>
                   </button>
                 ))}
              </div>
           </div>

           <div className="mt-auto p-4 bg-[#00f2ff]/5 border border-[#00f2ff]/20">
              <p className="text-[9px] text-[#00f2ff]/60 leading-relaxed italic">
                 * 왼쪽 클릭으로 에셋/모듈을 설치합니다.<br/>
                 * 우클릭 드래그로 화면을 이동합니다.<br/>
                 * 마우스 휠로 확대/축소합니다.
              </p>
           </div>
        </aside>

        {/* Editor Main Canvas */}
        <main className="flex-1 bg-black relative flex items-center justify-center group cursor-crosshair">
           <div className="absolute inset-0 pointer-events-none border-[12px] border-[#151b2d] z-10" />
           <div className="w-full h-full relative">
              <GameCanvas />
              {/* Build Indicator */}
              <div className="absolute top-4 left-4 z-20 px-3 py-1 bg-[#00f2ff] text-[#0a1120] font-black text-[10px] uppercase italic">
                 ACTIVE: {selectedModule ? `STAMPING [${selectedModule.toUpperCase()}]` : brush.toUpperCase()}
              </div>
           </div>
        </main>
      </div>
    </div>
  );
};

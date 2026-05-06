import { Map as MapIcon, Hammer, Trash2 } from 'lucide-react';
import { CyberPanel, CyberButton } from '../Common/CyberUI';

interface MapSectionProps {
  templates: any;
  currentMap: any;
  handleSelectTemplate: (id: string) => void;
  handleDeleteTemplate?: (id: string) => void;
  setIsEditingMap: (val: boolean) => void;
  buildMode: boolean;
  toggleBuildMode: () => void;
}

export const MapSection = ({ 
  templates, 
  currentMap, 
  handleSelectTemplate, 
  handleDeleteTemplate,
  setIsEditingMap, 
  buildMode, 
  toggleBuildMode 
}: MapSectionProps) => {
  return (
    <CyberPanel title="01. 사무실 설정" idTag="MAP-SYS" className="h-full">
      <div className="flex flex-col gap-4 h-full">
        <CyberButton 
          onClick={() => { setIsEditingMap(true); if(!buildMode) toggleBuildMode(); }}
          className="w-full"
        >
          <Hammer size={20} /> 맵 편집기 열기
        </CyberButton>
        
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar border-t-2 border-[#00f2ff]/10 pt-4">
          <div className="text-[10px] font-black mb-1 text-[#00f2ff]/50 uppercase tracking-widest">기본 템플릿</div>
          {!templates ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-white/5 border-2 border-dashed border-white/10 animate-pulse flex-shrink-0" />
              ))}
            </div>
          ) : (
            <>
              {templates.defaults && Object.entries(templates.defaults).map(([id, t]: [string, any]) => (
                    <button 
                      key={id}
                      onClick={() => handleSelectTemplate(id)}
                      className={`text-left px-4 py-3 border-2 font-bold text-sm transition-all flex-shrink-0 my-1 mx-1 rounded-lg hover:scale-[1.02] active:scale-95 ${
                        currentMap?.id === id 
                          ? 'border-[#00f2ff] bg-[#00f2ff]/20 shadow-[0_0_15px_rgba(0,242,255,0.3)] text-white' 
                          : 'border-white/10 bg-white/5 text-white/60 hover:border-white/30'
                      }`}
                    >
                  {t.name}
                </button>
              ))}
              
              {templates.saved && Object.entries(templates.saved).length > 0 && (
                <>
                  <div className="text-[10px] font-black mt-4 mb-1 text-[#00f2ff]/50 uppercase tracking-widest border-t border-white/5 pt-4">커스텀 블루프린트</div>
                  {Object.entries(templates.saved).map(([id, t]: [string, any]) => (
                    <div key={id} className="flex items-center gap-1 my-1 mx-1">
                      <button 
                        onClick={() => handleSelectTemplate(id)}
                        className={`flex-1 text-left px-4 py-3 border-2 font-bold text-sm transition-all hover:scale-[1.02] active:scale-95 ${
                          currentMap?.name === id 
                            ? 'border-[#00f2ff] bg-[#00f2ff]/20 shadow-[0_0_15px_rgba(0,242,255,0.3)] text-white' 
                            : 'border-white/10 bg-white/5 text-white/60 hover:border-white/30'
                        }`}
                      >
                        {t.name || id}
                      </button>
                      {handleDeleteTemplate && (
                        <button
                          onClick={() => handleDeleteTemplate(id)}
                          className="p-2 text-red-500/50 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </CyberPanel>
  );
};

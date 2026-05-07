import { Map as MapIcon, Hammer, Trash2, Plus, Layout } from 'lucide-react';
import { CyberPanel, CyberButton } from '../Common/CyberUI';
import { useGameStore } from '../../store/useGameStore';

interface MapSectionProps {
  templates: any;
  currentMap: any;
  handleSelectTemplate: (id: string) => void;
  handleDeleteTemplate?: (id: string) => void;
  setIsEditingMap: (val: boolean) => void;
  buildMode: boolean;
  toggleBuildMode: () => void;
  enterOfficeArchitect: () => void;
  enterModuleLab: () => void;
  handleCreateNewCompany: () => void;
}

export const MapSection = ({ 
  templates, 
  currentMap, 
  handleSelectTemplate, 
  handleDeleteTemplate,
  setIsEditingMap, 
  buildMode, 
  toggleBuildMode,
  enterOfficeArchitect,
  enterModuleLab,
  handleCreateNewCompany
}: MapSectionProps) => {
  const { setShowUpgradeModal } = useGameStore();

  return (
    <CyberPanel title="01. 컴퍼니 관리" idTag="CORP-SYS" className="h-full">
      <div className="flex flex-col gap-4 h-full">
        {/* 상단 액션 버튼 그룹 */}
        <div className="grid grid-cols-2 gap-2">
          <CyberButton 
            onClick={enterOfficeArchitect}
            disabled={!currentMap}
            className={`w-full text-[11px] ${!currentMap ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            <Hammer size={16} /> 오피스 설계
          </CyberButton>
          <CyberButton 
            onClick={enterModuleLab}
            className="w-full text-[11px] border-purple-500/50 text-purple-400"
          >
            <Layout size={16} /> 모듈 랩
          </CyberButton>
        </div>

        {/* 새 회사 설립 버튼 (바로 생성 로직 트리거) */}
        <CyberButton 
          onClick={handleCreateNewCompany}
          className="w-full py-4 border-2 border-dashed border-[#00f2ff]/30 text-[#00f2ff]/60 flex flex-col items-center justify-center gap-1 bg-[#00f2ff]/5 rounded-lg hover:border-[#00f2ff] hover:text-[#00f2ff] hover:bg-[#00f2ff]/10 transition-all"
        >
          <div className="flex items-center gap-2">
            <Plus size={18} />
            <span className="text-xs font-black uppercase tracking-widest">새 회사 설립 (Startup)</span>
          </div>
          <span className="text-[8px] opacity-60 italic">새로운 오피스 평면도를 설계하고 경영을 시작하세요</span>
        </CyberButton>
        
        {/* 기업 리스트 영역 */}
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar border-t-2 border-[#00f2ff]/10 pt-4">
          <div className="text-[10px] font-black mb-1 text-[#00f2ff]/50 uppercase tracking-widest flex justify-between items-center">
            <span>내 기업 리스트 (Portfolio)</span>
            <span className="text-[8px] opacity-40 font-normal">TOTAL: {templates?.companies ? Object.keys(templates.companies).length : 0}</span>
          </div>

          {!templates ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-white/5 border-2 border-dashed border-white/10 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* 등록된 회사 목록 렌더링 */}
              {templates.companies && Object.values(templates.companies).map((c: any) => (
                <div key={c.id} className="flex items-center gap-1 group">
                  <button 
                    onClick={() => handleSelectTemplate(c.id)}
                    className={`flex-1 text-left px-4 py-3 border-2 font-bold text-sm transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-between ${
                      currentMap?.id === c.id 
                        ? 'border-[#00f2ff] bg-[#00f2ff]/20 shadow-[0_0_15px_rgba(0,242,255,0.3)] text-white' 
                        : 'border-white/10 bg-white/5 text-white/60 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <MapIcon size={16} className={currentMap?.id === c.id ? "text-[#00f2ff]" : "text-white/20"} />
                      <span className="truncate">{c.name}</span>
                    </div>
                    <span className="text-[8px] opacity-40 italic uppercase">{c.width}x{c.height} HQ</span>
                  </button>
                  
                  {/* 삭제 버튼 (호버 시 표시) */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteTemplate?.(c.id); }}
                    className="opacity-0 group-hover:opacity-100 p-2 text-red-500/40 hover:text-red-500 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {(!templates.companies || Object.keys(templates.companies).length === 0) && (
                <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-lg">
                   <p className="text-[10px] text-white/20 italic">설립된 회사가 없습니다.<br/>위의 버튼을 눌러 시작하세요.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </CyberPanel>
  );
};

import React, { useEffect, useState } from 'react';
import { Hammer, RotateCw, FlipHorizontal, Eraser, Save, X, Trash2, Box, Lock, Star, Move, User, Layout, ChevronRight, Monitor, PenTool, Users, Briefcase, Coffee } from 'lucide-react';
import { GameCanvas } from '../GameCanvas';
import { MapService } from '../../services/MapService';
import { useGameStore } from '../../store/useGameStore';

interface MapEditorOverlayProps {
  isOpen: boolean;            // 에디터 활성화 여부
  onClose: () => void;        // 에디터 닫기 핸들러
  currentMap: any;            // 현재 편집 중인 맵 데이터
  buildMode: boolean;         // 빌드 모드 활성화 여부
  toggleBuildMode: () => void; // 빌드 모드 토글 핸들러
  setBuildBrush: (brush: string) => void; // 브러시 도구 설정 핸들러
  buildBrush: string;         // 현재 선택된 브러시
  handleSaveMap: () => void;  // 저장 실행 핸들러
  setIsZoneModalOpen: (val: boolean) => void; // 구역 설정 모달 제어
  handleRemoveZone: (name: string) => void;   // 구역 삭제 핸들러
}

/**
 * 맵 에디터 오버레이 컴포넌트
 * 오피스 배치 및 모듈 제작을 위한 통합 편집 인터페이스 제공
 */
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
  const [savedMaps, setSavedMaps] = useState<any[]>([]); // 유저가 저장한 모듈 목록
  const [defaultTemplates, setDefaultTemplates] = useState<any>({}); // 시스템 기본 템플릿
  
  // 전역 상태 바인딩
  const { selectedModule, setSelectedModule, subscriptionPlan, isPremiumTool, setShowUpgradeModal, editorMode } = useGameStore();

  // 브러시 설정 시도 (프리미엄 도구 체크 포함)
  const trySetBrush = (tool: string) => {
    if (subscriptionPlan === 'free' && isPremiumTool(tool)) {
      setShowUpgradeModal(true); // 무료 플랜인 경우 업그레이드 모달 표시
      return;
    }
    setBuildBrush(tool);
    setSelectedModule(null); // 개별 에셋 도구 선택 시 선택된 모듈 스탬프 해제
  };

  // 에디터 오픈 시 템플릿 데이터 로드
  useEffect(() => {
    if (isOpen) {
      const fetchTemplates = async () => {
        try {
          const data = await MapService.getTemplates();
          setSavedMaps(Object.values(data.modules || {}));
          setDefaultTemplates(data.defaults || {});
        } catch (err) {
          console.error("템플릿 로드 실패:", err);
        }
      };
      fetchTemplates();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const brush = buildBrush || 'none';

  // 모듈 스탬프 선택 핸들러
  const selectModule = (map: any) => {
    setSelectedModule(map.name, { width: map.width, height: map.height });
    setBuildBrush('module_stamp');
  };

  return (
    <div className="fixed inset-0 bg-[#0a0f1e] z-[1000] flex flex-col font-['NeoDunggeunmo']">
      {/* 에디터 헤더 HUD */}
      <div className="h-16 cyber-panel panel-grid border-x-0 border-t-0 flex items-center justify-between px-6 shadow-lg">
        <div className="flex items-center gap-4">
          {editorMode === 'module' ? (
            <Layout className="text-purple-400 neon-text-intense" size={28} />
          ) : (
            <Hammer className="text-[#00f2ff] neon-text-intense" size={28} />
          )}
          <div>
            <h2 className="text-xl font-black text-white italic uppercase tracking-tighter neon-text-intense">
              {editorMode === 'module' ? '모듈 연구소: 크리에이터' : '오피스 아키텍트'}
            </h2>
            <p className="text-[10px] text-[#00f2ff]/60 uppercase font-bold tracking-widest italic">
              {editorMode === 'module' ? '재사용 가능한 빌딩 블록 설계' : '회사 본사 맞춤 설정'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <button 
             onClick={handleSaveMap}
             className={`cyber-button px-6 py-2 text-sm ${editorMode === 'module' ? 'border-purple-500 text-purple-400' : ''}`}
           >
             <Save size={18} /> {editorMode === 'module' ? '모듈 저장' : '오피스 업데이트'}
           </button>
           <button onClick={onClose} className="p-2 text-white/40 hover:text-white hover:rotate-90 transition-all">
             <X size={32} />
           </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 에디터 사이드바 (도구 상자) */}
        <aside className="w-80 cyber-panel panel-grid border-y-0 border-l-0 flex flex-col p-4 gap-6 overflow-y-auto custom-scrollbar">
           
           {/* 1. 전략 구역 (Zone) - 타일 속성 부여 */}
           <div>
              <h3 className="text-[10px] font-black text-[#00f2ff]/50 uppercase tracking-[0.2em] mb-3 italic underline decoration-[#00f2ff]/20">전략 구역 (Zone)</h3>
              <div className="grid grid-cols-2 gap-2 mb-2">
                 {[
                   { id: 'zone_work',    label: '업무 구역', icon: <Monitor size={16} />, color: 'from-blue-600 to-blue-400' },
                   { id: 'zone_meeting', label: '회의 구역', icon: <Users size={16} />, color: 'from-green-600 to-green-400' },
                   { id: 'zone_break',   label: '휴식 구역', icon: <Coffee size={16} />, color: 'from-orange-600 to-orange-400' },
                   { id: 'zone_lab',     label: '연구 구역', icon: <PenTool size={16} />, color: 'from-purple-600 to-purple-400' },
                   { id: 'zone_ceo',     label: 'CEO 오피스', icon: <Star size={16} />, color: 'from-amber-600 to-amber-400' },
                 ].map(zone => (
                   <button
                     key={zone.id}
                     onClick={() => trySetBrush(zone.id)}
                     className={`flex flex-col items-center gap-2 p-3 border-2 transition-all hover:scale-[1.02] active:scale-95 ${brush === zone.id ? 'border-[#00f2ff] bg-[#00f2ff]/10 shadow-[0_0_15px_rgba(0,242,255,0.2)]' : 'border-white/5 bg-white/5 opacity-60 hover:opacity-100 hover:border-white/20'}`}
                   >
                     <div className={`p-2 rounded-lg bg-gradient-to-br ${zone.color} shadow-lg`}>
                       {zone.icon}
                     </div>
                     <span className="text-[9px] font-black uppercase tracking-widest">{zone.label}</span>
                   </button>
                 ))}
              </div>
           </div>

           {/* 2. 건설 도구 (Construction) - 개별 에셋 배치 */}
           <div>
              <h3 className="text-[10px] font-black text-[#00f2ff]/50 uppercase tracking-[0.2em] mb-3 italic underline decoration-[#00f2ff]/20">건설 도구 (Construction)</h3>
              <div className="grid grid-cols-3 gap-2">
                 <button 
                   onClick={() => trySetBrush('obstacle_wall')}
                   className={`p-3 border-2 flex flex-col items-center gap-1 transition-all ${brush === 'obstacle_wall' ? 'border-[#00f2ff] bg-[#00f2ff]/10' : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20'}`}
                 >
                    <div className="w-8 h-10 bg-slate-700 border-x border-t border-[#00f2ff]/40" />
                    <span className="text-[9px] font-bold">네온 외벽</span>
                 </button>
                 <button 
                   onClick={() => trySetBrush('obstacle_desk')}
                   className={`p-3 border-2 flex flex-col items-center gap-1 transition-all ${brush === 'obstacle_desk' ? 'border-[#00f2ff] bg-[#00f2ff]/10' : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20'}`}
                 >
                    <div className="w-8 h-8 bg-purple-900/40 border border-purple-500/50" />
                    <span className="text-[9px] font-bold">워크스테이션</span>
                 </button>
                 <button 
                   onClick={() => trySetBrush('obstacle_plant')}
                   className={`relative p-3 border-2 flex flex-col items-center gap-1 transition-all ${brush === 'obstacle_plant' ? 'border-[#00f2ff] bg-[#00f2ff]/10' : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20'}`}
                 >
                    {subscriptionPlan === 'free' && <Lock size={10} className="absolute top-1 right-1 text-[#00f2ff]" />}
                    <div className="w-6 h-6 rounded-full bg-emerald-500/30 border border-emerald-400" />
                    <span className="text-[9px] font-bold">바이오 플랜트</span>
                 </button>
                 <button 
                   onClick={() => trySetBrush('obstacle_server')}
                   className={`relative p-3 border-2 flex flex-col items-center gap-1 transition-all ${brush === 'obstacle_server' ? 'border-[#00f2ff] bg-[#00f2ff]/10' : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20'}`}
                 >
                    {subscriptionPlan === 'free' && <Lock size={10} className="absolute top-1 right-1 text-[#00f2ff]" />}
                    <div className="w-8 h-10 bg-blue-900/40 border-2 border-blue-400 shadow-[inset_0_0_10px_rgba(0,242,255,0.5)]" />
                    <span className="text-[9px] font-bold">메인프레임</span>
                 </button>
                 <button 
                   onClick={() => trySetBrush('assign_seat')}
                   className={`p-3 border-2 flex flex-col items-center gap-1 transition-all ${brush === 'assign_seat' ? 'border-[#00f2ff] bg-[#00f2ff]/10 text-white' : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20'}`}
                 >
                    <User size={20} className="text-[#00f2ff]" />
                    <span className="text-[9px] font-bold">좌석 지정</span>
                 </button>
                 <button 
                   onClick={() => trySetBrush('move_tool')}
                   className={`p-3 border-2 flex flex-col items-center gap-1 transition-all ${brush === 'move_tool' ? 'border-[#00f2ff] bg-[#00f2ff]/10 text-white' : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20'}`}
                 >
                    <Box size={20} className="text-[#00f2ff]" />
                    <span className="text-[9px] font-bold">영역 이동</span>
                 </button>
                 <button 
                   onClick={() => trySetBrush('tile_eraser')}
                   className={`p-3 border-2 flex flex-col items-center gap-1 transition-all ${brush === 'tile_eraser' ? 'border-orange-500 bg-orange-500/10 text-white' : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20'}`}
                 >
                    <Eraser size={20} className="text-orange-500" />
                    <span className="text-[9px] font-bold">플랫폼 삭제</span>
                 </button>
                 <button 
                   onClick={() => trySetBrush('eraser')}
                   className={`p-3 border-2 flex flex-col items-center gap-1 transition-all col-span-2 ${brush === 'eraser' ? 'border-red-500 bg-red-500/10 text-white' : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20'}`}
                 >
                    <Eraser size={20} />
                    <span className="text-[9px] font-bold">에셋 삭제</span>
                 </button>
              </div>
           </div>

           {/* 3. 시스템 템플릿 & 저장 모듈 */}
           <div>
                <h3 className="text-[10px] font-black text-[#00f2ff]/50 uppercase tracking-[0.2em] mb-3 italic underline decoration-[#00f2ff]/20">시스템 템플릿</h3>
                <div className="flex flex-col gap-2 mb-6 max-h-[160px] overflow-y-auto custom-scrollbar">
                  {Object.entries(defaultTemplates).map(([id, m]: [string, any]) => (
                    <div key={id} className="flex flex-col gap-1">
                      <button
                        onClick={() => selectModule(m)}
                        className={`p-3 border-2 flex items-center justify-between transition-all ${selectedModule === m.name ? 'border-[#00f2ff] bg-[#00f2ff]/10' : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20'}`}
                      >
                        <div className="flex items-center gap-3">
                          <Layout size={14} className="text-[#00f2ff]/60" />
                          <div className="flex flex-col items-start">
                             <span className="text-[10px] font-black text-white uppercase leading-tight">{m.name}</span>
                             <span className="text-[8px] opacity-60 italic">{m.width}x{m.height} 설계도</span>
                          </div>
                        </div>
                        <ChevronRight size={12} className="opacity-30" />
                      </button>
                      <button 
                        onClick={async () => {
                          if (window.confirm(`현재 설계를 지우고 '${m.name}' 템플릿을 전체 적용하시겠습니까?`)) {
                            const { setMap } = useGameStore.getState();
                            await MapService.syncMapData(m);
                            setMap(m);
                          }
                        }}
                        className="py-1 text-[8px] font-bold text-[#00f2ff]/40 hover:text-[#00f2ff] transition-all uppercase tracking-tighter text-right pr-2"
                      >
                        전체 적용 (Apply to Base)
                      </button>
                    </div>
                  ))}
                </div>

                <h3 className="text-[10px] font-black text-[#00f2ff]/50 uppercase tracking-[0.2em] mb-3 italic underline decoration-[#00f2ff]/20">저장된 모듈</h3>
                <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto custom-scrollbar">
                  {savedMaps.length === 0 ? (
                    <p className="text-[9px] text-white/20 italic p-4 border border-dashed border-white/10 text-center">저장된 모듈 없음</p>
                  ) : (
                    savedMaps.map(m => (
                      <button
                        key={m.name}
                        onClick={() => selectModule(m)}
                        className={`p-3 border-2 flex items-center justify-between transition-all ${selectedModule === m.name ? 'border-[#00f2ff] bg-[#00f2ff]/10' : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20'}`}
                      >
                        <div className="flex items-center gap-3">
                           <Box size={14} className={selectedModule === m.name ? 'text-[#00f2ff]' : 'text-white/40'} />
                           <div className="flex flex-col items-start">
                              <span className="text-[10px] font-black text-white uppercase leading-tight">{m.name}</span>
                              <span className="text-[8px] opacity-60">{m.width}x{m.height} 유닛</span>
                           </div>
                        </div>
                        <ChevronRight size={12} className="opacity-30" />
                      </button>
                    ))
                  )}
                </div>
           </div>

           {/* 4. 바닥 마감 (Flooring) - 데코레이션 */}
           <div>
              <h3 className="text-[10px] font-black text-[#00f2ff]/50 uppercase tracking-[0.2em] mb-3 italic underline decoration-[#00f2ff]/20">바닥 마감 (Flooring)</h3>
              <div className="grid grid-cols-2 gap-2 mb-4">
                 {[
                   { id: 'floor_neon_border',    label: '네온 테두리', color: '#00f2ff' },
                   { id: 'floor_grid_dot',       label: '그리드 플레이트', color: '#333' },
                   { id: 'floor_premium_carpet', label: '퍼플 카펫', color: '#4b0082' },
                   { id: 'floor_wood',           label: '퓨처 우드', color: '#5d4037' },
                   { id: 'floor_metal',          label: '메탈 플레이트', color: '#78909c' },
                   { id: 'floor_glass',          label: '데이터 스트림', color: '#00bcd4' },
                 ].map(f => (
                   <button
                     key={f.id}
                     onClick={() => trySetBrush(f.id)}
                     className={`p-2 border-2 flex items-center gap-2 transition-all ${brush === f.id ? 'border-[#00f2ff] bg-[#00f2ff]/10' : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20'}`}
                   >
                     <div className="w-3 h-3 rounded-full" style={{ backgroundColor: f.color }} />
                     <span className="text-[9px] font-bold">{f.label}</span>
                   </button>
                 ))}
                 <button 
                   onClick={() => trySetBrush('floor_none')}
                   className={`p-2 border-2 border-dashed flex items-center gap-2 transition-all col-span-2 ${brush === 'floor_none' ? 'border-[#00f2ff] bg-[#00f2ff]/10' : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20'}`}
                 >
                    <div className="w-3 h-3 border border-white/20 rounded-full" />
                    <span className="text-[9px] font-bold italic">기본 바닥으로 초기화</span>
                 </button>
              </div>
           </div>
        </aside>

        {/* 에디터 메인 캔버스 영역 */}
        <main className="flex-1 bg-black relative flex items-center justify-center group cursor-crosshair">
           <div className="absolute inset-0 pointer-events-none border-[12px] border-[#151b2d] z-10" />
           <div className="w-full h-full relative">
              <GameCanvas />
              {/* 현재 활성화된 도구 표시기 */}
              <div className="absolute top-4 left-4 z-20 px-3 py-1 bg-[#00f2ff] text-[#0a1120] font-black text-[10px] uppercase italic">
                 활성 도구: {selectedModule ? `스탬프 [${selectedModule.toUpperCase()}]` : brush.toUpperCase()}
              </div>
           </div>
        </main>
      </div>
    </div>
  );
};

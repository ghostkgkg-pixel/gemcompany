import { useState, useEffect } from 'react';
import { MapService } from '../services/MapService';
import { AgentService } from '../services/AgentService';
import { AccountService } from '../services/AccountService';
import { CompanyService } from '../services/CompanyService';
import { useGameStore } from '../store/useGameStore';
import { Building, ArrowLeft } from 'lucide-react';

// 서브 컴포넌트들
import { MapSection } from './Lobby/MapSection';
import { StaffSection } from './Lobby/StaffSection';
import { ControlSection } from './Lobby/ControlSection';
import { MapEditorOverlay } from './Lobby/MapEditorOverlay';
import { HiringModal, ZoneModal, SaveMapModal } from './Lobby/LobbyModals';
import { UpgradeModal } from './UpgradeModal';

interface SetupPageProps {
  onStart: () => void; // 시뮬레이션 시작 핸들러
  onBack: () => void;  // 인트로 화면으로 돌아가기 핸들러
}

/**
 * 시뮬레이션 설정 페이지 컴포넌트 (로비)
 * 맵 선택, 에이전트 고용, 회사 관리 및 맵 에디터 기능을 제공함
 */
export function SetupPage({ onStart, onBack }: SetupPageProps) {
  // 로컬 상태 관리
  const [spawnDesc, setSpawnDesc] = useState('');     // 자율 생성 설명 텍스트
  const [isSpawning, setIsSpawning] = useState(false); // 생성/고용 진행 중 여부
  const [templates, setTemplates] = useState<any>(null); // 서버에서 받은 맵/회사 템플릿 데이터

  const [isEditingMap, setIsEditingMap] = useState(false); // 맵 에디터 활성화 여부
  const [isHiringModalOpen, setIsHiringModalOpen] = useState(false); // 고용 모달 오픈 여부

  // 고용 양식 상태
  const [hiringForm, setHiringForm] = useState({
    name: '', job: '', persona: '', body: 'body_light',
    hair_style: 'hair_short', hair_color: '#4B2C20', outfit: 'agent_dev', gender: 'male'
  });

  const [isSavingMap, setIsSavingMap] = useState(false); // 맵 저장 모달 오픈 여부
  const [mapName, setMapName] = useState('');           // 저장할 맵 이름

  // 구역(Zone) 생성 관련 상태
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [newZoneRange, setNewZoneRange] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneColor, setNewZoneColor] = useState('#3b82f6');

  // 전역 상태(Store) 바인딩
  const currentMap = useGameStore((state: any) => state.currentMap);
  const agentsObj = useGameStore((state: any) => state.agents);
  const agents = Object.values(agentsObj || {});
  const buildMode = useGameStore((state: any) => state.buildMode);
  const toggleBuildMode = useGameStore((state: any) => state.toggleBuildMode);
  const setSelectedTool = useGameStore((state: any) => state.setSelectedTool);
  const selectedTool = useGameStore((state: any) => state.selectedTool);
  const setShowUpgradeModal = useGameStore((state: any) => state.setShowUpgradeModal);

  // 초기 로드: 템플릿 및 구독 플랜 정보 조회
  useEffect(() => {
    fetchTemplates();
    fetchPlan();
  }, []);

  // 이벤트 리스너 및 브라우저 뒤로가기 제어
  useEffect(() => {
    // 맵 에디터에서 구역 선택 시 발생하는 커스텀 이벤트 처리
    const handleZoneSelection = (e: any) => {
      setNewZoneRange(e.detail);
      setIsZoneModalOpen(true);
    };
    
    // 브라우저 뒤로가기 버튼 처리: 에디터가 열려 있으면 에디터를 먼저 닫음
    const handlePopState = (e: any) => {
      if (isEditingMap) {
        setIsEditingMap(false);
        // 상태를 다시 밀어넣어 실제로 뒤로가기가 발생하지 않게 함
        window.history.pushState(null, '', window.location.href);
      }
    };

    window.addEventListener('zone-selected', handleZoneSelection);
    window.addEventListener('popstate', handlePopState);
    
    if (isEditingMap) {
      window.history.pushState(null, '', window.location.href);
    }

    return () => {
      window.removeEventListener('zone-selected', handleZoneSelection);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isEditingMap]); 

  // 컴포넌트 언마운트 시 클린업 (빌드 모드 해제 등)
  useEffect(() => {
    return () => {
      const { setMap, toggleBuildMode, buildMode } = useGameStore.getState();
      setMap(null);
      if (buildMode) toggleBuildMode();
      useGameStore.setState({ editorMode: 'company', selectedCompanyId: null });
    };
  }, []);

  // 구독 플랜 조회
  const fetchPlan = async () => {
    try {
      const data = await AccountService.getPlan();
      useGameStore.getState().setSubscriptionPlan(data.plan);
    } catch (err) {
      console.error("플랜 정보 조회 실패:", err);
    }
  };

  // 템플릿 및 회사 목록 조회
  const fetchTemplates = async () => {
    try {
      const data = await MapService.getTemplates();
      setTemplates(data);
      const comps = data.companies || {};
      useGameStore.getState().setCompanies(comps);
      
      const { selectedCompanyId, setMap, setSelectedCompanyId } = useGameStore.getState();
      // 선택된 회사가 없으면 첫 번째 회사를 자동으로 선택
      if (!selectedCompanyId && Object.keys(comps).length > 0) {
        const firstId = Object.keys(comps)[0];
        const firstComp = comps[firstId];
        setMap(firstComp);
        setSelectedCompanyId(firstId);
      }
    } catch (err) {
      console.error("템플릿 조회 실패:", err);
    }
  };

  // 에이전트 자율 생성 핸들러
  const handleSpawn = async () => {
    if (!spawnDesc.trim()) return;
    setIsSpawning(true);
    try {
      await AgentService.spawnAgent(spawnDesc);
      setSpawnDesc('');
    } catch (err) {
      console.error("자율 생성 실패:", err);
    } finally {
      setIsSpawning(false);
    }
  };

  // 에이전트 수동 고용 핸들러
  const handleHire = async () => {
    setIsSpawning(true);
    try {
      await AgentService.hireAgent(hiringForm);
      setIsHiringModalOpen(false);
      setHiringForm({
        name: '', job: '', persona: '', body: 'body_light',
        hair_style: 'hair_short', hair_color: '#4B2C20', outfit: 'agent_dev', gender: 'male'
      });
    } catch (err) {
      console.error("고용 실패:", err);
    } finally {
      setIsSpawning(false);
    }
  };

  // 맵 템플릿 선택 핸들러
  const handleSelectTemplate = async (id: string) => {
    const { setMap, setSelectedCompanyId } = useGameStore.getState();
    try {
      if (templates.defaults && templates.defaults[id]) {
        // 기본 템플릿으로 새 회사 생성
        const name = prompt("새 회사의 이름을 입력하세요:", templates.defaults[id].name);
        if (!name) return;
        const res = await CompanyService.createCompany(name, id);
        setMap(res.company);
        setSelectedCompanyId(res.company.id);
        fetchTemplates();
      } else if (templates.companies && templates.companies[id]) {
        // 기존에 저장된 회사/맵 선택
        const company = templates.companies[id];
        setMap(company);
        setSelectedCompanyId(company.id);
        await MapService.syncMapData(company);
      }
    } catch (err) {
      console.error("템플릿 선택 실패:", err);
    }
  };

  // 새 회사 설립 핸들러 (기본 템플릿 사용)
  const handleCreateNewCompany = async () => {
    if (!templates.defaults || Object.keys(templates.defaults).length === 0) {
      alert("사용 가능한 스타터 템플릿이 없습니다.");
      return;
    }
    
    // 첫 번째 기본 템플릿을 스타터로 사용
    const firstStarterId = Object.keys(templates.defaults)[0];
    await handleSelectTemplate(firstStarterId);
    
    // 생성이 성공적으로 되어 맵이 설정되었다면 바로 에디터 오픈
    if (useGameStore.getState().currentMap) {
      setIsEditingMap(true);
    }
  };

  // 저장된 맵 삭제 핸들러
  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm(`'${id}' 맵을 삭제하시겠습니까?`)) return;
    try {
      await MapService.deleteMap(id);
      await fetchTemplates();
    } catch (err) {
      console.error("맵 삭제 실패:", err);
    }
  };

  // '오피스 아키텍트' (회사 배치 수정) 모드 진입
  const enterOfficeArchitect = () => {
    const { selectedCompanyId, setMap } = useGameStore.getState();
    if (!selectedCompanyId) return;
    
    if (templates?.companies && templates.companies[selectedCompanyId]) {
      setMap(templates.companies[selectedCompanyId]);
    }
    
    useGameStore.setState({ editorMode: 'company', buildMode: true });
    setTimeout(() => setIsEditingMap(true), 0);
  };

  // '모듈 연구소' (독립 맵 생성) 모드 진입
  const enterModuleLab = () => {
    useGameStore.setState({ 
      editorMode: 'module', 
      buildMode: true,
      currentMap: {
        id: 'new_module',
        name: 'New Module',
        width: 12,
        height: 12,
        zone_data: Array.from({ length: 12 }, () => Array(12).fill('void')),
        zones: [],
        obstacles: []
      }
    });
    setTimeout(() => setIsEditingMap(true), 0);
  };

  // 맵 저장 처리 핸들러
  const handleSaveMap = async () => {
    const { editorMode, currentMap } = useGameStore.getState();
    
    try {
      if (editorMode === 'company') {
        // 회사 배치 상태 저장
        if (currentMap) {
          await MapService.syncMapData(currentMap);
          setIsEditingMap(false);
          alert("오피스 배치가 저장되었습니다!");
          fetchTemplates();
        }
      } else {
        // 독립 모듈로 저장
        if (!mapName.trim()) return;
        await MapService.saveMap(mapName);
        setIsSavingMap(false);
        setMapName('');
        alert("새 모듈이 저장되었습니다!");
        fetchTemplates();
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setShowUpgradeModal(true); // 플랜 업그레이드 유도
      } else {
        console.error("맵 저장 실패:", err);
      }
    }
  };

  // 구역(Zone) 추가 핸들러
  const handleAddZone = async () => {
    if (!newZoneName.trim() || !newZoneRange) return;
    try {
      const { x1, y1, x2, y2 } = newZoneRange;
      await MapService.addZone(newZoneName, x1, y1, x2, y2, newZoneColor);
      setIsZoneModalOpen(false);
      setNewZoneName('');
      const m = await MapService.getCurrentMap();
      useGameStore.getState().setMap(m);
    } catch (err) {
      console.error("구역 추가 실패:", err);
    }
  };

  // 구역(Zone) 제거 핸들러
  const handleRemoveZone = async (name: string) => {
    try {
      await MapService.removeZone(name);
      const m = await MapService.getCurrentMap();
      useGameStore.getState().setMap(m);
    } catch (err) {
      console.error("구역 제거 실패:", err);
    }
  };

  return (
    <div className="w-full h-screen bg-[#0a0f1e] flex flex-col font-['NeoDunggeunmo'] text-[#00f2ff] p-0 scanline-effect relative overflow-hidden">

      {/* 배경 앰비언스 */}
      <div className="absolute inset-0 opacity-10 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(#00f2ff_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      {/* 헤더 HUD */}
      <header className="h-16 border-b-2 border-[#00f2ff]/30 bg-black/80 backdrop-blur-md px-8 flex items-center justify-between z-50 flex-none">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <Building size={32} className="text-[#00f2ff] neon-text-intense" />
            <div className="flex flex-col">
              <h1 className="text-2xl font-black text-white tracking-tighter leading-none uppercase italic neon-text-intense">HQ 지휘 통제소</h1>
              <p className="text-[9px] font-bold text-[#00f2ff]/60 mt-0.5 uppercase tracking-widest italic">전략 작전 및 리소스 관리</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black text-green-500 uppercase tracking-widest animate-pulse">시스템 온라인</span>
            <span className="text-[7px] text-white/30 uppercase italic tracking-widest">액세스 키: OS-4492-X</span>
          </div>
          
          <button 
            onClick={onBack}
            className="px-6 py-2 border-2 border-red-500/50 text-red-500 font-black hover:bg-red-500 hover:text-white hover:border-red-500 transition-all text-xs uppercase tracking-[0.2em] italic rounded-lg flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:shadow-[0_0_25px_rgba(239,68,68,0.4)] group"
          >
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse group-hover:bg-white" />
            세션 종료
          </button>
        </div>
      </header>

      {/* 메인 3단 대시보드 그리드 */}
      <main className="flex-1 min-h-0 flex flex-col items-center justify-center py-4 px-10 overflow-hidden">
        <div className="w-full h-[96%] max-w-[1800px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.8fr_1fr] gap-10 items-stretch">
          {/* 1단: 맵 및 회사 관리 */}
          <MapSection
            templates={templates}
            currentMap={currentMap}
            handleSelectTemplate={handleSelectTemplate}
            handleDeleteTemplate={handleDeleteTemplate}
            setIsEditingMap={setIsEditingMap}
            buildMode={buildMode}
            toggleBuildMode={toggleBuildMode}
            enterOfficeArchitect={enterOfficeArchitect}
            enterModuleLab={enterModuleLab}
            handleCreateNewCompany={handleCreateNewCompany}
          />

          {/* 2단: 스태프 관리 (에이전트 목록) */}
          <StaffSection
            agents={agents}
            setIsHiringModalOpen={setIsHiringModalOpen}
          />

          {/* 3단: 지휘 통제 (명령 및 시작) */}
          <ControlSection
            spawnDesc={spawnDesc}
            setSpawnDesc={setSpawnDesc}
            handleSpawn={handleSpawn}
            isSpawning={isSpawning}
            currentMap={currentMap}
            agents={agents}
            onStart={onStart}
          />
        </div>
      </main>

      {/* 오버레이 및 모달 레이어 */}
      <MapEditorOverlay
        isOpen={isEditingMap} 
        onClose={() => {
          setIsEditingMap(false);
          const { selectedCompanyId, setMap } = useGameStore.getState();
          if (selectedCompanyId && templates?.companies && templates.companies[selectedCompanyId]) {
            setMap(templates.companies[selectedCompanyId]);
          } else {
            setMap(null);
          }
        }} 
        currentMap={currentMap}
        buildMode={buildMode} 
        toggleBuildMode={toggleBuildMode} 
        setBuildBrush={setSelectedTool}
        buildBrush={selectedTool} 
        handleSaveMap={() => {
          const { editorMode } = useGameStore.getState();
          if (editorMode === 'company') {
            handleSaveMap();
          } else {
            setIsSavingMap(true);
          }
        }}
        setIsZoneModalOpen={setIsZoneModalOpen} 
        handleRemoveZone={handleRemoveZone}
      />

      <HiringModal
        isOpen={isHiringModalOpen} onClose={() => setIsHiringModalOpen(false)}
        form={hiringForm} setForm={setHiringForm} onHire={handleHire} isSpawning={isSpawning}
      />

      <ZoneModal
        isOpen={isZoneModalOpen} onClose={() => { setIsZoneModalOpen(false); setNewZoneRange(null); }}
        name={newZoneName} setName={setNewZoneName} color={newZoneColor} setColor={setNewZoneColor}
        range={newZoneRange} onAdd={handleAddZone}
      />

      <SaveMapModal
        isOpen={isSavingMap} onClose={() => setIsSavingMap(false)}
        name={mapName} setName={setMapName} onSave={handleSaveMap}
      />

      <UpgradeModal />
    </div>
  );
}

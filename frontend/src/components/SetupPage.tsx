import { useState, useEffect } from 'react';
import { MapService } from '../services/MapService';
import { AgentService } from '../services/AgentService';
import { AccountService } from '../services/AccountService';
import { CompanyService } from '../services/CompanyService';
import { useGameStore } from '../store/useGameStore';
import { Building, ArrowLeft } from 'lucide-react';

// Sub-components
import { MapSection } from './Lobby/MapSection';
import { StaffSection } from './Lobby/StaffSection';
import { ControlSection } from './Lobby/ControlSection';
import { MapEditorOverlay } from './Lobby/MapEditorOverlay';
import { HiringModal, ZoneModal, SaveMapModal } from './Lobby/LobbyModals';
import { UpgradeModal } from './UpgradeModal';

interface SetupPageProps {
  onStart: () => void;
  onBack: () => void;
}

export function SetupPage({ onStart, onBack }: SetupPageProps) {
  const [spawnDesc, setSpawnDesc] = useState('');
  const [isSpawning, setIsSpawning] = useState(false);
  const [templates, setTemplates] = useState<any>(null);

  const [isEditingMap, setIsEditingMap] = useState(false);
  const [isHiringModalOpen, setIsHiringModalOpen] = useState(false);

  const [hiringForm, setHiringForm] = useState({
    name: '', job: '', persona: '', body: 'body_light',
    hair_style: 'hair_short', hair_color: '#4B2C20', outfit: 'agent_dev', gender: 'male'
  });

  const [isSavingMap, setIsSavingMap] = useState(false);
  const [mapName, setMapName] = useState('');

  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [newZoneRange, setNewZoneRange] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneColor, setNewZoneColor] = useState('#3b82f6');

  const currentMap = useGameStore((state: any) => state.currentMap);
  const agentsObj = useGameStore((state: any) => state.agents);
  const agents = Object.values(agentsObj || {});
  const buildMode = useGameStore((state: any) => state.buildMode);
  const toggleBuildMode = useGameStore((state: any) => state.toggleBuildMode);
  const setSelectedTool = useGameStore((state: any) => state.setSelectedTool);
  const selectedTool = useGameStore((state: any) => state.selectedTool);
  const setShowUpgradeModal = useGameStore((state: any) => state.setShowUpgradeModal);

  useEffect(() => {
    fetchTemplates();
    fetchPlan();
  }, []);

  useEffect(() => {
    // Add event listener for zone selection
    const handleZoneSelection = (e: any) => {
      setNewZoneRange(e.detail);
      setIsZoneModalOpen(true);
    };
    
    // Handle Browser Back Button: If editor is open, close it instead of going back
    const handlePopState = (e: any) => {
      if (isEditingMap) {
        setIsEditingMap(false);
        // Push state again to prevent actually going back
        window.history.pushState(null, '', window.location.href);
      }
    };

    window.addEventListener('zone-selected', handleZoneSelection);
    window.addEventListener('popstate', handlePopState);
    
    // Initialize pushState to allow capturing back button
    if (isEditingMap) {
      window.history.pushState(null, '', window.location.href);
    }

    return () => {
      window.removeEventListener('zone-selected', handleZoneSelection);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isEditingMap]); 

  // Dedicated cleanup on SetupPage unmount
  useEffect(() => {
    return () => {
      const { setMap, toggleBuildMode, buildMode } = useGameStore.getState();
      setMap(null);
      if (buildMode) toggleBuildMode();
      useGameStore.setState({ editorMode: 'company', selectedCompanyId: null });
    };
  }, []);

  const fetchPlan = async () => {
    try {
      const data = await AccountService.getPlan();
      useGameStore.getState().setSubscriptionPlan(data.plan);
    } catch (err) {
      console.error("Failed to fetch plan:", err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const data = await MapService.getTemplates();
      setTemplates(data);
      const comps = data.companies || {};
      useGameStore.getState().setCompanies(comps);
      
      const { selectedCompanyId, setMap, setSelectedCompanyId } = useGameStore.getState();
      if (!selectedCompanyId && Object.keys(comps).length > 0) {
        const firstId = Object.keys(comps)[0];
        const firstComp = comps[firstId];
        setMap(firstComp);
        setSelectedCompanyId(firstId);
      }
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    }
  };

  const handleSpawn = async () => {
    if (!spawnDesc.trim()) return;
    setIsSpawning(true);
    try {
      await spawnAgent(spawnDesc);
      setSpawnDesc('');
    } catch (err) {
      console.error("Spawn failed:", err);
    } finally {
      setIsSpawning(false);
    }
  };

  const handleHire = async () => {
    setIsSpawning(true);
    try {
      await hireAgent(hiringForm);
      setIsHiringModalOpen(false);
      setHiringForm({
        name: '', job: '', persona: '', body: 'body_light',
        hair_style: 'hair_short', hair_color: '#4B2C20', outfit: 'agent_dev', gender: 'male'
      });
    } catch (err) {
      console.error("Hire failed:", err);
    } finally {
      setIsSpawning(false);
    }
  };
  const handleSelectTemplate = async (id: string) => {
    const { setMap, setSelectedCompanyId } = useGameStore.getState();
    try {
      if (templates.defaults && templates.defaults[id]) {
        const name = prompt("새 회사의 이름을 입력하세요:", templates.defaults[id].name);
        if (!name) return;
        const res = await CompanyService.createCompany(name, id);
        setMap(res.company);
        setSelectedCompanyId(res.company.id);
        fetchTemplates();
      } else if (templates.companies && templates.companies[id]) {
        const company = templates.companies[id];
        setMap(company);
        setSelectedCompanyId(company.id);
        await MapService.syncMapData(company);
      }
    } catch (err) {
      console.error("Selection failed:", err);
    }
  };

  const scrollToStarters = () => {
    const el = document.getElementById('starter-templates');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm(`'${id}' 맵을 삭제하시겠습니까?`)) return;
    try {
      await deleteMap(id);
      await fetchTemplates();
    } catch (err) {
      console.error("Failed to delete map:", err);
    }
  };

  const enterOfficeArchitect = () => {
    const { selectedCompanyId, setMap } = useGameStore.getState();
    if (!selectedCompanyId) return;
    
    // Restore the company map from templates if it exists
    if (templates?.companies && templates.companies[selectedCompanyId]) {
      setMap(templates.companies[selectedCompanyId]);
    }
    
    useGameStore.setState({ editorMode: 'company', buildMode: true });
    setTimeout(() => setIsEditingMap(true), 0);
  };

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

  const handleSaveMap = async () => {
    const { editorMode, currentMap, setSelectedCompanyId } = useGameStore.getState();
    
    try {
      if (editorMode === 'company') {
        if (currentMap) {
          await axios.post('http://localhost:8000/map/sync', currentMap);
          setIsEditingMap(false);
          alert("오피스 배치가 저장되었습니다!");
          fetchTemplates();
        }
      } else {
        if (!mapName.trim()) return;
        await saveMap(mapName);
        setIsSavingMap(false);
        setMapName('');
        alert("새 모듈이 저장되었습니다!");
        fetchTemplates();
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setShowUpgradeModal(true);
      } else {
        console.error("Failed to save map:", err);
      }
    }
  };

  const handleAddZone = async () => {
    if (!newZoneName.trim() || !newZoneRange) return;
    try {
      const { x1, y1, x2, y2 } = newZoneRange;
      await axios.post('http://localhost:8000/map/zones/add', {
        name: newZoneName, x1, y1, x2, y2, color: newZoneColor
      });
      setIsZoneModalOpen(false);
      setNewZoneName('');
      const m = await getMapCurrent();
      useGameStore.getState().setMap(m);
    } catch (err) {
      console.error("Failed to add zone:", err);
    }
  };

  const handleRemoveZone = async (name: string) => {
    try {
      await axios.post('http://localhost:8000/map/zones/remove', { name });
      const m = await getMapCurrent();
      useGameStore.getState().setMap(m);
    } catch (err) {
      console.error("Failed to remove zone:", err);
    }
  };

  return (
    <div className="w-full h-screen bg-[#0a0f1e] flex flex-col font-['NeoDunggeunmo'] text-[#00f2ff] p-0 scanline-effect relative overflow-hidden">

      {/* Background Ambience */}
      <div className="absolute inset-0 opacity-10 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(#00f2ff_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

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

      <main className="flex-1 min-h-0 flex flex-col items-center justify-center py-4 px-10 overflow-hidden">
        <div className="w-full h-[96%] max-w-[1800px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.8fr_1fr] gap-10 items-stretch">
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
            scrollToStarters={scrollToStarters}
          />

          <StaffSection
            agents={agents}
            setIsHiringModalOpen={setIsHiringModalOpen}
          />

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

      {/* Overlay & Modals */}
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
            handleSaveMap(); // Syncs directly
          } else {
            setIsSavingMap(true); // Opens naming modal for module
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

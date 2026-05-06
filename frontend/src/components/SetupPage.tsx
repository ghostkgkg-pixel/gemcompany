import { useState, useEffect } from 'react';
import axios from 'axios';
import { spawnAgent, hireAgent, saveMap, deleteMap, getMapCurrent } from '../services/api';
import { useGameStore } from '../store/useGameStore';
import { Building, ArrowLeft } from 'lucide-react';

// Sub-components
import { MapSection } from './Lobby/MapSection';
import { StaffSection } from './Lobby/StaffSection';
import { ControlSection } from './Lobby/ControlSection';
import { MapEditorOverlay } from './Lobby/MapEditorOverlay';
import { HiringModal, ZoneModal, SaveMapModal } from './Lobby/LobbyModals';

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

  useEffect(() => {
    fetchTemplates();
    // Add event listener for zone selection from GameCanvas/MainScene
    const handleZoneSelection = (e: any) => {
      setNewZoneRange(e.detail);
      setIsZoneModalOpen(true);
    };
    window.addEventListener('zone-selected', handleZoneSelection);
    return () => window.removeEventListener('zone-selected', handleZoneSelection);
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await axios.get('http://localhost:8000/map/templates');
      setTemplates(response.data);
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
    try {
      const response = await axios.post(`http://localhost:8000/map/select/${id}`);
      // Backend returns the map directly
      useGameStore.getState().setMap(response.data);
    } catch (error) {
      console.error("Failed to change map:", error);
    }
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

  const handleSaveMap = async () => {
    if (!mapName.trim()) return;
    try {
      await saveMap(mapName);
      setIsSavingMap(false);
      setMapName('');
      await fetchTemplates();
    } catch (err) {
      console.error("Failed to save map:", err);
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
      <div className="absolute inset-0 opacity-20 pointer-events-none z-[0]">
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
        isOpen={isEditingMap} onClose={() => setIsEditingMap(false)} currentMap={currentMap}
        buildMode={buildMode} toggleBuildMode={toggleBuildMode} setBuildBrush={setSelectedTool}
        buildBrush={selectedTool} handleSaveMap={() => setIsSavingMap(true)}
        setIsZoneModalOpen={setIsZoneModalOpen} handleRemoveZone={handleRemoveZone}
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
    </div>
  );
}

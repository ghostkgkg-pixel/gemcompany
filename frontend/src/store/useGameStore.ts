import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface Agent {
  id: string;
  name: string;
  x: number;
  y: number;
  current_action: string;
  current_thought: string;
  current_speech: string;
  work_history?: string[];
  current_task?: {
    task_id: string;
    task_type: string;
    skill_id: string;
    summary: string;
    status: string;
  } | null;
  skill_profile?: {
    current_task_status?: string;
    preferred_skills?: string[];
  };
}

interface GameState {
  agents: Record<string, Agent>;
  currentMap: any;
  buildMode: boolean;
  selectedModuleInfo: { width: number, height: number } | null;
  subscriptionPlan: string;
  history: any[];
  setAgents: (agents: Agent[]) => void;
  updateAgent: (agentId: string, updates: Partial<Agent>) => void;
  setMap: (map: any) => void;
  toggleBuildMode: () => void;
  setSelectedTool: (tool: string) => void;
  setRotation: (rotation: number) => void;
  toggleFlipX: () => void;
  setSelectedModule: (module: string | null, info?: { width: number, height: number } | null) => void;
  setSubscriptionPlan: (plan: string) => void;
  pushHistory: (map: any) => void;
  undo: () => any; // Returns the map to be updated on backend
  moveBuffer: any | null;
  setMoveBuffer: (buffer: any | null) => void;
  isPremiumTool: (tool: string) => boolean;
  canUseFeature: (feature: string) => boolean;
  showUpgradeModal: boolean;
  setShowUpgradeModal: (open: boolean) => void;
  getPlanLimit: () => number;
  companies: Record<string, any>;
  setCompanies: (companies: Record<string, any>) => void;
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string | null) => void;
  editorMode: 'company' | 'module';
  setEditorMode: (mode: 'company' | 'module') => void;
}

export const useGameStore = create<GameState>()(
  subscribeWithSelector((set, get) => ({
    agents: {},
    currentMap: null,
    buildMode: false,
    selectedTool: 'obstacle_desk',
    selectedRotation: 0,
    selectedFlipX: false,
    selectedModule: null,
    selectedModuleInfo: null,
    subscriptionPlan: 'enterprise',
    history: [],
    moveBuffer: null,
    setAgents: (agentList) => {
      const agentMap = agentList.reduce((acc, agent) => ({ ...acc, [agent.id]: agent }), {});
      set({ agents: agentMap });
    },
    updateAgent: (agentId, updates) => set((state) => ({
      agents: {
        ...state.agents,
        [agentId]: { ...state.agents[agentId], ...updates }
      }
    })),
    setMap: (map) => set({ currentMap: map }),
    toggleBuildMode: () => set((state) => ({ buildMode: !state.buildMode })),
    setSelectedTool: (tool) => set({ selectedTool: tool }),
    setRotation: (rotation) => set({ selectedRotation: rotation }),
    toggleFlipX: () => set((state) => ({ selectedFlipX: !state.selectedFlipX })),
    setSelectedModule: (module, info = null) => set({ selectedModule: module, selectedModuleInfo: info }),
    setSubscriptionPlan: (plan) => set({ subscriptionPlan: plan }),
    pushHistory: (map) => {
      if (!map) return;
      const { history } = get();
      // Deep copy map and push to history, limit to 30
      const newHistory = [JSON.parse(JSON.stringify(map)), ...history.slice(0, 29)];
      set({ history: newHistory });
    },
    undo: () => {
      const { history } = get();
      if (history.length === 0) return null;
      const lastMap = history[0];
      set({ currentMap: lastMap, history: history.slice(1) });
      return lastMap;
    },
    setMoveBuffer: (buffer) => set({ moveBuffer: buffer }),
    isPremiumTool: (tool: string) => ["obstacle_server", "obstacle_plant"].includes(tool),
    canUseFeature: (feature: string) => {
      const { subscriptionPlan } = get();
      if (subscriptionPlan === 'enterprise') return true;
      if (subscriptionPlan === 'pro') return feature !== 'unlimited_agents';
      return !['premium_assets', 'large_map', 'unlimited_agents'].includes(feature);
    },
    showUpgradeModal: false,
    setShowUpgradeModal: (open: boolean) => set({ showUpgradeModal: open }),
    getPlanLimit: () => {
      const plan = get().subscriptionPlan;
      if (plan === 'enterprise') return 48;
      if (plan === 'pro') return 24;
      return 12;
    },
    companies: {},
    setCompanies: (companies) => set({ companies }),
    selectedCompanyId: null,
    setSelectedCompanyId: (id) => set({ selectedCompanyId: id }),
    editorMode: 'company',
    setEditorMode: (mode) => set({ editorMode: mode })
  }))
);

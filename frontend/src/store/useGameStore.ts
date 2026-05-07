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
  selectedModule: string | null;
  selectedModuleInfo: { width: number, height: number } | null;
  setAgents: (agents: Agent[]) => void;
  updateAgent: (agentId: string, updates: Partial<Agent>) => void;
  setMap: (map: any) => void;
  toggleBuildMode: () => void;
  setSelectedTool: (tool: string) => void;
  setRotation: (rotation: number) => void;
  toggleFlipX: () => void;
  setSelectedModule: (module: string | null, info?: { width: number, height: number } | null) => void;
}

export const useGameStore = create<GameState>()(
  subscribeWithSelector((set) => ({
    agents: {},
    currentMap: null,
    buildMode: false,
    selectedTool: 'obstacle_desk',
    selectedRotation: 0,
    selectedFlipX: false,
    selectedModule: null,
    selectedModuleInfo: null,
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
  }))
);

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
}

interface GameState {
  agents: Record<string, Agent>;
  currentMap: any;
  buildMode: boolean;
  selectedTool: string;
  setAgents: (agents: Agent[]) => void;
  updateAgent: (agentId: string, updates: Partial<Agent>) => void;
  setMap: (map: any) => void;
  toggleBuildMode: () => void;
  setSelectedTool: (tool: string) => void;
}

export const useGameStore = create<GameState>()(
  subscribeWithSelector((set) => ({
    agents: {},
    currentMap: null,
    buildMode: false,
    selectedTool: 'obstacle_desk',
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
  }))
);

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/** 에이전트(캐릭터) 데이터 구조 */
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

/** 전역 게임 상태 정의 */
interface GameState {
  // 상태(State)
  agents: Record<string, Agent>; // 모든 에이전트 정보 (ID 기반 맵)
  currentMap: any;              // 현재 렌더링 중인 맵 데이터
  buildMode: boolean;           // 빌드 모드 활성화 여부
  selectedTool: string;         // 현재 선택된 도구 (예: obstacle_desk)
  selectedRotation: number;     // 선택된 객체의 회전 값
  selectedFlipX: boolean;       // 선택된 객체의 좌우 반전 여부
  selectedModule: string | null; // 현재 선택된 모듈 ID
  selectedModuleInfo: { width: number, height: number } | null; // 모듈의 크기 정보
  subscriptionPlan: string;      // 현재 구독 플랜 (starter, pro, enterprise)
  history: any[];               // 맵 편집 히스토리 (Undo용)
  moveBuffer: any | null;       // 이동 도구 사용 시 임시 저장 공간
  showUpgradeModal: boolean;    // 업그레이드 모달 표시 여부
  companies: Record<string, any>; // 회사 정보들
  selectedCompanyId: string | null; // 선택된 회사 ID
  editorMode: 'company' | 'module'; // 편집기 모드

  // 액션(Actions)
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
  undo: () => any;
  setMoveBuffer: (buffer: any | null) => void;
  isPremiumTool: (tool: string) => boolean;
  canUseFeature: (feature: string) => boolean;
  setShowUpgradeModal: (open: boolean) => void;
  getPlanLimit: () => number;
  setCompanies: (companies: Record<string, any>) => void;
  setSelectedCompanyId: (id: string | null) => void;
  setEditorMode: (mode: 'company' | 'module') => void;
}

/** Zustand를 이용한 전역 게임 스토어 생성 */
export const useGameStore = create<GameState>()(
  subscribeWithSelector((set, get) => ({
    // 초기 상태값
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
    showUpgradeModal: false,
    companies: {},
    selectedCompanyId: null,
    editorMode: 'company',

    // 액션 구현
    /** 에이전트 목록 설정 (리스트를 ID 기반 맵으로 변환) */
    setAgents: (agentList) => {
      const agentMap = agentList.reduce((acc, agent) => ({ ...acc, [agent.id]: agent }), {});
      set({ agents: agentMap });
    },

    /** 특정 에이전트의 정보만 부분 업데이트 */
    updateAgent: (agentId, updates) => set((state) => ({
      agents: {
        ...state.agents,
        [agentId]: { ...state.agents[agentId], ...updates }
      }
    })),

    /** 현재 맵 데이터 설정 */
    setMap: (map) => set({ currentMap: map }),

    /** 빌드 모드 켜기/끄기 토글 */
    toggleBuildMode: () => set((state) => ({ buildMode: !state.buildMode })),

    /** 편집 도구 선택 */
    setSelectedTool: (tool) => set({ selectedTool: tool }),

    /** 객체 회전값 설정 */
    setRotation: (rotation) => set({ selectedRotation: rotation }),

    /** 객체 좌우 반전 토글 */
    toggleFlipX: () => set((state) => ({ selectedFlipX: !state.selectedFlipX })),

    /** 편집할 모듈 선택 및 정보 설정 */
    setSelectedModule: (module, info = null) => set({ selectedModule: module, selectedModuleInfo: info }),

    /** 구독 플랜 변경 */
    setSubscriptionPlan: (plan) => set({ subscriptionPlan: plan }),

    /** 현재 맵 상태를 히스토리에 기록 (최대 30개) */
    pushHistory: (map) => {
      if (!map) return;
      const { history } = get();
      const newHistory = [JSON.parse(JSON.stringify(map)), ...history.slice(0, 29)];
      set({ history: newHistory });
    },

    /** 마지막 작업을 취소하고 이전 맵 상태로 복구 */
    undo: () => {
      const { history } = get();
      if (history.length === 0) return null;
      const lastMap = history[0];
      set({ currentMap: lastMap, history: history.slice(1) });
      return lastMap;
    },

    /** 이동 도구 사용 시 객체 버퍼 설정 */
    setMoveBuffer: (buffer) => set({ moveBuffer: buffer }),

    /** 선택된 도구가 유료 전용인지 확인 */
    isPremiumTool: (tool: string) => ["obstacle_server", "obstacle_plant"].includes(tool),

    /** 현재 플랜에서 특정 기능을 사용할 수 있는지 체크 */
    canUseFeature: (feature: string) => {
      const { subscriptionPlan } = get();
      if (subscriptionPlan === 'enterprise') return true;
      if (subscriptionPlan === 'pro') return feature !== 'unlimited_agents';
      return !['premium_assets', 'large_map', 'unlimited_agents'].includes(feature);
    },

    /** 업그레이드 유도 모달 표시 제어 */
    setShowUpgradeModal: (open: boolean) => set({ showUpgradeModal: open }),

    /** 현재 플랜의 에이전트 수용 한도 반환 */
    getPlanLimit: () => {
      const plan = get().subscriptionPlan;
      if (plan === 'enterprise') return 48;
      if (plan === 'pro') return 24;
      return 12;
    },

    /** 전체 회사 목록 설정 */
    setCompanies: (companies) => set({ companies }),

    /** 특정 회사 선택 */
    setSelectedCompanyId: (id) => set({ selectedCompanyId: id }),

    /** 편집기 모드(회사 전체 vs 개별 모듈) 전환 */
    setEditorMode: (mode) => set({ editorMode: mode })
  }))
);

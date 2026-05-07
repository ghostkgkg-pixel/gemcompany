import axios from 'axios';

const API_BASE = 'http://localhost:8000';

export const AgentService = {
  async listAgents() {
    const res = await axios.get(`${API_BASE}/agents`);
    return res.data;
  },

  async spawnAgent(description: string) {
    const res = await axios.post(`${API_BASE}/agents/spawn?description=${encodeURIComponent(description)}`);
    return res.data;
  },

  async hireAgent(agentData: any) {
    const res = await axios.post(`${API_BASE}/agents/hire`, agentData);
    return res.data;
  },

  async fireAgent(agentId: string) {
    const res = await axios.delete(`${API_BASE}/agents/${agentId}`);
    return res.data;
  },

  async chatWithAgent(agentId: string, message: string) {
    const res = await axios.post(`${API_BASE}/agents/${agentId}/chat?message=${encodeURIComponent(message)}`);
    return res.data;
  },

  async moveAgent(agentId: string, x: number, y: number) {
    const res = await axios.post(`${API_BASE}/agents/${agentId}/move?x=${x}&y=${y}`);
    return res.data;
  }
};

import axios from 'axios';

const API_BASE = 'http://localhost:8000';

export const getMapCurrent = async () => {
  const response = await axios.get(`${API_BASE}/map/current`);
  return response.data;
};

export const getAgents = async () => {
  const response = await axios.get(`${API_BASE}/agents`);
  return response.data;
};

export const spawnAgent = async (description: string) => {
  const response = await axios.post(`${API_BASE}/agents/spawn?description=${encodeURIComponent(description)}`);
  return response.data;
};

export const moveAgent = async (agentId: string, x: number, y: number) => {
  const response = await axios.post(`${API_BASE}/agents/${agentId}/move?x=${x}&y=${y}`);
  return response.data;
};

export const chatWithAgent = async (agentId: string, message: string) => {
  const response = await axios.post(`${API_BASE}/agents/${agentId}/chat?message=${encodeURIComponent(message)}`);
  return response.data;
};

export const placeObstacle = async (x: number, y: number, type: string) => {
  const response = await axios.post(`${API_BASE}/map/obstacles/place`, null, { params: { x, y, type } });
  return response.data;
};

export const removeObstacle = async (x: number, y: number) => {
  const response = await axios.post(`${API_BASE}/map/obstacles/remove`, null, { params: { x, y } });
  return response.data;
};

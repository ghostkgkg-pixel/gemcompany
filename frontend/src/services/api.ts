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

export const hireAgent = async (data: { name: string, job: string, persona: string, body: string, hair_style: string, hair_color: string, outfit: string, gender: string }) => {
  const params = new URLSearchParams(data as any).toString();
  const response = await axios.post(`${API_BASE}/agents/hire?${params}`);
  return response.data;
};

export const moveAgent = async (agentId: string, x: number, y: number) => {
  const response = await axios.post(`${API_BASE}/agents/${agentId}/move?x=${x}&y=${y}`);
  return response.data;
};

export const chatWithAgent = async (agentId: string, message: string) => {
  const res = await axios.post(`${API_BASE}/agents/${agentId}/chat`, null, { params: { message } });
  return res.data;
};

export const fireAgent = async (agentId: string) => {
  const res = await axios.delete(`${API_BASE}/agents/${agentId}`);
  return res.data;
};

export const placeObstacle = async (x: number, y: number, type: string, rotation: number = 0, flipX: boolean = false) => {
  const response = await axios.post(`${API_BASE}/map/obstacles/place?x=${x}&y=${y}&type=${type}&rotation=${rotation}&flip_x=${flipX}`);
  return response.data;
};

export const removeObstacle = async (x: number, y: number) => {
  const response = await axios.post(`${API_BASE}/map/obstacles/remove?x=${x}&y=${y}`);
  return response.data;
};

export const setZoneTile = async (x: number, y: number, zoneType: string) => {
  const response = await axios.post(`${API_BASE}/map/zones/set?x=${x}&y=${y}&zone_type=${zoneType}`);
  return response.data;
};

export const mergeMap = async (sourceName: string, targetX: number, targetY: number) => {
  const response = await axios.post(`${API_BASE}/map/merge?source_name=${encodeURIComponent(sourceName)}&target_x=${targetX}&target_y=${targetY}`);
  return response.data;
};

export const saveMap = async (name: string) => {
  const response = await axios.post(`${API_BASE}/map/save?name=${encodeURIComponent(name)}`);
  return response.data;
};

export const deleteMap = async (name: string) => {
  const response = await axios.post(`${API_BASE}/map/delete/${encodeURIComponent(name)}`);
  return response.data;
};

export const addZone = async (name: string, x1: number, y1: number, x2: number, y2: number, color: string) => {
  const response = await axios.post(`${API_BASE}/map/zones/add?name=${encodeURIComponent(name)}&x1=${x1}&y1=${y1}&x2=${x2}&y2=${y2}&color=${encodeURIComponent(color)}`);
  return response.data;
};

export const getMapTemplates = async () => {
  const response = await axios.get(`${API_BASE}/map/templates`);
  return response.data;
};

export const removeZone = async (name: string) => {
  const response = await axios.post(`${API_BASE}/map/zones/remove?name=${encodeURIComponent(name)}`);
  return response.data;
};

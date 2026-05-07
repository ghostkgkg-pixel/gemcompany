import axios from 'axios';

const API_BASE = 'http://localhost:8000';

export const MapService = {
  async getCurrentMap() {
    const res = await axios.get(`${API_BASE}/map/current`);
    return res.data;
  },

  async getTemplates() {
    const res = await axios.get(`${API_BASE}/map/templates`);
    return res.data;
  },

  async saveMap(name: string) {
    const res = await axios.post(`${API_BASE}/map/save?name=${encodeURIComponent(name)}`);
    return res.data;
  },

  async deleteMap(name: string) {
    const res = await axios.post(`${API_BASE}/map/delete/${encodeURIComponent(name)}`);
    return res.data;
  },

  async placeObstacle(x: number, y: number, type: string, rotation: number = 0, flipX: boolean = false) {
    const res = await axios.post(`${API_BASE}/map/obstacles/place?x=${x}&y=${y}&type=${type}&rotation=${rotation}&flip_x=${flipX}`);
    return res.data;
  },

  async removeObstacle(x: number, y: number) {
    const res = await axios.post(`${API_BASE}/map/obstacles/remove?x=${x}&y=${y}`);
    return res.data;
  },

  async setZoneTile(x: number, y: number, zoneType: string) {
    const res = await axios.post(`${API_BASE}/map/zones/set?x=${x}&y=${y}&zone_type=${zoneType}`);
    return res.data;
  },

  async addZone(name: string, x1: number, y1: number, x2: number, y2: number, color: string) {
    const res = await axios.post(`${API_BASE}/map/zones/add?name=${encodeURIComponent(name)}&x1=${x1}&y1=${y1}&x2=${x2}&y2=${y2}&color=${encodeURIComponent(color)}`);
    return res.data;
  },

  async removeZone(name: string) {
    const res = await axios.post(`${API_BASE}/map/zones/remove?name=${encodeURIComponent(name)}`);
    return res.data;
  },

  async syncMapData(mapData: any) {
    const res = await axios.post(`${API_BASE}/map/sync`, mapData);
    return res.data;
  },

  async mergeMap(sourceName: string, targetX: number, targetY: number) {
    const res = await axios.post(`${API_BASE}/map/merge?source_name=${encodeURIComponent(sourceName)}&target_x=${targetX}&target_y=${targetY}`);
    return res.data;
  },

  async mergeMapRawData(source: any, targetX: number, targetY: number) {
    const res = await axios.post(`${API_BASE}/map/merge_data?target_x=${targetX}&target_y=${targetY}`, source);
    return res.data;
  },

  async assignObstacle(x: number, y: number, agentId: string | null) {
    const url = `${API_BASE}/map/obstacles/assign?x=${x}&y=${y}${agentId ? `&agent_id=${agentId}` : ''}`;
    const res = await axios.post(url);
    return res.data;
  }
};

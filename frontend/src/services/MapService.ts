import axios from 'axios';

/** 백엔드 API 기본 주소 */
const API_BASE = 'http://localhost:8000';

/** 맵 데이터 관련 API 통신 서비스 */
export const MapService = {
  /** 현재 맵 상태 가져오기 */
  async getCurrentMap() {
    const res = await axios.get(`${API_BASE}/map/current`);
    return res.data;
  },

  /** 맵 템플릿 목록 가져오기 */
  async getTemplates() {
    const res = await axios.get(`${API_BASE}/map/templates`);
    return res.data;
  },

  /** 현재 맵을 지정된 이름으로 서버에 저장 */
  async saveMap(name: string) {
    const res = await axios.post(`${API_BASE}/map/save?name=${encodeURIComponent(name)}`);
    return res.data;
  },

  /** 저장된 맵 삭제 */
  async deleteMap(name: string) {
    const res = await axios.post(`${API_BASE}/map/delete/${encodeURIComponent(name)}`);
    return res.data;
  },

  /** 특정 좌표에 장애물(가구) 배치 */
  async placeObstacle(x: number, y: number, type: string, rotation: number = 0, flipX: boolean = false) {
    const res = await axios.post(`${API_BASE}/map/obstacles/place?x=${x}&y=${y}&type=${type}&rotation=${rotation}&flip_x=${flipX}`);
    return res.data;
  },

  /** 특정 좌표의 장애물 제거 */
  async removeObstacle(x: number, y: number) {
    const res = await axios.post(`${API_BASE}/map/obstacles/remove?x=${x}&y=${y}`);
    return res.data;
  },

  /** 특정 좌표의 타일 존(Zone) 타입 설정 */
  async setZoneTile(x: number, y: number, zoneType: string) {
    const res = await axios.post(`${API_BASE}/map/zones/set?x=${x}&y=${y}&zone_type=${zoneType}`);
    return res.data;
  },

  /** 영역(Rect) 단위로 존 추가 */
  async addZone(name: string, x1: number, y1: number, x2: number, y2: number, color: string) {
    const res = await axios.post(`${API_BASE}/map/zones/add`, { name, x1, y1, x2, y2, color });
    return res.data;
  },

  /** 존 삭제 */
  async removeZone(name: string) {
    const res = await axios.post(`${API_BASE}/map/zones/remove`, { name });
    return res.data;
  },

  /** 클라이언트의 맵 데이터를 서버와 강제 동기화 */
  async syncMapData(mapData: any) {
    const res = await axios.post(`${API_BASE}/map/sync`, mapData);
    return res.data;
  },

  /** 다른 맵 파일을 현재 맵의 특정 위치에 병합 */
  async mergeMap(sourceName: string, targetX: number, targetY: number) {
    const res = await axios.post(`${API_BASE}/map/merge?source_name=${encodeURIComponent(sourceName)}&target_x=${targetX}&target_y=${targetY}`);
    return res.data;
  },

  /** 원본 데이터를 현재 맵의 특정 위치에 직접 병합 */
  async mergeMapRawData(source: any, targetX: number, targetY: number) {
    const res = await axios.post(`${API_BASE}/map/merge_data?target_x=${targetX}&target_y=${targetY}`, source);
    return res.data;
  },

  /** 특정 장애물(책상 등)을 특정 에이전트의 소유로 할당 */
  async assignObstacle(x: number, y: number, agentId: string | null) {
    const url = `${API_BASE}/map/obstacles/assign?x=${x}&y=${y}${agentId ? `&agent_id=${agentId}` : ''}`;
    const res = await axios.post(url);
    return res.data;
  }
};

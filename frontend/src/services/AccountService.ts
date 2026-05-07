import axios from 'axios';

const API_BASE = 'http://localhost:8000';

export const AccountService = {
  async getPlan() {
    const res = await axios.get(`${API_BASE}/account/plan`);
    return res.data;
  },

  async upgradePlan(plan: string) {
    const res = await axios.post(`${API_BASE}/account/plan/upgrade?plan=${plan}`);
    return res.data;
  }
};

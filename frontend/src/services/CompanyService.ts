import axios from 'axios';

const API_BASE = 'http://localhost:8000';

export const CompanyService = {
  async createCompany(name: string, templateId: string) {
    const res = await axios.post(`${API_BASE}/company/create?name=${encodeURIComponent(name)}&template_id=${templateId}`);
    return res.data;
  }
};

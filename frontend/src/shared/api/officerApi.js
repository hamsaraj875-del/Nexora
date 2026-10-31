import { apiClient } from './client';

export const officerApi = {
  // Dashboard
  getDashboard: async () => {
    const res = await apiClient.get('/officer/dashboard');
    return res.data;
  },
  getSummary: async () => {
    const res = await apiClient.get('/officer/dashboard/summary');
    return res.data;
  },
  getBureauWorkload: async () => {
    const res = await apiClient.get('/officer/dashboard/bureau-workload');
    return res.data;
  },
  getInstitutionStatus: async () => {
    const res = await apiClient.get('/officer/dashboard/institution-status');
    return res.data;
  },

  // Cases
  getCases: async (params = {}) => {
    const res = await apiClient.get('/officer/cases', { params });
    return res.data;
  },
  getCaseById: async (id) => {
    const res = await apiClient.get(`/officer/cases/${id}`);
    return res.data;
  },
  getCaseHistory: async (id) => {
    const res = await apiClient.get(`/officer/cases/${id}/history`);
    return res.data;
  },
  assignCase: async (id, data) => {
    const res = await apiClient.post(`/officer/cases/${id}/assign`, data);
    return res.data;
  },
  escalateCase: async (id, data) => {
    const res = await apiClient.post(`/officer/cases/${id}/escalate`, data);
    return res.data;
  },
  linkCases: async (data) => {
    const res = await apiClient.post('/officer/cases/link', data);
    return res.data;
  },

  // Overlaps
  getOverlaps: async (params = {}) => {
    const res = await apiClient.get('/officer/overlaps', { params });
    return res.data;
  },
  getOverlapById: async (id) => {
    const res = await apiClient.get(`/officer/overlaps/${id}`);
    return res.data;
  },
  getOverlapExplanations: async (id) => {
  const res = await apiClient.get(
    `/officer/overlaps/${id}/explanations`
  );
  return res.data;
  },
  resolveOverlap: async (id, data) => {
    const res = await apiClient.post(`/officer/overlaps/${id}/resolve`, data);
    return res.data;
  },
  linkOverlapCases: async (data) => {
    const res = await apiClient.post('/officer/overlaps/link', data);
    return res.data;
  },

  // Match Review
  getMatchReviewQueue: async () => {
    const res = await apiClient.get('/officer/match-review');
    return res.data;
  },
  confirmMatch: async (caseId, data) => {
    const res = await apiClient.post(`/officer/match-review/${caseId}/confirm`, data);
    return res.data;
  },
  rejectMatch: async (caseId, data = {}) => {
    const res = await apiClient.post(`/officer/match-review/${caseId}/reject`, data);
    return res.data;
  },

  // Alerts
  getAlerts: async () => {
    const res = await apiClient.get('/officer/alerts');
    return res.data;
  },
  markAlertRead: async (id) => {
    const res = await apiClient.post(`/officer/alerts/${id}/read`);
    return res.data;
  },

  // Reports
  getReportData: async (type, params = {}) => {
    const res = await apiClient.get(`/officer/reports/${type}`, { params });
    return res.data;
  },
  exportReportFile: async (type, format = 'csv', period = '') => {
    const res = await apiClient.get(`/officer/reports/${type}`, {
      params: { format, period },
      responseType: 'blob',
    });
    return res.data;
  },

  // Institutions
  getInstitutions: async (params = {}) => {
    const res = await apiClient.get('/officer/institutions', { params });
    return res.data;
  },
  getInstitutionById: async (id) => {
    const res = await apiClient.get(`/officer/institutions/${id}`);
    return res.data;
  },

  // Administration & Bureaus
  getSlaRules: async () => {
    const res = await apiClient.get('/officer/admin/sla-rules');
    return res.data;
  },
  updateSlaRule: async (data) => {
    const res = await apiClient.put('/officer/admin/sla-rules', data);
    return res.data;
  },
  getUsers: async () => {
    const res = await apiClient.get('/officer/admin/users');
    return res.data;
  },
  getBureaus: async () => {
    const res = await apiClient.get('/officer/bureaus');
    return res.data;
  },
};

export default officerApi;


import { apiClient } from './client';

export const bureauApi = {
  // Dashboard
  getDashboard: async () => {
    const res = await apiClient.get('/bureau/dashboard');
    return res.data;
  },

  // Cases (Scoped strictly to user's bureau)
  getCases: async (params = {}) => {
    const res = await apiClient.get('/bureau/cases', { params });
    return res.data;
  },

  getCaseById: async (id) => {
    const res = await apiClient.get(`/bureau/cases/${id}`);
    return res.data;
  },

  getCaseHistory: async (id) => {
    const res = await apiClient.get(`/bureau/cases/${id}/history`);
    return res.data;
  },

  updateCaseStatus: async (id, data) => {
    const res = await apiClient.patch(`/bureau/cases/${id}/status`, data);
    return res.data;
  },

  addCaseAction: async (id, data) => {
    const res = await apiClient.post(`/bureau/cases/${id}/actions`, data);
    return res.data;
  },

  requestInfo: async (id, data) => {
    const res = await apiClient.post(`/bureau/cases/${id}/request-info`, data);
    return res.data;
  },

  transferCase: async (id, data) => {
    const res = await apiClient.post(`/bureau/cases/${id}/transfer`, data);
    return res.data;
  },

  escalateCase: async (id, data) => {
    const res = await apiClient.post(`/bureau/cases/${id}/escalate`, data);
    return res.data;
  },

  // Overlaps (Read-only, my bureau)
  getOverlaps: async () => {
    const res = await apiClient.get('/bureau/overlaps');
    return res.data;
  },
  getOverlapExplanations: async (id) => {
  const res = await apiClient.get(`/bureau/overlaps/${id}/explanations`);
  return res.data;
},

  getOverlapCaseReadOnly: async (caseId) => {
    const res = await apiClient.get(`/bureau/overlaps/cases/${caseId}`);
    return res.data;
  },

  // Import & Data Sync (bureau_officer & data_operator)
  uploadBulkFile: async (formData) => {
    const res = await apiClient.post('/bureau/import/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  runManualSync: async () => {
    const res = await apiClient.post('/bureau/import/sync/run');
    return res.data;
  },

  // Alerts
  getAlerts: async () => {
    const res = await apiClient.get('/bureau/alerts');
    return res.data;
  },

  markAlertRead: async (id) => {
    const res = await apiClient.post(`/bureau/alerts/${id}/read`);
    return res.data;
  },

  // Match Review (data_operator & bureau_officer)
  getMatchReviewQueue: async () => {
    const res = await apiClient.get('/bureau/match-review');
    return res.data;
  },

  confirmMatch: async (caseId, data) => {
    const res = await apiClient.post(`/bureau/match-review/${caseId}/confirm`, data);
    return res.data;
  },

  rejectMatch: async (caseId, data = {}) => {
    const res = await apiClient.post(`/bureau/match-review/${caseId}/reject`, data);
    return res.data;
  },

  // Bureau helper for transfers
  getBureaus: async () => {
    const res = await apiClient.get('/bureau/bureaus');
    return res.data;
  },
};

export default bureauApi;

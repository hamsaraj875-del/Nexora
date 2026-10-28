import axios from 'axios';

//const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const baseURL = 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor: attach JWT token from localStorage
apiClient.interceptors.request.use(
  (config) => {
    //const token = localStorage.getItem('token');
    const token =
      localStorage.getItem('officer_token') ||
      localStorage.getItem('bureau_token') ||
      localStorage.getItem('student_token') ||
      localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: redirect to /login on 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// --- Auth Endpoints ---
export const authApi = {
  login: async (credentials) => {
    // credentials: { email, password }
    const response = await apiClient.post('/auth/login', credentials);
    return response.data;
  },
  getMe: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
};

// --- Dashboard Endpoints ---
export const dashboardApi = {
  getSummary: async () => {
    const response = await apiClient.get('/dashboard/summary');
    return response.data;
  },
  getBureauWorkload: async () => {
    const response = await apiClient.get('/dashboard/bureau-workload');
    return response.data;
  },
  getInstitutionStatus: async () => {
    const response = await apiClient.get('/dashboard/institution-status');
    return response.data;
  },
  getMonthlyTrends: async () => {
    const response = await apiClient.get('/dashboard/monthly-trends');
    return response.data;
  },
};

// --- Cases Endpoints ---
export const casesApi = {
  getCases: async (params = {}) => {
    // params: q, aicteId, caseId, bureau, region, category, status, dateFrom, dateTo, page, limit, institution
    const response = await apiClient.get('/cases', { params });
    return response.data;
  },
  getCaseById: async (id) => {
    const response = await apiClient.get(`/cases/${id}`);
    return response.data;
  },
  getCaseHistory: async (id) => {
    const response = await apiClient.get(`/cases/${id}/history`);
    return response.data;
  },
  updateCase: async (id, data) => {
    // data: { status, assignedOfficer, nextActionText, expectedDisposalDate, remarks }
    const response = await apiClient.patch(`/cases/${id}`, data);
    return response.data;
  },
  addCaseAction: async (id, data) => {
    // data: { actionType, remarks, attachmentUrl }
    const response = await apiClient.post(`/cases/${id}/actions`, data);
    return response.data;
  },
  transferCase: async (id, data) => {
    // data: { targetBureauId, remarks }
    const response = await apiClient.post(`/cases/${id}/transfer`, data);
    return response.data;
  },
  escalateCase: async (id, data) => {
    // data: { remarks }
    const response = await apiClient.post(`/cases/${id}/escalate`, data);
    return response.data;
  },
  linkCases: async (data) => {
    // data: { caseAId, caseBId, linkType, remarks }
    const response = await apiClient.post('/cases/link', data);
    return response.data;
  },
  createCase: async (data) => {
    const response = await apiClient.post('/cases', data);
    return response.data;
  },
};

// --- Institutions Endpoints ---
export const institutionsApi = {
  getInstitutions: async (params = {}) => {
    // params: { q, region, state, limit }
    const response = await apiClient.get('/institutions', { params });
    return response.data;
  },
  getInstitutionById: async (id) => {
    const response = await apiClient.get(`/institutions/${id}`);
    return response.data;
  },
};

// --- Overlaps Endpoints ---
export const overlapsApi = {
  getOverlaps: async (params = {}) => {
    // params: { status: 'open' | 'coordinated' | 'dismissed' }
    const response = await apiClient.get('/overlaps', { params });
    return response.data;
  },
  getOverlapById: async (id) => {
    const response = await apiClient.get(`/overlaps/${id}`);
    return response.data;
  },
  resolveOverlap: async (id, data) => {
    // data: { status: 'coordinated' | 'dismissed', remarks }
    const response = await apiClient.post(`/overlaps/${id}/resolve`, data);
    return response.data;
  },
};

// --- Alerts Endpoints ---
export const alertsApi = {
  getAlerts: async () => {
    const response = await apiClient.get('/alerts');
    return response.data;
  },
  markAlertRead: async (id) => {
    const response = await apiClient.post(`/alerts/${id}/read`);
    return response.data;
  },
};

// --- Match Review Endpoints ---
export const matchReviewApi = {
  getQueue: async () => {
    const response = await apiClient.get('/match-review');
    return response.data;
  },
  confirmMatch: async (caseId, data) => {
    // data: { institutionId, remarks }
    const response = await apiClient.post(`/match-review/${caseId}/confirm`, data);
    return response.data;
  },
};

// --- Import & Sync Endpoints ---
export const importSyncApi = {
  uploadBulkFile: async (formData) => {
    // formData with 'file' and 'sourceBureau'
    const response = await apiClient.post('/import/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  runManualSync: async () => {
    const response = await apiClient.post('/import/sync/run');
    return response.data;
  },
};

// --- Reports Endpoints ---
export const reportsApi = {
  getReportData: async (type, params = {}) => {
    // type: bureau | region | ageing | disposal-rate
    // params: { period, format: 'json' }
    const response = await apiClient.get(`/reports/${type}`, { params });
    return response.data;
  },
  exportReportFile: async (type, format = 'csv', period = '') => {
    const response = await apiClient.get(`/reports/${type}`, {
      params: { format, period },
      responseType: 'blob',
    });
    return response.data;
  },
};

// --- Admin Endpoints ---
export const adminApi = {
  getSlaRules: async () => {
    const response = await apiClient.get('/admin/sla-rules');
    return response.data;
  },
  updateSlaRule: async (data) => {
    // data: { category, daysToDispose, reminderAfterDays, dueSoonDays, escalateAfterDaysOverdue }
    const response = await apiClient.put('/admin/sla-rules', data);
    return response.data;
  },
  getUsers: async () => {
    const response = await apiClient.get('/admin/users');
    return response.data;
  },
  getBureaus: async () => {
    const response = await apiClient.get('/admin/bureaus');
    return response.data;
  },
};

export default apiClient;

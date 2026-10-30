import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

/**
 * Detects the active portal based on the request URL and/or browser location
 * @param {string} url - The request endpoint URL
 * @returns {'officer' | 'bureau'}
 */
export const detectPortal = (url = '') => {
  const cleanUrl = (url || '').toLowerCase();
  const pathname = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';

  if (cleanUrl.includes('/officer') || pathname.startsWith('/officer')) return 'officer';
  if (cleanUrl.includes('/bureau') || pathname.startsWith('/bureau')) return 'bureau';

  // Fallback: check which token exists
  if (typeof localStorage !== 'undefined') {
    if (localStorage.getItem('officer_token')) return 'officer';
    if (localStorage.getItem('bureau_token')) return 'bureau';
  }

  return 'officer';
};

/**
 * Check if a request URL is an auth endpoint that does NOT need a token attached.
 */
const isAuthEndpoint = (url = '') => {
  const cleanUrl = (url || '').toLowerCase();
  return cleanUrl.includes('/auth/login') || cleanUrl.includes('/auth/register');
};

/**
 * Extract the portal directly from a portal-scoped API URL (e.g. /officer/*, /bureau/*, /student/*).
 * Returns null if the URL is not portal-scoped (e.g. /auth/login).
 */
const portalFromApiUrl = (url = '') => {
  const cleanUrl = (url || '').toLowerCase();
  if (cleanUrl.includes('/officer')) return 'officer';
  if (cleanUrl.includes('/bureau')) return 'bureau';
  return null;
};

// Request interceptor: attach token by active portal, but skip auth endpoints
apiClient.interceptors.request.use(
  (config) => {
    // Don't attach tokens to login/register requests — they don't need auth
    if (isAuthEndpoint(config.url)) {
      return config;
    }

    const portal = detectPortal(config.url);
    const tokenKey = `${portal}_token`;
    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem(tokenKey);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: on 401, only clear tokens for portal-scoped API calls
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Only auto-clear tokens and redirect for portal-scoped API calls,
      // NOT for auth endpoints like login (where a 401 is just "wrong password")
      const requestUrl = error.config?.url || '';
      const portal = portalFromApiUrl(requestUrl);

      if (portal) {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(`${portal}_token`);
          localStorage.removeItem(`${portal}_user`);
        }

        const targetLogin = `/${portal}/login`;
        if (typeof window !== 'undefined' && window.location.pathname !== targetLogin) {
          window.location.href = targetLogin;
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;


import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// No interceptors — used for auth calls that must not have the access token injected
const rawApi = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Helper: read from localStorage first, fall back to sessionStorage
function getStoredItem(key) {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

// Request interceptor to add auth headers
api.interceptors.request.use(
  (config) => {
    const userType = getStoredItem('userType');
    const token = getStoredItem('token');
    const sessionId = getStoredItem('sessionId');

    if (userType === 'teacher' && token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (userType === 'student' && sessionId) {
      config.headers['X-Session-ID'] = sessionId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Single in-flight refresh promise — prevents parallel 401s from each triggering
// their own refresh call.
let refreshPromise = null;

function clearAuthAndRedirect() {
  const keys = ['userType', 'token', 'refreshToken', 'sessionId', 'user', '__rememberMe'];
  keys.forEach(k => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
  window.location.href = '/login';
}

// Response interceptor: on 401, try to refresh the token once then retry.
// Only redirects to /login when the refresh itself also fails or there is
// no refresh token available (e.g. student sessions, which can't be refreshed).
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || original._retried) {
      return Promise.reject(error);
    }

    const authPaths = ['/login', '/signup', '/join'];
    const onAuthPage = authPaths.some(p => window.location.pathname.startsWith(p));

    // Don't attempt refresh on auth pages — errors there are credential failures,
    // not expired tokens.
    if (onAuthPage) {
      return Promise.reject(error);
    }

    const storedRefreshToken = getStoredItem('refreshToken');
    const userType = getStoredItem('userType');

    // Students have no refresh token — clear and redirect immediately.
    // Also guard against corrupted localStorage values (e.g. the string
    // "null" or "undefined" stored by older code that received a null
    // refresh_token from the backend).
    if (
      !storedRefreshToken ||
      storedRefreshToken === 'null' ||
      storedRefreshToken === 'undefined' ||
      userType !== 'teacher'
    ) {
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    // Deduplicate concurrent refresh attempts.
    if (!refreshPromise) {
      refreshPromise = rawApi
        .post('/api/auth/teacher/refresh', {}, {
          headers: { Authorization: `Bearer ${storedRefreshToken}` },
        })
        .then((res) => {
          const { token, refresh_token } = res.data;
          // Store refreshed tokens in the same storage as the originals
          const remember = localStorage.getItem('__rememberMe') === 'true';
          const store = remember ? localStorage : sessionStorage;
          store.setItem('token', token);
          store.setItem('refreshToken', refresh_token);
          return token;
        })
        .catch(() => {
          clearAuthAndRedirect();
          return null;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    const newToken = await refreshPromise;
    if (!newToken) return Promise.reject(error);

    original._retried = true;
    original.headers.Authorization = `Bearer ${newToken}`;
    return api(original);
  }
);

export { rawApi };
export default api;

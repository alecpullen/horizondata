import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth headers
api.interceptors.request.use(
  (config) => {
    const userType = localStorage.getItem('userType');
    const token = localStorage.getItem('token');
    const sessionId = localStorage.getItem('sessionId');

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
  localStorage.removeItem('userType');
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('sessionId');
  localStorage.removeItem('user');
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

    const storedRefreshToken = localStorage.getItem('refreshToken');
    const userType = localStorage.getItem('userType');

    // Students have no refresh token — clear and redirect immediately.
    if (!storedRefreshToken || userType !== 'teacher') {
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    // Deduplicate concurrent refresh attempts.
    if (!refreshPromise) {
      refreshPromise = api
        .post('/api/auth/teacher/refresh', { refresh_token: storedRefreshToken })
        .then((res) => {
          const { token, refresh_token } = res.data;
          localStorage.setItem('token', token);
          localStorage.setItem('refreshToken', refresh_token);
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

export default api;

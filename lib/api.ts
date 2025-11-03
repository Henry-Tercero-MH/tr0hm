import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://trohm-production.up.railway.app';

// Create axios instance that sends cookies (credentials) by default so the httpOnly refresh cookie
// set by the backend is included in requests (important for /api/auth/refresh and protected calls).
const api = axios.create({ baseURL: API, withCredentials: true });

// Request interceptor to add Authorization header if token exists in localStorage
api.interceptors.request.use((config) => {
  try {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token && config.headers) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch (e) {
    // ignore
  }
  return config;
});

// Response interceptor: on 401 try to refresh using cookie and re-run failed requests
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: any) => void; reject: (err: any) => void; config: any }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else {
      if (token && p.config.headers) p.config.headers['Authorization'] = `Bearer ${token}`;
      p.resolve(api.request(p.config));
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      // avoid infinite loop
      originalRequest._retry = true;
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject, config: originalRequest });
        });
      }

      isRefreshing = true;
      try {
        // call refresh endpoint using a plain axios instance to avoid interceptor loop
        // Prefer cookie-based refresh (httpOnly cookie). Still include stored refresh in body as fallback.
        const storedRefresh = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
        const refreshRes = await axios.post(
          `${API}/api/auth/refresh`,
          storedRefresh ? { refreshToken: storedRefresh } : {},
          { withCredentials: true }
        );
        const newToken = refreshRes.data?.token;
        const newRefresh = refreshRes.data?.refreshToken;
        if (newToken) {
          try { localStorage.setItem('token', newToken); } catch (e) {}
          if (newRefresh) {
            try { localStorage.setItem('refreshToken', newRefresh); } catch (e) {}
          }
        }
        processQueue(null, newToken || null);
        isRefreshing = false;
        if (newToken) {
          if (originalRequest.headers) originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return api.request(originalRequest);
        }
      } catch (err) {
        processQueue(err, null);
        isRefreshing = false;
        // clear local token and emit a session-expired event so the app can handle redirecting
        if (typeof window !== 'undefined') {
          try { localStorage.removeItem('token'); } catch (e) {}
          try { window.dispatchEvent(new Event('session-expired')); } catch (e) {}
        }
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
);

export default api;

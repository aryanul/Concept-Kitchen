import axios from 'axios';
import { useAuth } from '../stores/auth';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((cfg) => {
  const t = useAuth.getState().token;
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// Token expired or invalidated server-side — clear the stale session and bounce to /login
// so the user re-authenticates instead of staring at a broken-looking dashboard.
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401 && useAuth.getState().token) {
      useAuth.getState().clear();
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(err);
  }
);

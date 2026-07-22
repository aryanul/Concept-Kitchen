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

// Pull the server's error-envelope message out of an axios error, falling back
// to a caller-supplied default. Use this in catch blocks so validation messages
// (e.g. IN_USE on blocked deletes) reach the user instead of a generic alert.
export function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: { message?: string } } } };
  return e?.response?.data?.error?.message ?? fallback;
}

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

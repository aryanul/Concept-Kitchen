import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../stores/auth';

type Status = 'checking' | 'waking' | 'ready';

// Render is on a free tier — backends spin down after ~15 min idle and after every redeploy.
// The first request after a cold start can take 30–60s, so we gate the app on /healthz and
// re-gate if any in-session request fails with a network error or 5xx.
export function ServerWakeGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('checking');
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(Date.now());
  const inFlight = useRef(false);

  const runHealthCheck = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    startedAt.current = Date.now();
    setElapsed(0);

    let attempt = 0;
    while (true) {
      try {
        await api.get('/healthz', { timeout: 70_000 });
        break;
      } catch {
        attempt++;
        if (attempt === 1) setStatus('waking');
        // Backoff: 1s, 2s, 4s, capped at 5s.
        const delay = Math.min(5_000, 1_000 * 2 ** (attempt - 1));
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    // Server is up. If we have a stored token, confirm it's still valid before opening
    // the app — otherwise the user sees a "logged in" shell where every call 401s.
    // The api.ts response interceptor will clear auth + redirect on 401; we just need
    // to wait for that round-trip.
    const token = useAuth.getState().token;
    if (token) {
      try {
        await api.get('/auth/me', { timeout: 15_000 });
      } catch {
        // 401 → interceptor already redirected to /login; any other error we ignore
        // and let the app render so individual pages can surface their own errors.
      }
    }

    setStatus('ready');
    inFlight.current = false;
  };

  useEffect(() => {
    runHealthCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick a visible timer while the splash is up.
  useEffect(() => {
    if (status === 'ready') return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  // Re-gate when an in-session request fails because the backend went away.
  useEffect(() => {
    const id = api.interceptors.response.use(
      (r) => r,
      (err) => {
        const isNetworkError = !err?.response;
        const is5xx = err?.response?.status >= 500;
        const isHealthCheck = err?.config?.url?.includes('/healthz');
        if ((isNetworkError || is5xx) && !isHealthCheck && status === 'ready') {
          setStatus('checking');
          runHealthCheck();
        }
        return Promise.reject(err);
      }
    );
    return () => api.interceptors.response.eject(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (status === 'ready') return <>{children}</>;
  return <Splash elapsed={elapsed} status={status} />;
}

function Splash({ elapsed, status }: { elapsed: number; status: Status }) {
  const showWakingCopy = status === 'waking' || elapsed > 3;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--ck-bg, #f9fafb)',
        color: 'var(--ck-ink, #111)',
        fontFamily: 'var(--ck-font, system-ui, sans-serif)',
        padding: 24,
        textAlign: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '3px solid var(--ck-line, #e5e7eb)',
          borderTopColor: 'var(--ck-ink, #111)',
          animation: 'ck-wake-spin 800ms linear infinite',
          marginBottom: 18,
        }}
      />
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
        {showWakingCopy ? 'Waking up the server…' : 'Connecting…'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--ck-muted, #6b7280)', maxWidth: 360, lineHeight: 1.5 }}>
        {showWakingCopy
          ? 'Our backend sleeps when idle and takes ~30 seconds to wake. This page will load automatically.'
          : 'Reaching the server.'}
      </div>
      {showWakingCopy && (
        <div style={{ fontSize: 12, color: 'var(--ck-muted, #6b7280)', marginTop: 12, fontVariantNumeric: 'tabular-nums' }}>
          {elapsed}s
        </div>
      )}
      <style>{`@keyframes ck-wake-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../stores/auth';

/**
 * Sign-out policy: 30 minutes of *inactivity*, never sooner.
 *
 * The access token used to be a fixed 15-minute wall clock with no refresh
 * flow, so anyone still working got bounced to /login mid-task. Here the token
 * lifetime equals the idle window and this guard slides it forward with
 * POST /auth/refresh while the user is actually interacting — so the only way
 * to be signed out is to genuinely stop using the app.
 */
const IDLE_LIMIT_MS = 30 * 60 * 1000;

/** Warn the user before the axe falls, so a stalled form isn't lost silently. */
const WARN_BEFORE_MS = 2 * 60 * 1000;

/** How often we compare "now" against the last interaction. */
const TICK_MS = 15 * 1000;

/**
 * Slide the server-side expiry at most this often. The token is good for the
 * full idle window, so refreshing every few minutes of activity keeps it
 * comfortably ahead of expiry without hammering the API.
 */
const REFRESH_EVERY_MS = 5 * 60 * 1000;

/**
 * Shared across tabs: typing in one tab must keep the others alive, otherwise a
 * background tab's timer would sign the user out of the tab they're using.
 */
const ACTIVITY_KEY = 'ck-nest-last-activity';

const ACTIVITY_EVENTS = [
  'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll', 'focus',
] as const;

function readSharedActivity(): number {
  const raw = Number(localStorage.getItem(ACTIVITY_KEY));
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

export function IdleSessionGuard() {
  const token = useAuth((s) => s.token);
  const setSession = useAuth((s) => s.setSession);
  const clear = useAuth((s) => s.clear);
  const navigate = useNavigate();

  // Stamped in the effect below rather than here: reading the clock during
  // render is impure, and the effect calls markActive() on mount anyway, so
  // these never stay at 0 past the first commit.
  const lastActivity = useRef(0);
  const lastRefresh = useRef(0);
  const warned = useRef(false);

  const markActive = useCallback(() => {
    const now = Date.now();
    lastActivity.current = now;
    warned.current = false;
    try {
      localStorage.setItem(ACTIVITY_KEY, String(now));
    } catch {
      // private-mode / quota — the in-memory ref still works for this tab
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    markActive();
    lastRefresh.current = Date.now(); // don't slide the session on the first tick

    const onActivity = () => {
      // Throttle: at most one write per second, regardless of event volume.
      if (Date.now() - lastActivity.current > 1000) markActive();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') markActive();
    };
    const onStorage = (e: StorageEvent) => {
      // Another tab saw activity — adopt its timestamp if it's newer.
      if (e.key !== ACTIVITY_KEY) return;
      const shared = Number(e.newValue);
      if (Number.isFinite(shared) && shared > lastActivity.current) {
        lastActivity.current = shared;
        warned.current = false;
      }
    };

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true, capture: true });
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('storage', onStorage);

    const signOut = () => {
      clear();
      try {
        localStorage.removeItem(ACTIVITY_KEY);
      } catch {
        /* nothing to clean up */
      }
      toast.info('Signed out after 30 minutes of inactivity.', { duration: 8000 });
      navigate('/login', { replace: true });
    };

    const timer = window.setInterval(() => {
      if (!useAuth.getState().token) return;

      // Another tab may be the active one — always take the freshest timestamp.
      const seen = Math.max(lastActivity.current, readSharedActivity());
      lastActivity.current = seen;
      const idleFor = Date.now() - seen;

      if (idleFor >= IDLE_LIMIT_MS) {
        signOut();
        return;
      }

      if (idleFor >= IDLE_LIMIT_MS - WARN_BEFORE_MS && !warned.current) {
        warned.current = true;
        toast.warning('You will be signed out in 2 minutes.', {
          description: 'Move the mouse or press a key to stay signed in.',
          duration: WARN_BEFORE_MS,
        });
        return;
      }

      // Active user: push the server-side expiry back out to a full window.
      const activeRecently = idleFor < REFRESH_EVERY_MS;
      const refreshDue = Date.now() - lastRefresh.current >= REFRESH_EVERY_MS;
      if (activeRecently && refreshDue) {
        lastRefresh.current = Date.now(); // optimistic, so a slow call can't stack up
        api
          .post<{ data: { token: string; user: Parameters<typeof setSession>[1] } }>('/auth/refresh')
          .then((r) => setSession(r.data.data.token, r.data.data.user))
          .catch(() => {
            // 401 is already handled globally by the axios interceptor; anything
            // else (offline, cold start) just retries on the next cycle.
            lastRefresh.current = Date.now() - REFRESH_EVERY_MS + 30_000;
          });
      }
    }, TICK_MS);

    return () => {
      window.clearInterval(timer);
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity, { capture: true } as EventListenerOptions);
      }
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
    };
  }, [token, clear, navigate, setSession, markActive]);

  return null;
}

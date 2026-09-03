import { useEffect, useState } from 'react';
import { api } from './api';
import { useAuth } from '../stores/auth';

/**
 * What the signed-in user may do, as decided by the server.
 *
 * The server is the authority — every route is guarded by `permissionGuard`
 * regardless of what the UI shows. This exists so the UI does not offer buttons
 * and menu items that only come back 403: hiding what someone cannot use is a
 * courtesy, never the control.
 *
 * Cached per user rather than per token: the token is reissued every few
 * minutes by the idle-session refresh, and re-fetching the permission set on
 * each of those would be pure noise. Keying on the user id still means signing
 * in as somebody else gets a fresh answer.
 */
let cachedFor: string | null = null;
let cache: Promise<Set<string>> | null = null;
let value: Set<string> | null = null;

function load(userId: string): Promise<Set<string>> {
  if (cache && cachedFor === userId) return cache;
  cachedFor = userId;
  value = null;
  cache = api
    .get<{ data: { permissions: string[] } }>('/me/permissions')
    .then((r) => {
      value = new Set(r.data.data.permissions);
      return value;
    })
    .catch(() => {
      // Offline, or the backend is cold. An empty set would blank the whole
      // sidebar, which reads as "you have been locked out" rather than "we
      // don't know yet" — so drop the cache and let the caller stay in its
      // not-loaded state, where it shows everything and the server decides.
      cache = null;
      cachedFor = null;
      return new Set<string>();
    });
  return cache;
}

/** Forget the cached set — e.g. after an admin edits the current user's role. */
export function invalidatePermissions(): void {
  cache = null;
  cachedFor = null;
  value = null;
}

export type PermissionCheck = {
  /** True once the server has answered; guards against flashing hidden UI. */
  loaded: boolean;
  /** HR_ADMIN holds everything, so this short-circuits without a round-trip. */
  can: (key: string) => boolean;
  all: Set<string>;
};

export function usePermissions(): PermissionCheck {
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);
  const [set, setSet] = useState<Set<string> | null>(value);

  useEffect(() => {
    if (!token || !user?.id) {
      setSet(null);
      return;
    }
    let cancelled = false;
    load(user.id).then((s) => { if (!cancelled) setSet(s); });
    return () => { cancelled = true; };
  }, [token, user?.id]);

  const isAdmin = user?.role === 'HR_ADMIN';
  return {
    loaded: isAdmin || set !== null,
    all: set ?? new Set<string>(),
    can: (key: string) => isAdmin || (set?.has(key) ?? false),
  };
}

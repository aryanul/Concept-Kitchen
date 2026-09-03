/**
 * A tiny stale-while-revalidate cache for list screens.
 *
 * The complaint it exists to fix: every visit to a list page started from an
 * empty table and a "Loading…" line, even when the user had just been on that
 * page ten seconds earlier. Caching the last response per query key lets the
 * table paint immediately from memory while a fresh request runs behind it, so
 * navigating back to a page feels instant.
 *
 * Deliberately in-memory only (cleared on reload) and unbounded-but-tiny: keys
 * are query strings for a handful of screens, not user data worth persisting.
 */

type Entry = { value: unknown; at: number };

const store = new Map<string, Entry>();

/** How long a cached page is served without any visual "stale" treatment. */
export const LIST_CACHE_TTL_MS = 60_000;

export function cacheKey(name: string, params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .filter((k) => params[k] !== '' && params[k] !== undefined && params[k] !== null)
    .sort()
    .map((k) => `${k}=${String(params[k])}`)
    .join('&');
  return `${name}?${sorted}`;
}

export function readCache<T>(key: string): T | undefined {
  const hit = store.get(key);
  return hit ? (hit.value as T) : undefined;
}

export function writeCache(key: string, value: unknown): void {
  store.set(key, { value, at: Date.now() });
}

export function isFresh(key: string, ttl = LIST_CACHE_TTL_MS): boolean {
  const hit = store.get(key);
  return !!hit && Date.now() - hit.at < ttl;
}

/**
 * Drop cached pages after a mutation, so a save is never followed by the stale
 * pre-save row flashing back in. Pass the same `name` used in `cacheKey`.
 */
export function invalidateCache(name: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(`${name}?`)) store.delete(key);
  }
}

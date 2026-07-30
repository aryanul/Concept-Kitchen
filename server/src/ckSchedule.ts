// Automatic Concept Kitchen master-data sync scheduling.
//
// The manual "Resync Now" button (POST /api/v1/ck/sync) stays as-is; this module
// adds unattended syncs so the mirror stays fresh without anyone clicking:
//
//   * TWICE A DAY ON LOGIN — the IST day is split into two windows, AM (00:00–11:59)
//     and PM (12:00–23:59). The first successful login in a window that hasn't been
//     synced yet kicks off a background sync. Later logins in the same window are
//     no-ops, so a busy morning triggers exactly one sync, not one per user.
//   * DAILY AT 12 AM IST — an in-process timer fires the day's AM sync even if nobody
//     logs in.
//
// The login sync is fire-and-forget: it never blocks or slows the login response.
//
// Persistence: the "which window did we last sync" marker is recovered on boot from
// the latest `ck-sync` audit row (its after_data.finishedAt is a UTC ISO string), so a
// restart / Render cold-start doesn't forget and re-sync needlessly. A single in-flight
// guard (`syncing`) prevents overlapping runs from concurrent logins or a login racing
// the midnight timer.
//
// Note on Render's free tier: if the instance is asleep at midnight the timer can't
// fire — but the first login of the day then covers the AM window, so freshness never
// depends solely on the timer.

import { ulid } from 'ulid';
import { query } from './db';
import { ckApiConfigured } from './ckApi';
import { ckSyncAll } from './ckSync';
import { writeAudit } from './audit';

// India Standard Time is a fixed UTC+5:30 offset (no daylight saving), so a plain
// offset is exact — no tz database needed. "before/after 12pm" means IST noon.
const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;

// The actor recorded for unattended syncs (audit_logs.actor_id is CHAR(26) NOT NULL).
const SYSTEM_ACTOR = '0'.repeat(26);

// Shared "a sync is running" flag — set by BOTH the manual route and the auto-syncs,
// so it's the single source of truth the UI polls (GET /ck/sync-state) to show a loader.
let inFlight = false;
/** Whether any CK sync (manual or automatic) is currently running. */
export function isSyncing(): boolean {
  return inFlight;
}
/** Acquire the sync lock. Returns false if a sync is already running. */
export function tryBeginSync(): boolean {
  if (inFlight) return false;
  inFlight = true;
  return true;
}
/** Release the sync lock. Always call from a finally after tryBeginSync() returned true. */
export function endSync(): void {
  inFlight = false;
}

// The window key (`YYYY-MM-DD:AM|PM`, IST) of the last SUCCESSFUL sync. Null until the
// first sync or until recovered from the DB on boot. Only ever advanced on success, so a
// failed sync leaves the window open for the next login to retry.
let lastSyncedWindow: string | null = null;
let midnightTimer: ReturnType<typeof setTimeout> | null = null;

/** IST wall-clock parts for a UTC instant. */
function istParts(d: Date): { year: number; month: number; day: number; hour: number } {
  // Shift by the IST offset, then read with UTC getters to get IST wall-clock values
  // without the Node process's local timezone interfering.
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return {
    year: ist.getUTCFullYear(),
    month: ist.getUTCMonth(),
    day: ist.getUTCDate(),
    hour: ist.getUTCHours(),
  };
}

/** The half-day window an instant falls in, e.g. `2026-07-30:PM` (IST). */
function windowKey(d: Date): string {
  const { year, month, day, hour } = istParts(d);
  const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return `${ymd}:${hour < 12 ? 'AM' : 'PM'}`;
}

/** Milliseconds from `now` until the next IST midnight (00:00 IST). */
function msUntilNextIstMidnight(now: Date): number {
  const { year, month, day } = istParts(now);
  // Start of the NEXT IST day, expressed as UTC parts, then pulled back to the real
  // UTC instant by removing the IST offset.
  const nextIstMidnightAsUtc = Date.UTC(year, month, day + 1, 0, 0, 0, 0);
  const realInstant = nextIstMidnightAsUtc - IST_OFFSET_MS;
  return Math.max(0, realInstant - now.getTime());
}

/** Recover the last-synced window from the newest ck-sync audit row (best-effort). */
async function loadLastSyncedWindow(): Promise<string | null> {
  const rows = await query<{ after_data: { finishedAt?: string } | null }>(
    "SELECT after_data FROM audit_logs WHERE resource = 'ck-sync' AND action = 'run' ORDER BY `at` DESC LIMIT 1",
  );
  const finishedAt = rows[0]?.after_data?.finishedAt;
  return typeof finishedAt === 'string' ? windowKey(new Date(finishedAt)) : null;
}

/**
 * Run a sync unless one is already in flight or CK isn't configured. Advances the
 * window marker and writes an audit row only on success.
 */
async function runGuardedSync(actorId: string, trigger: 'login' | 'cron-midnight'): Promise<void> {
  if (!ckApiConfigured() || !tryBeginSync()) return;
  try {
    const summary = await ckSyncAll();
    lastSyncedWindow = windowKey(new Date());
    writeAudit(actorId, 'run', 'ck-sync', ulid(), null, { ...summary, trigger }).catch(() => {});
    const totals = Object.values(summary.stats).reduce(
      (a, s) => ({ inserted: a.inserted + s.inserted, updated: a.updated + s.updated }),
      { inserted: 0, updated: 0 },
    );
    console.log(
      `[ck-sync] ${trigger} sync ok — ${totals.inserted} added, ${totals.updated} updated ` +
        `in ${(summary.durationMs / 1000).toFixed(1)}s (window ${lastSyncedWindow})`,
    );
  } catch (e) {
    console.error(`[ck-sync] ${trigger} sync failed:`, e);
  } finally {
    endSync();
  }
}

/**
 * Called (fire-and-forget) after every successful login. Triggers a background sync
 * only if the current IST half-day window hasn't been synced yet. Cheap and safe to
 * call on every login — it returns immediately.
 */
export function maybeSyncOnLogin(actorId: string): void {
  if (!ckApiConfigured()) return;
  if (isSyncing() || windowKey(new Date()) === lastSyncedWindow) return;
  void runGuardedSync(actorId, 'login');
}

function scheduleMidnight(): void {
  if (midnightTimer) clearTimeout(midnightTimer);
  const delay = msUntilNextIstMidnight(new Date());
  midnightTimer = setTimeout(() => {
    void runGuardedSync(SYSTEM_ACTOR, 'cron-midnight');
    scheduleMidnight(); // arm the next day
  }, delay);
  // Don't let this timer be the only thing keeping the process alive.
  if (typeof midnightTimer.unref === 'function') midnightTimer.unref();
}

/** Wire up the schedule at server boot: recover state, then arm the midnight timer. */
export async function initCkSchedule(): Promise<void> {
  if (!ckApiConfigured()) {
    console.log('[ck-sync] auto-sync disabled (CK_API_URL not set)');
    return;
  }
  try {
    lastSyncedWindow = await loadLastSyncedWindow();
  } catch (e) {
    console.error('[ck-sync] could not recover last-sync window:', e);
  }
  scheduleMidnight();
  console.log(
    `[ck-sync] auto-sync armed — last synced window: ${lastSyncedWindow ?? 'none'}; ` +
      `next midnight run in ${(msUntilNextIstMidnight(new Date()) / 3_600_000).toFixed(1)}h`,
  );
}

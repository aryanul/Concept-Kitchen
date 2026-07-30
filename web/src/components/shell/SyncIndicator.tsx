import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';

// A small, non-blocking pill in the top bar that appears whenever a CK master-data
// sync is running — whether the current user triggered it (their login kicked off the
// twice-daily sync), an admin hit "Resync Now", or the midnight job fired. It only
// polls a cheap in-memory endpoint (no DB) and never blocks the user's work; the pill
// simply shows/hides, and a subtle toast confirms when a run finishes.
export function SyncIndicator() {
  const [syncing, setSyncing] = useState(false);
  const wasSyncing = useRef(false); // last observed value, to detect the finish edge

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      let active = wasSyncing.current;
      try {
        const r = await api.get<{ data: { syncing: boolean } }>('/ck/sync-state');
        if (!alive) return;
        active = r.data.data.syncing;
        setSyncing(active);
        // Announce completion only on a true→false edge this client actually observed.
        if (wasSyncing.current && !active) toast.success('Master data refreshed');
        wasSyncing.current = active;
      } catch {
        /* best-effort; ignore transient errors */
      } finally {
        // Poll faster while a sync is active so the pill clears promptly on finish.
        if (alive) timer = setTimeout(poll, active ? 2000 : 6000);
      }
    };

    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  if (!syncing) return null;

  return (
    <div
      title="Concept Kitchen master data is syncing in the background — you can keep working."
      style={{
        height: 32,
        padding: '0 12px',
        borderRadius: 999,
        border: '1px solid var(--ck-accent)',
        background: 'color-mix(in oklab, var(--ck-accent) 12%, var(--ck-surface))',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        color: 'var(--ck-accent)',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <RefreshCw size={13} strokeWidth={2.2} className="ck-spin" />
      <span>Syncing…</span>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, Database, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';
import { useAuth } from '../../stores/auth';

type DomainStat = { inserted: number; updated: number };
type SyncSummary = {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  stats: Record<string, DomainStat>;
  errors: string[];
};
type StatusResponse = { data: { configured: boolean; counts: Record<string, number> } };

// The masters that CK feeds. `name` (and links) are read-only after sync; every
// other column stays locally editable — see the Settings copy below.
const TABLE_LABELS: Record<string, string> = {
  hiring_companies: 'Companies',
  branches: 'Branches',
  locations: 'Locations',
  departments: 'Departments',
  divisions: 'Divisions',
  designations: 'Designations',
  skills: 'Skills',
  lookups: 'Specifications (lookups)',
};

export function SyncSettingsPage() {
  const role = useAuth((s) => s.user?.role);
  const isAdmin = role === 'HR_ADMIN';

  const [configured, setConfigured] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState<SyncSummary | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const r = await api.get<StatusResponse>('/ck/status');
      setConfigured(r.data.data.configured);
      setCounts(r.data.data.counts);
    } catch {
      /* status is best-effort */
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  async function handleResync() {
    setSyncing(true);
    try {
      const r = await api.post<{ data: SyncSummary }>('/ck/sync');
      const s = r.data.data;
      setSummary(s);
      const totalIn = Object.values(s.stats).reduce((a, b) => a + b.inserted, 0);
      const totalUp = Object.values(s.stats).reduce((a, b) => a + b.updated, 0);
      if (s.ok) {
        toast.success(`Masters synced — ${totalIn} added, ${totalUp} updated in ${(s.durationMs / 1000).toFixed(1)}s`);
      } else {
        toast.warning(`Synced with ${s.errors.length} issue(s) — ${totalIn} added, ${totalUp} updated`);
      }
      loadStatus();
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { error?: { message?: string } } } };
      if (e.response?.status === 503) {
        toast.error('CK API is not configured on the server (CK_API_URL missing).');
      } else if (e.response?.status === 403) {
        toast.error('Only HR Admins can run a master sync.');
      } else {
        toast.error(e.response?.data?.error?.message ?? 'Sync failed. Please try again.');
      }
    } finally {
      setSyncing(false);
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: 'var(--ck-faint)',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  };

  return (
    <div>
      <PageHeader
        title="Master Data Sync"
        subtitle="Pull shared masters from Concept Kitchen. Fetched fields are read-only here; everything else stays yours."
        actions={
          <Button
            variant="primary"
            icon={RefreshCw}
            onClick={handleResync}
            disabled={syncing || !isAdmin || !configured}
          >
            {syncing ? 'Syncing…' : 'Resync Now'}
          </Button>
        }
      />

      {!configured && (
        <Card style={{ marginBottom: 16, borderColor: 'var(--ck-warn, #d97706)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: 'var(--ck-ink-soft)' }}>
              The Concept Kitchen API is not configured on the server. Set <code>CK_API_URL</code> and
              <code> CK_API_KEY</code> in the server environment to enable syncing.
            </div>
          </div>
        </Card>
      )}

      {!isAdmin && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, color: 'var(--ck-muted)' }}>
            <Lock size={16} /> Only HR Admins can trigger a sync. You can view current coverage below.
          </div>
        </Card>
      )}

      {/* How it works */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Database size={18} style={{ color: 'var(--ck-accent)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: 'var(--ck-ink-soft)', lineHeight: 1.6 }}>
            Sync mirrors CK's central masters into ours. Each row's <b>name</b> is owned by CK and refreshed
            on every sync (read-only in the master screens); all other fields — codes, city, descriptions and
            any custom flags — are <b>yours</b> and are never overwritten or emptied. New CK entries are added;
            removed ones are kept, never deleted. It's safe to run this any time.
          </div>
        </div>
      </Card>

      {/* Coverage counts */}
      <Card padding={0} style={{ marginBottom: 16 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--ck-line)' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ck-ink)' }}>Current coverage</span>
          <span style={{ fontSize: 12.5, color: 'var(--ck-muted)', marginLeft: 8 }}>
            rows currently linked to Concept Kitchen
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1, background: 'var(--ck-line-soft)' }}>
          {Object.entries(TABLE_LABELS).map(([key, label]) => (
            <div key={key} style={{ background: 'var(--ck-surface)', padding: '14px 18px' }}>
              <div style={labelStyle}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ck-ink)', marginTop: 4 }}>
                {counts[key] ?? 0}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Last run result */}
      {summary && (
        <Card padding={0}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--ck-line)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {summary.ok
              ? <CheckCircle2 size={16} style={{ color: 'var(--ck-success, #16a34a)' }} />
              : <AlertTriangle size={16} style={{ color: '#d97706' }} />}
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ck-ink)' }}>Last sync result</span>
            <span style={{ fontSize: 12.5, color: 'var(--ck-muted)', marginLeft: 'auto' }}>
              {(summary.durationMs / 1000).toFixed(1)}s · {new Date(summary.finishedAt).toLocaleString('en-IN')}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...labelStyle, textAlign: 'left', padding: '10px 20px', borderBottom: '1px solid var(--ck-line)' }}>Domain</th>
                  <th style={{ ...labelStyle, textAlign: 'right', padding: '10px 20px', borderBottom: '1px solid var(--ck-line)' }}>Added</th>
                  <th style={{ ...labelStyle, textAlign: 'right', padding: '10px 20px', borderBottom: '1px solid var(--ck-line)' }}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(summary.stats).map(([key, s]) => (
                  <tr key={key}>
                    <td style={{ padding: '9px 20px', borderBottom: '1px solid var(--ck-line-soft)', fontSize: 13, color: 'var(--ck-ink)' }}>{key}</td>
                    <td style={{ padding: '9px 20px', borderBottom: '1px solid var(--ck-line-soft)', fontSize: 13, textAlign: 'right', color: s.inserted ? 'var(--ck-success, #16a34a)' : 'var(--ck-muted)', fontWeight: s.inserted ? 600 : 400 }}>{s.inserted}</td>
                    <td style={{ padding: '9px 20px', borderBottom: '1px solid var(--ck-line-soft)', fontSize: 13, textAlign: 'right', color: 'var(--ck-ink-soft)' }}>{s.updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {summary.errors.length > 0 && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--ck-line)', background: 'var(--ck-bg)' }}>
              <div style={{ ...labelStyle, color: '#d97706', marginBottom: 6 }}>Issues</div>
              {summary.errors.map((e, i) => (
                <div key={i} style={{ fontSize: 12.5, color: 'var(--ck-muted)', fontFamily: 'var(--ck-font-mono)' }}>{e}</div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

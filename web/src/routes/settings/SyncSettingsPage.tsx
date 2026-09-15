import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, Database, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { StatusPill } from '../../components/ui/StatusPill';
import { SearchInput, FilterSelect } from '../../components/filters';
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
  skill_heads: 'Skill Heads',
  skill_types: 'Skill Types',
  skills: 'Skills',
  lookups: 'Specifications (lookups)',
};

type Row = Record<string, unknown>;
type ColumnDef = { key: string; label: string; align?: 'right' };
type DomainDef = { key: string; label: string; columns: ColumnDef[]; hasStatus?: boolean; fetch: () => Promise<Row[]> };

async function getList(url: string, params?: Record<string, unknown>): Promise<Row[]> {
  try {
    const r = await api.get<{ data: Row[] }>(url, params ? { params } : undefined);
    return r.data?.data ?? [];
  } catch {
    return [];
  }
}

function withStatus(rows: Row[]): Row[] {
  return rows.map((r) => ({ ...r, status: Number(r.is_active) ? 'Active' : 'Inactive' }));
}

async function fetchCompanies(): Promise<Row[]> {
  const pageSize = 100;
  let page = 1;
  let all: Row[] = [];
  for (;;) {
    try {
      const r = await api.get<{ data: Row[]; meta?: { total?: number } }>('/hiring/companies', { params: { page, pageSize } });
      const rows = r.data?.data ?? [];
      all = all.concat(rows);
      const total = Number(r.data?.meta?.total ?? all.length);
      if (rows.length === 0 || all.length >= total) break;
      page += 1;
    } catch {
      break;
    }
  }
  return all;
}

async function fetchSpecifications(): Promise<Row[]> {
  try {
    const r = await api.get<{ data: Array<{ name: string; values?: Array<{ code: string; label: string; ck_id?: number | null }> }> }>(
      '/lookup-categories',
      { params: { includeValues: 1 } }
    );
    const categories = r.data?.data ?? [];
    const rows: Row[] = [];
    for (const cat of categories) {
      for (const v of cat.values ?? []) {
        rows.push({
          category: cat.name,
          code: v.code,
          label: v.label,
          source: v.ck_id != null ? 'Concept Kitchen' : 'Local',
        });
      }
    }
    return rows;
  } catch {
    return [];
  }
}

const DOMAINS: DomainDef[] = [
  {
    key: 'companies', label: 'Companies',
    columns: [
      { key: 'ck_id', label: 'CK ID' }, { key: 'lc_no', label: 'LC No.' }, { key: 'name', label: 'Name' },
      { key: 'city', label: 'City' }, { key: 'branch', label: 'Branch' },
    ],
    fetch: fetchCompanies,
  },
  {
    key: 'branches', label: 'Branches',
    columns: [
      { key: 'ck_id', label: 'CK ID' }, { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' },
      { key: 'city', label: 'City' }, { key: 'kind', label: 'Kind' }, { key: 'company_name', label: 'Company' },
    ],
    fetch: () => getList('/branches'),
  },
  {
    key: 'locations', label: 'Locations',
    columns: [
      { key: 'ck_id', label: 'CK ID' }, { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' },
      { key: 'city', label: 'City' }, { key: 'state', label: 'State' }, { key: 'branch_name', label: 'Branch' },
      { key: 'status', label: 'Status' },
    ],
    hasStatus: true,
    fetch: async () => withStatus(await getList('/locations')),
  },
  {
    key: 'departments', label: 'Departments',
    columns: [{ key: 'ck_id', label: 'CK ID' }, { key: 'name', label: 'Name' }],
    fetch: () => getList('/departments'),
  },
  {
    key: 'divisions', label: 'Divisions',
    columns: [
      { key: 'ck_id', label: 'CK ID' }, { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' },
      { key: 'department_name', label: 'Department' }, { key: 'status', label: 'Status' },
    ],
    hasStatus: true,
    fetch: async () => withStatus(await getList('/divisions')),
  },
  {
    key: 'designations', label: 'Designations',
    columns: [
      { key: 'ck_id', label: 'CK ID' }, { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' },
      { key: 'department_name', label: 'Department' }, { key: 'division_name', label: 'Division' },
      { key: 'status', label: 'Status' },
    ],
    hasStatus: true,
    fetch: async () => withStatus(await getList('/designations')),
  },
  {
    key: 'skill-heads', label: 'Skill Heads',
    columns: [
      { key: 'ck_id', label: 'CK ID' }, { key: 'name', label: 'Name' },
      { key: 'skill_type_count', label: 'Skill Types', align: 'right' }, { key: 'status', label: 'Status' },
    ],
    hasStatus: true,
    fetch: async () => withStatus(await getList('/skill-heads')),
  },
  {
    key: 'skill-types', label: 'Skill Types',
    columns: [
      { key: 'ck_id', label: 'CK ID' }, { key: 'name', label: 'Name' }, { key: 'skill_head_name', label: 'Skill Head' },
      { key: 'skill_count', label: 'Skills', align: 'right' }, { key: 'status', label: 'Status' },
    ],
    hasStatus: true,
    fetch: async () => withStatus(await getList('/skill-types')),
  },
  {
    key: 'skills', label: 'Skills',
    columns: [
      { key: 'ck_id', label: 'CK ID' }, { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' },
      { key: 'skill_head_name', label: 'Skill Head' }, { key: 'skill_type_name', label: 'Skill Type' },
      { key: 'status', label: 'Status' },
    ],
    hasStatus: true,
    fetch: async () => withStatus(await getList('/skills')),
  },
  {
    key: 'specifications', label: 'Specifications',
    columns: [
      { key: 'category', label: 'Category' }, { key: 'code', label: 'Code' }, { key: 'label', label: 'Label' },
      { key: 'source', label: 'Source' },
    ],
    fetch: fetchSpecifications,
  },
];

export function SyncSettingsPage() {
  const role = useAuth((s) => s.user?.role);
  const isAdmin = role === 'HR_ADMIN';

  const [configured, setConfigured] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState<SyncSummary | null>(null);

  const [tabData, setTabData] = useState<Record<string, Row[]>>(() => Object.fromEntries(DOMAINS.map((d) => [d.key, []])));
  const [tabsLoading, setTabsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(DOMAINS[0].key);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const r = await api.get<StatusResponse>('/ck/status');
      setConfigured(r.data.data.configured);
    } catch {
      /* status is best-effort */
    }
  }, []);

  const loadTabData = useCallback(async () => {
    setTabsLoading(true);
    const results = await Promise.all(DOMAINS.map((d) => d.fetch()));
    setTabData(Object.fromEntries(DOMAINS.map((d, i) => [d.key, results[i]])));
    setTabsLoading(false);
  }, []);

  useEffect(() => { loadStatus(); loadTabData(); }, [loadStatus, loadTabData]);

  function changeTab(key: string) {
    setActiveTab(key);
    setSearch('');
    setStatusFilter('');
  }

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
      loadTabData();
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { error?: { message?: string } } } };
      if (e.response?.status === 503) {
        toast.error('CK API is not configured on the server (CK_API_URL missing).');
      } else if (e.response?.status === 403) {
        toast.error('Only HR Admins can run a master sync.');
      } else if (e.response?.status === 409) {
        toast.info('A sync is already running (auto-sync). Please wait for it to finish.');
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

  const activeDomain = DOMAINS.find((d) => d.key === activeTab) ?? DOMAINS[0];
  const rows = useMemo(() => tabData[activeTab] ?? [], [tabData, activeTab]);
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter && String(row.status ?? '') !== statusFilter) return false;
      if (!q) return true;
      return activeDomain.columns.some((c) => String(row[c.key] ?? '').toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter, activeDomain]);

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

      {syncing && (
        <Card style={{ marginBottom: 16, borderColor: 'var(--ck-accent)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
            <RefreshCw size={16} className="ck-spin" style={{ color: 'var(--ck-accent)', flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: 'var(--ck-ink-soft)' }}>
              Syncing masters from Concept Kitchen… this usually takes a few seconds. You can keep working — it runs in the background.
            </div>
          </div>
          <div className="ck-progress"><span /></div>
        </Card>
      )}

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
            <Lock size={16} /> Only HR Admins can trigger a sync. You can browse current coverage below.
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

      {/* Browsable coverage, segregated by domain with search + status filtering */}
      <Tabs
        tabs={DOMAINS.map((d) => ({ key: d.key, label: d.label, count: tabData[d.key]?.length ?? 0 }))}
        active={activeTab}
        onChange={changeTab}
      />
      <Card padding={0} style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
            padding: '14px 20px', borderBottom: '1px solid var(--ck-line)', background: 'var(--ck-surface-alt)',
          }}
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={`Search ${activeDomain.label.toLowerCase()}…`}
            showButton={false}
            width={260}
          />
          {activeDomain.hasStatus && (
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]}
              placeholder="All Statuses"
              minWidth={150}
            />
          )}
          <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ck-muted)' }}>
            {tabsLoading ? 'Loading…' : `${filteredRows.length.toLocaleString('en-IN')} of ${rows.length.toLocaleString('en-IN')} rows`}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
                {activeDomain.columns.map((c) => (
                  <th
                    key={c.key}
                    style={{
                      padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)',
                      letterSpacing: '0.04em', textAlign: c.align ?? 'left',
                    }}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!tabsLoading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={activeDomain.columns.length} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
                    No records found.
                  </td>
                </tr>
              )}
              {filteredRows.map((row, i) => (
                <tr
                  key={i}
                  style={{ borderTop: '1px solid var(--ck-line)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ck-surface-alt)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  {activeDomain.columns.map((c) => (
                    <td
                      key={c.key}
                      style={{ padding: '10px 16px', verticalAlign: 'middle', textAlign: c.align ?? 'left', color: 'var(--ck-ink-soft)' }}
                    >
                      {c.key === 'status'
                        ? <StatusPill status={String(row.status ?? 'Inactive')} />
                        : (row[c.key] == null || row[c.key] === '' ? '—' : String(row[c.key]))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
                    <td style={{ padding: '9px 20px', borderBottom: '1px solid var(--ck-line-soft)', fontSize: 13, color: 'var(--ck-ink)' }}>{TABLE_LABELS[key] ?? key}</td>
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

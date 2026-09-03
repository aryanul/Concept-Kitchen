import { useCallback, useEffect, useState } from 'react';
import {
  Activity, Search, X, ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { api } from '../../lib/api';
import { formatRelativeTime } from '../../lib/format';

type ActivityEntry = {
  id: string;
  action: string;
  resource: string;
  resource_id: string;
  at: string;
  actor_name: string | null;
  actor_email: string | null;
};

type LogsResponse = {
  data: {
    logs: ActivityEntry[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

const RESOURCE_LABELS: Record<string, string> = {
  // Domain (index.ts)
  employee: 'Employee', leave: 'Leave', attendance: 'Attendance',
  holiday: 'Holiday', loan: 'Loan', increment: 'Increment',
  incentive: 'Incentive', payroll_period: 'Payroll', tour: 'Tour',
  compensation: 'Compensation',
  // Auth events
  auth: 'Session',
  // Masters (masters.ts)
  branches: 'Branch', departments: 'Department', designations: 'Designation',
  divisions: 'Division', locations: 'Location', shifts: 'Shift',
  'salary-grades': 'Salary Grade', 'skill-heads': 'Skill Head', 'skill-types': 'Skill Type',
  skills: 'Skill', 'training-modules': 'Training Module',
  'induction-templates': 'Induction Template', 'onboarding-templates': 'Onboarding Template',
  'attendance-rules': 'Attendance Rule', lookups: 'Lookup', tags: 'Tag',
  users: 'User', holidays: 'Holiday (Master)',
  'atm-tasks': 'ATM Task', 'hiring/companies': 'Hiring Company',
  'hiring/interview-templates': 'Interview Template',
  'onboarding/giveaways': 'Giveaway', 'onboarding/phone-pool': 'Phone Pool',
  'onboarding/erp-modules': 'ERP Module', 'onboarding/asset-categories': 'Asset Category',
  'onboarding/assets': 'Asset', 'onboarding/presentations': 'Presentation',
};

/**
 * Turn a raw audit value into something readable: `hiring/interview-templates`
 * → "Hiring · Interview Templates", `push_to_payroll` → "Push To Payroll".
 * Used for anything the label map above doesn't name explicitly, so a newly
 * audited resource is legible without a code change.
 */
function humanise(value: string): string {
  return value
    .split('/')
    .map((part) =>
      part
        .split(/[-_]/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    )
    .join(' · ');
}

function resourceLabel(resource: string): string {
  return RESOURCE_LABELS[resource] ?? humanise(resource);
}

const ACTION_COLORS: Record<string, string> = {
  create: 'oklch(0.45 0.13 145)', update: 'oklch(0.45 0.13 250)', delete: 'oklch(0.45 0.13 20)',
  approve: 'oklch(0.45 0.13 145)', activate: 'oklch(0.45 0.13 145)', archive: 'oklch(0.45 0.13 60)',
  exit: 'oklch(0.45 0.13 20)', decide: 'oklch(0.45 0.13 250)', run: 'oklch(0.45 0.13 290)',
  disburse: 'oklch(0.45 0.13 145)', settle: 'oklch(0.45 0.13 145)',
  close: 'oklch(0.45 0.13 20)', push_to_payroll: 'oklch(0.45 0.13 290)',
  login: 'oklch(0.45 0.13 195)', logout: 'oklch(0.45 0.13 60)',
};
const ACTION_BG: Record<string, string> = {
  create: 'oklch(0.96 0.04 145)', update: 'oklch(0.96 0.04 250)', delete: 'oklch(0.96 0.04 20)',
  approve: 'oklch(0.96 0.04 145)', activate: 'oklch(0.96 0.04 145)', archive: 'oklch(0.96 0.04 60)',
  exit: 'oklch(0.96 0.04 20)', decide: 'oklch(0.96 0.04 250)', run: 'oklch(0.96 0.04 290)',
  disburse: 'oklch(0.96 0.04 145)', settle: 'oklch(0.96 0.04 145)',
  close: 'oklch(0.96 0.04 20)', push_to_payroll: 'oklch(0.96 0.04 290)',
  login: 'oklch(0.96 0.04 195)', logout: 'oklch(0.96 0.04 60)',
};

type SortKey = 'at' | 'action' | 'resource' | 'actor';

function formatAbsolute(isoStr: string): string {
  return new Date(isoStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true,
  });
}

export function ActivityLogPage() {
  const [logs, setLogs] = useState<ActivityEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const limit = 25;

  // Filter options come from the log itself rather than a hard-coded list, so
  // every audited action and module is filterable the moment it first appears.
  const [facets, setFacets] = useState<{ actions: string[]; resources: string[] }>({
    actions: [], resources: [],
  });
  useEffect(() => {
    api.get<{ data: { actions: string[]; resources: string[] } }>('/activity-logs/facets')
      .then((r) => setFacets(r.data.data))
      .catch(() => { /* filters just stay empty; the table still works */ });
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)         params.set('q', search);
      if (actionFilter)   params.set('action', actionFilter);
      if (resourceFilter) params.set('resource', resourceFilter);
      if (dateFrom)       params.set('dateFrom', dateFrom);
      if (dateTo)         params.set('dateTo', dateTo);
      params.set('sortBy', sortBy);
      params.set('sortDir', sortDir);
      params.set('page', String(page));
      params.set('limit', String(limit));

      const r = await api.get<LogsResponse>(`/activity-logs?${params}`);
      const d = r.data.data;
      setLogs(d.logs);
      setTotal(d.total);
      setTotalPages(d.totalPages);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [search, actionFilter, resourceFilter, dateFrom, dateTo, sortBy, sortDir, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const hasFilters = search || actionFilter || resourceFilter || dateFrom || dateTo;

  function clearFilters() {
    setSearch(''); setSearchInput('');
    setActionFilter(''); setResourceFilter('');
    setDateFrom(''); setDateTo('');
    setPage(1);
  }

  function applySearch() {
    setSearch(searchInput);
    setPage(1);
  }

  function handleSortClick(col: SortKey) {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setPage(1);
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortBy !== col) return <ChevronsUpDown size={13} style={{ color: 'var(--ck-faint)', marginLeft: 4 }} />;
    return sortDir === 'asc'
      ? <ChevronUp size={13} style={{ color: 'var(--ck-accent)', marginLeft: 4 }} />
      : <ChevronDown size={13} style={{ color: 'var(--ck-accent)', marginLeft: 4 }} />;
  }

  const thStyle: React.CSSProperties = {
    padding: '10px 16px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--ck-faint)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid var(--ck-line)',
    background: 'var(--ck-bg)',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  };

  const inputStyle: React.CSSProperties = {
    height: 34,
    padding: '0 10px',
    borderRadius: 7,
    border: '1px solid var(--ck-line)',
    background: 'var(--ck-bg)',
    color: 'var(--ck-ink)',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    paddingRight: 28,
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239ca3af'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
    cursor: 'pointer',
    minWidth: 140,
  };

  const start = (page - 1) * limit + 1;
  const end   = Math.min(page * limit, total);

  return (
    <div>
      <PageHeader
        title="Activity Log"
        subtitle={`Full audit trail of all portal actions · ${total.toLocaleString()} total entries`}
        actions={
          <button
            onClick={fetchLogs}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              height: 34, padding: '0 14px', borderRadius: 7,
              border: '1px solid var(--ck-line)', background: 'var(--ck-bg)',
              color: 'var(--ck-ink-soft)', cursor: 'pointer', fontSize: 13,
              fontFamily: 'inherit', fontWeight: 500,
            }}
          >
            <Activity size={14} strokeWidth={1.8} />
            Refresh
          </button>
        }
      />

      {/* Filter bar */}
      <Card padding={16} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--ck-faint)', pointerEvents: 'none' }} />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              placeholder="Search actor name or email…"
              style={{ ...inputStyle, paddingLeft: 32, width: 240 }}
            />
            <button
              onClick={applySearch}
              style={{
                marginLeft: 6, height: 34, padding: '0 12px', borderRadius: 7,
                border: '1px solid var(--ck-line)', background: 'var(--ck-accent)',
                color: '#fff', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 500,
              }}
            >
              Search
            </button>
          </div>

          {/* Action filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--ck-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Action
            </label>
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              style={selectStyle}
            >
              <option value="">All actions</option>
              {facets.actions.map((a) => (
                <option key={a} value={a}>{humanise(a)}</option>
              ))}
            </select>
          </div>

          {/* Resource filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--ck-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Module
            </label>
            <select
              value={resourceFilter}
              onChange={(e) => { setResourceFilter(e.target.value); setPage(1); }}
              style={selectStyle}
            >
              <option value="">All modules</option>
              {facets.resources.map((r) => (
                <option key={r} value={r}>{resourceLabel(r)}</option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--ck-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              From date
            </label>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              style={inputStyle}
            />
          </div>

          {/* Date to */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--ck-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              To date
            </label>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              style={inputStyle}
            />
          </div>

          {/* Sort */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--ck-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Sort by
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value as SortKey); setPage(1); }}
                style={{ ...selectStyle, minWidth: 120 }}
              >
                <option value="at">Date &amp; time</option>
                <option value="action">Action</option>
                <option value="resource">Module</option>
                <option value="actor">Actor</option>
              </select>
              <button
                onClick={() => { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); setPage(1); }}
                title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
                style={{
                  height: 34, width: 34, borderRadius: 7, border: '1px solid var(--ck-line)',
                  background: 'var(--ck-bg)', color: 'var(--ck-ink-soft)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {sortDir === 'asc' ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            </div>
          </div>

          {/* Clear filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                height: 34, padding: '0 12px', borderRadius: 7,
                border: '1px solid var(--ck-line)', background: 'var(--ck-bg)',
                color: 'var(--ck-muted)', cursor: 'pointer', fontSize: 12.5,
                fontFamily: 'inherit', alignSelf: 'flex-end',
              }}
            >
              <X size={13} /> Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card padding={0}>
        {loading && (
          <div style={{ padding: '10px 20px', fontSize: 12.5, color: 'var(--ck-muted)', borderBottom: '1px solid var(--ck-line-soft)' }}>
            Loading…
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle} onClick={() => handleSortClick('action')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    Action <SortIcon col="action" />
                  </span>
                </th>
                <th style={thStyle} onClick={() => handleSortClick('resource')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    Module <SortIcon col="resource" />
                  </span>
                </th>
                <th style={{ ...thStyle, cursor: 'default' }}>Resource ID</th>
                <th style={thStyle} onClick={() => handleSortClick('actor')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    Actor <SortIcon col="actor" />
                  </span>
                </th>
                <th style={thStyle} onClick={() => handleSortClick('at')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    Date &amp; Time <SortIcon col="at" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && !loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ck-muted)', fontSize: 13 }}>
                    {hasFilters ? 'No entries match the current filters.' : 'No activity recorded yet.'}
                  </td>
                </tr>
              ) : (
                logs.map((entry, i) => {
                  const actionColor = ACTION_COLORS[entry.action] ?? 'var(--ck-muted)';
                  const actionBg    = ACTION_BG[entry.action]    ?? 'var(--ck-line-soft)';
                  const resource    = resourceLabel(entry.resource);
                  const actor       = entry.actor_name ?? entry.actor_email ?? 'System';
                  const isEven      = i % 2 === 1;
                  return (
                    <tr
                      key={entry.id}
                      style={{ background: isEven ? 'var(--ck-bg)' : 'var(--ck-surface)' }}
                    >
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid var(--ck-line-soft)' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                          background: actionBg, color: actionColor,
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}>
                          {entry.action}
                        </span>
                      </td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid var(--ck-line-soft)', fontSize: 13, color: 'var(--ck-ink)', fontWeight: 500 }}>
                        {resource}
                      </td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid var(--ck-line-soft)', fontSize: 12, color: 'var(--ck-muted)', fontFamily: 'var(--ck-font-mono)' }}>
                        {entry.resource_id.slice(0, 13)}…
                      </td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid var(--ck-line-soft)', fontSize: 13, color: 'var(--ck-ink)' }}>
                        {actor}
                        {entry.actor_email && entry.actor_name && (
                          <div style={{ fontSize: 11.5, color: 'var(--ck-muted)' }}>{entry.actor_email}</div>
                        )}
                      </td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid var(--ck-line-soft)', fontSize: 12.5, color: 'var(--ck-muted)', whiteSpace: 'nowrap' }}
                          title={formatAbsolute(entry.at)}>
                        <div style={{ color: 'var(--ck-ink-soft)', fontWeight: 500 }}>{formatAbsolute(entry.at)}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ck-faint)', marginTop: 2 }}>{formatRelativeTime(entry.at)}</div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 20px', borderTop: '1px solid var(--ck-line)',
          }}>
            <span style={{ fontSize: 12.5, color: 'var(--ck-muted)' }}>
              Showing {start}–{end} of {total.toLocaleString()} entries
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  height: 32, width: 32, borderRadius: 7, border: '1px solid var(--ck-line)',
                  background: 'var(--ck-bg)', color: page === 1 ? 'var(--ck-faint)' : 'var(--ck-ink-soft)',
                  cursor: page === 1 ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ChevronLeft size={15} />
              </button>

              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let p: number;
                if (totalPages <= 7) {
                  p = i + 1;
                } else if (page <= 4) {
                  p = i + 1;
                } else if (page >= totalPages - 3) {
                  p = totalPages - 6 + i;
                } else {
                  p = page - 3 + i;
                }
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    style={{
                      height: 32, minWidth: 32, padding: '0 6px', borderRadius: 7,
                      border: p === page ? '1px solid var(--ck-accent)' : '1px solid var(--ck-line)',
                      background: p === page ? 'var(--ck-accent)' : 'var(--ck-bg)',
                      color: p === page ? '#fff' : 'var(--ck-ink-soft)',
                      cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: p === page ? 600 : 400,
                    }}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  height: 32, width: 32, borderRadius: 7, border: '1px solid var(--ck-line)',
                  background: 'var(--ck-bg)', color: page === totalPages ? 'var(--ck-faint)' : 'var(--ck-ink-soft)',
                  cursor: page === totalPages ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

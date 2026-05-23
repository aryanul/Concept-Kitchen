// Dev-only DB wipe utility. Pick a table from the allowlist, see its rows,
// select checkboxes, delete with confirmation. HR_ADMIN only (server enforces).
//
// This is intentionally a "developer escape hatch" — minimal styling, no
// pagination beyond LIMIT, no soft-delete. Use it to clear test data, not
// to manage real records.

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

type WipeTable = { name: string; label: string; group: string; pk?: string; hint?: string };
type RowsResp = {
  data: {
    table: WipeTable;
    pk: string;
    columns: { name: string; type: string }[];
    rows: Record<string, unknown>[];
    total: number;
    limit: number;
  };
};

export function WipePage() {
  const [tables, setTables] = useState<WipeTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [data, setData] = useState<RowsResp['data'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(100);

  useEffect(() => {
    api.get<{ data: WipeTable[] }>('/dev/wipe/tables')
      .then((r) => setTables(r.data.data ?? []))
      .catch(() => toast.error('Failed to load tables list (HR_ADMIN role required)'));
  }, []);

  const loadRows = (name: string, useLimit = limit) => {
    if (!name) { setData(null); return; }
    setLoading(true);
    setSelectedIds(new Set());
    api.get<RowsResp>('/dev/wipe/rows', { params: { table: name, limit: useLimit } })
      .then((r) => setData(r.data.data))
      .catch((e: unknown) => {
        const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to load rows';
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadRows(selectedTable, limit); }, [selectedTable, limit]);

  const grouped = useMemo(() => {
    const m = new Map<string, WipeTable[]>();
    for (const t of tables) {
      if (!m.has(t.group)) m.set(t.group, []);
      m.get(t.group)!.push(t);
    }
    return m;
  }, [tables]);

  // Substring filter across all column values so the user can drill into a
  // huge table by typing any unique chunk of data.
  const filteredRows = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data.rows;
    const q = search.toLowerCase();
    return data.rows.filter((r) =>
      Object.values(r).some((v) => v != null && String(v).toLowerCase().includes(q))
    );
  }, [data, search]);

  const toggleRow = (id: string) => {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAllVisible = () => {
    if (!data) return;
    const pk = data.pk;
    setSelectedIds(new Set(filteredRows.map((r) => String(r[pk]))));
  };
  const clearSelection = () => setSelectedIds(new Set());

  const doDelete = async () => {
    if (!data) return;
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const r = await api.post<{ data: { deleted: number | null; requested: number } }>('/dev/wipe/delete', { table: data.table.name, ids });
      const deleted = r.data.data.deleted ?? r.data.data.requested;
      toast.success(`Deleted ${deleted} row${deleted === 1 ? '' : 's'} from ${data.table.label}`);
      setConfirmOpen(false);
      setSelectedIds(new Set());
      loadRows(data.table.name, limit);
    } catch (e: unknown) {
      const errResp = (e as { response?: { data?: { error?: { code?: string; message?: string } } } })?.response?.data?.error;
      toast.error(errResp?.message ?? 'Delete failed', { duration: 10000 });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="DB Wipe (Dev)"
        subtitle="Admin-only utility for clearing test data. Use carefully — deletes are immediate and not soft."
      />

      <Card padding={0} style={{ marginBottom: 16, borderColor: '#FCA5A5', background: '#FEF2F2' }}>
        <div style={{ padding: 14, display: 'flex', alignItems: 'flex-start', gap: 10, color: '#7F1D1D' }}>
          <AlertTriangle size={18} />
          <div style={{ fontSize: 13, lineHeight: 1.55 }}>
            <strong>This is a developer tool.</strong> Selected rows are hard-deleted (no undo).
            FK constraints will block deletes that have child rows — you'll see the SQL error and need to clear children first.
          </div>
        </div>
      </Card>

      <Card padding={16}>
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 140px auto', gap: 12, alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Table</span>
            <select value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)} style={inp}>
              <option value="">— Pick a table —</option>
              {[...grouped.entries()].map(([group, list]) => (
                <optgroup key={group} label={group}>
                  {list.map((t) => <option key={t.name} value={t.name}>{t.label} ({t.name})</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Search visible rows</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type to filter the loaded rows…" style={inp} disabled={!data} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Limit</span>
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} style={inp}>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
            </select>
          </label>
          <Button icon={RefreshCcw} onClick={() => loadRows(selectedTable, limit)} disabled={!selectedTable || loading}>Reload</Button>
        </div>

        {data?.table.hint && (
          <div style={{ marginTop: 12, padding: 10, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 7, fontSize: 12.5, color: '#78350F' }}>
            <strong>Heads up:</strong> {data.table.hint}
          </div>
        )}
      </Card>

      {selectedTable && (
        <Card padding={0} style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--ck-line)' }}>
            <div style={{ fontSize: 13, color: 'var(--ck-muted)' }}>
              {loading ? 'Loading…' : data ? (
                <>
                  Showing <strong>{filteredRows.length.toLocaleString('en-IN')}</strong>
                  {search && ` (of ${data.rows.length} loaded)`}
                  {' '}of <strong>{data.total.toLocaleString('en-IN')}</strong> total
                  · {selectedIds.size} selected
                </>
              ) : '—'}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="sm" onClick={selectAllVisible} disabled={!data || filteredRows.length === 0}>Select all visible</Button>
              <Button size="sm" onClick={clearSelection} disabled={selectedIds.size === 0}>Clear</Button>
              <Button size="sm" variant="danger" icon={Trash2} onClick={() => setConfirmOpen(true)} disabled={selectedIds.size === 0}>
                Delete {selectedIds.size || ''}
              </Button>
            </div>
          </div>

          {data && (
            <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--ck-bg)', zIndex: 1 }}>
                  <tr>
                    <th style={th}></th>
                    {data.columns.map((c) => (
                      <th key={c.name} style={th} title={c.type}>{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 && (
                    <tr><td colSpan={data.columns.length + 1} style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)' }}>No rows.</td></tr>
                  )}
                  {filteredRows.map((row) => {
                    const id = String(row[data.pk]);
                    const checked = selectedIds.has(id);
                    return (
                      <tr key={id} style={{ borderTop: '1px solid var(--ck-line)', background: checked ? '#FEF2F2' : 'transparent' }}>
                        <td style={{ padding: '6px 12px', verticalAlign: 'top' }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleRow(id)} />
                        </td>
                        {data.columns.map((c) => (
                          <td key={c.name} style={td}>{formatCell(row[c.name])}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm delete" width={520}
        footer={<>
          <Button onClick={() => setConfirmOpen(false)} disabled={deleting}>Cancel</Button>
          <Button variant="danger" icon={Trash2} onClick={doDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : `Delete ${selectedIds.size} row${selectedIds.size === 1 ? '' : 's'}`}
          </Button>
        </>}>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ck-ink)' }}>
          You're about to permanently delete <strong>{selectedIds.size}</strong> row{selectedIds.size === 1 ? '' : 's'} from <code style={{ background: '#F3F4F6', padding: '2px 6px', borderRadius: 4 }}>{data?.table.name}</code>.
          <div style={{ marginTop: 10, padding: 10, background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 7, color: '#7F1D1D' }}>
            This action <strong>cannot be undone</strong>. If the row has children in other tables, the delete will fail and you'll need to clear them first.
          </div>
        </div>
      </Modal>
    </div>
  );
}

const inp: React.CSSProperties = {
  width: '100%', height: 36, padding: '0 10px', border: '1px solid var(--ck-line)',
  borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)', color: 'var(--ck-ink)',
};
const th: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em',
  borderBottom: '1px solid var(--ck-line)', whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '6px 12px', verticalAlign: 'top', fontFamily: 'var(--ck-font-mono)',
  fontSize: 11.5, color: 'var(--ck-ink-soft)', maxWidth: 240, overflow: 'hidden',
  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

function formatCell(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  const s = String(v);
  return s.length > 200 ? s.slice(0, 200) + '…' : s;
}

import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../ui/Card';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/Button';
import { IconAction } from '../ui/IconAction';
import { Modal } from '../ui/Modal';

type RowValue = string | number | boolean;

export type MasterField<Row> = {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'checkbox';
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  required?: boolean;
  step?: number;
  min?: number;
  span?: boolean;
  help?: string;
  hidden?: boolean;
  disabled?: boolean;
  renderValue?: (row: Row) => React.ReactNode;
};

export type MasterColumn<Row> = {
  header: string;
  render: (row: Row) => React.ReactNode;
};

type Props<Row extends { id: string }> = {
  title: string;
  subtitle?: string;
  endpoint: string;
  /** Optional override for the GET list call (defaults to `endpoint`). */
  listEndpoint?: string;
  /** Optional override for POST create (defaults to `endpoint`). */
  addEndpoint?: string;
  /** Optional override for PATCH base (defaults to `endpoint`). */
  patchEndpoint?: string;
  /** Optional override for DELETE base (defaults to `endpoint`). */
  deleteEndpoint?: string;
  /** Optional suffix appended to PATCH URL after the id (e.g. "/full"). */
  patchPathSuffix?: string;
  columns: MasterColumn<Row>[];
  buildFields: (rows: Row[]) => MasterField<Row>[];
  rowToValues: (row: Row | null) => Record<string, RowValue>;
  buildPayload: (values: Record<string, RowValue>, mode: 'create' | 'edit', row?: Row | null) => Record<string, unknown>;
  searchKeys?: string[];
  pageSize?: number;
  addLabel?: string;
  onChanged?: () => void;
  /** Optional extra inline action buttons rendered before Edit/Delete. */
  extraActions?: (row: Row) => React.ReactNode;
};

export function MasterCrudPage<Row extends { id: string }>({
  title,
  subtitle,
  endpoint,
  listEndpoint,
  addEndpoint,
  patchEndpoint,
  deleteEndpoint,
  patchPathSuffix,
  columns,
  buildFields,
  rowToValues,
  buildPayload,
  searchKeys,
  pageSize = 1000,
  addLabel = 'Add',
  onChanged,
  extraActions,
}: Props<Row>) {
  const getUrl    = listEndpoint    ?? endpoint;
  const postUrl   = addEndpoint     ?? endpoint;
  const patchBase = patchEndpoint   ?? endpoint;
  const delBase   = deleteEndpoint  ?? endpoint;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [values, setValues] = useState<Record<string, RowValue>>(rowToValues(null));
  const [saving, setSaving] = useState(false);

  const fetchRows = () => {
    setLoading(true);
    api
      .get(getUrl, { params: { page: 1, pageSize } })
      .then((r) => {
        const data = normalizeRows<Row>(r.data);
        setRows(data);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(fetchRows, [getUrl, pageSize]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      if (searchKeys?.length) {
        return searchKeys.some((key) => String((row as Record<string, unknown>)[key] ?? '').toLowerCase().includes(q));
      }
      return JSON.stringify(row).toLowerCase().includes(q);
    });
  }, [rows, search, searchKeys]);

  const fields = useMemo(() => buildFields(rows), [buildFields, rows]);

  const openCreate = () => {
    setEditing(null);
    setValues(rowToValues(null));
    setOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    setValues(rowToValues(row));
    setOpen(true);
  };

  const onDelete = async (row: Row) => {
    if (!window.confirm(`Delete ${title.toLowerCase()} item?`)) return;
    try {
      await api.delete(`${delBase}/${row.id}`);
      onChanged?.();
      fetchRows();
    } catch {
      window.alert('Delete failed');
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const payload = buildPayload(values, editing ? 'edit' : 'create', editing);
      if (editing) {
        await api.patch(`${patchBase}/${editing.id}${patchPathSuffix ?? ''}`, payload);
      } else {
        await api.post(postUrl, payload);
      }
      onChanged?.();
      setOpen(false);
      setEditing(null);
      setValues(rowToValues(null));
      fetchRows();
    } catch {
      window.alert('Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={<Button icon={Plus} variant="primary" onClick={openCreate}>{addLabel}</Button>}
      />

      <Card padding={0}>
        <div style={{ display: 'flex', gap: 12, padding: 16, borderBottom: '1px solid var(--ck-line)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--ck-muted)', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              style={{ width: '100%', height: 40, padding: '0 12px 0 36px', border: '1px solid var(--ck-line)', borderRadius: 8, fontSize: 13, background: 'var(--ck-surface)' }}
            />
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ck-muted)' }}>
            {loading ? 'Loading…' : `${filteredRows.length.toLocaleString('en-IN')} result${filteredRows.length === 1 ? '' : 's'}`}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
                {columns.map((column) => (
                  <th
                    key={column.header}
                    style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', letterSpacing: '0.04em' }}
                  >
                    {column.header}
                  </th>
                ))}
                <th style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', letterSpacing: '0.04em' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
                    No records found.
                  </td>
                </tr>
              )}
              {filteredRows.map((row) => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--ck-line)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ck-surface-alt)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                  {columns.map((column) => (
                    <td key={column.header} style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                      {column.render(row)}
                    </td>
                  ))}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {extraActions?.(row)}
                      <IconAction
                        icon={Pencil}
                        label="Edit"
                        hint={`Edit this ${title.toLowerCase()}`}
                        onClick={() => openEdit(row)}
                      />
                      <IconAction
                        icon={Trash2}
                        label="Delete"
                        hint={`Delete this ${title.toLowerCase()}`}
                        tone="danger"
                        onClick={() => onDelete(row)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
          setValues(rowToValues(null));
        }}
        title={editing ? `Edit ${title}` : `Add ${title}`}
        width={640}
        footer={(
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        )}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          {fields.filter((field) => !field.hidden).map((field) => (
            <FieldInput<Row>
              key={field.name}
              field={field}
              value={values[field.name]}
              onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))}
            />
          ))}
        </div>
      </Modal>
    </div>
  );
}

function FieldInput<Row>({ field, value, onChange }: { field: MasterField<Row>; value: RowValue | undefined; onChange: (value: RowValue) => void }) {
  const wrapperStyle: React.CSSProperties = field.span ? { gridColumn: '1 / -1' } : {};
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, ...wrapperStyle }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ck-ink-soft)' }}>
        {field.label}
        {field.required && <span style={{ color: 'var(--ck-danger-fg)' }}> *</span>}
      </span>
      {field.type === 'textarea' ? (
        <textarea
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          disabled={field.disabled}
          style={{ padding: 10, border: '1px solid var(--ck-line)', borderRadius: 8, fontSize: 13, background: 'var(--ck-surface)', resize: 'vertical' }}
        />
      ) : field.type === 'select' ? (
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={field.disabled}
          style={{ height: 40, padding: '0 12px', border: '1px solid var(--ck-line)', borderRadius: 8, fontSize: 13, background: 'var(--ck-surface)' }}
        >
          <option value="">Select</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : field.type === 'checkbox' ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 12px', border: '1px solid var(--ck-line)', borderRadius: 8, background: 'var(--ck-surface)' }}>
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} disabled={field.disabled} />
          <span style={{ fontSize: 13, color: 'var(--ck-ink)' }}>Enabled</span>
        </label>
      ) : (
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          value={String(value ?? '')}
          onChange={(e) => onChange(field.type === 'number' ? e.target.value : e.target.value)}
          placeholder={field.placeholder}
          step={field.step}
          min={field.min}
          disabled={field.disabled}
          style={{ height: 40, padding: '0 12px', border: '1px solid var(--ck-line)', borderRadius: 8, fontSize: 13, background: 'var(--ck-surface)' }}
        />
      )}
      {field.help && <span style={{ fontSize: 11.5, color: 'var(--ck-muted)' }}>{field.help}</span>}
    </label>
  );
}

function normalizeRows<Row>(data: unknown): Row[] {
  if (Array.isArray(data)) return data as Row[];
  if (data && typeof data === 'object' && 'data' in data) {
    const nested = (data as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as Row[];
  }
  return [];
}

import { useEffect, useState } from 'react';
import { Plus, CheckCircle, Gift } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { StatusPill } from '../../components/ui/StatusPill';
import { inrPaiseToRupeesShort } from '../../lib/format';

type Incentive = {
  id: string; kind: string; month: number; year: number; amount: number|string;
  status: string; pushed: number|boolean; pushed_at: string|null; created_at: string;
  employee_id: string; code: string; first_name: string; last_name: string; designation: string;
};
type Resp = { data: Incentive[] };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const STATUS_LABELS: Record<string,string> = { draft: 'Draft', approved: 'Approved', rejected: 'Rejected' };

export function IncentivesPage() {
  const [items, setItems] = useState<Incentive[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get<Resp>('/incentives').then((r) => setItems(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  };
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div>
      <PageHeader title="Incentives & Perks" subtitle="Manage and push performance incentives to payroll."
        actions={<Button icon={Plus} variant="primary">Add Incentive</Button>} />

      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--ck-ink)', borderRadius: 10, marginBottom: 14, color: '#fff' }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{selected.size} selected</span>
          <Button size="sm" variant="accent" icon={CheckCircle}>Push to Payroll</Button>
          <button onClick={() => setSelected(new Set())} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
        </div>
      )}

      <Card padding={0}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
                <th style={{ padding: '10px 16px', width: 44 }}>
                  <input type="checkbox" checked={items.length > 0 && selected.size === items.length} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                </th>
                {['Employee', 'Kind', 'Month', 'Amount', 'Status', 'In Payroll'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
                  <Gift size={40} strokeWidth={1.4} style={{ display: 'block', margin: '0 auto 12px', color: 'var(--ck-faint)' }} />
                  No incentive records yet.
                </td></tr>
              )}
              {items.map((it, i) => (
                <tr key={it.id} style={{ borderTop: '1px solid var(--ck-line)', background: selected.has(it.id) ? 'var(--ck-accent-soft)' : '' }}
                  onMouseEnter={(e) => { if (!selected.has(it.id)) e.currentTarget.style.background = 'var(--ck-surface-alt)'; }}
                  onMouseLeave={(e) => { if (!selected.has(it.id)) e.currentTarget.style.background = ''; }}>
                  <td style={{ padding: '12px 16px' }}>
                    <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} style={{ cursor: 'pointer' }} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={`${it.first_name} ${it.last_name}`} hue={(i * 47) % 360} size={34} />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--ck-ink)' }}>{it.first_name} {it.last_name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ck-muted)' }}>{it.designation}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 999, background: 'var(--ck-line-soft)', fontSize: 11.5, fontWeight: 600 }}>{it.kind}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--ck-ink-soft)' }}>{MONTHS[it.month - 1]} {it.year}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--ck-ink)' }}>{inrPaiseToRupeesShort(it.amount)}</td>
                  <td style={{ padding: '12px 16px' }}><StatusPill status={STATUS_LABELS[it.status] ?? it.status} /></td>
                  <td style={{ padding: '12px 16px' }}>
                    {it.pushed ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'oklch(0.42 0.12 145)', fontWeight: 600 }}>
                        <CheckCircle size={14} /> Pushed
                      </span>
                    ) : <span style={{ color: 'var(--ck-faint)', fontSize: 12 }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

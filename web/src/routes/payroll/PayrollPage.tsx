import { useEffect, useState } from 'react';
import { Play, FileText, Download } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { StatusPill } from '../../components/ui/StatusPill';
import { inrPaiseToRupeesShort } from '../../lib/format';

type Period = {
  id: string; month: number; year: number; status: string;
  employee_count: number | string; total_gross: number | string; total_net: number | string;
  run_at: string | null;
};
type Resp = { data: Period[] };

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const STATUS_LABELS: Record<string, string> = { DRAFT: 'Draft', APPROVED: 'Approved', DISBURSED: 'Disbursed' };

export function PayrollPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Resp>('/payroll/periods')
      .then((r) => setPeriods(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const latest = periods[0];

  return (
    <div>
      <PageHeader
        title="Payroll Runs & Pay-slips"
        subtitle="Manage monthly payroll cycles, approve and disburse salaries."
        actions={<Button icon={Play} variant="primary">Run Payroll</Button>}
      />

      <Card padding={0} style={{ marginBottom: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
          {[
            { label: 'Current Period',  value: latest ? `${MONTHS[latest.month - 1]} ${latest.year}` : '—', sub: 'Active period' },
            { label: 'Employees',       value: latest ? String(latest.employee_count) : '—',                sub: 'In this run' },
            { label: 'Gross Payable',   value: latest ? inrPaiseToRupeesShort(latest.total_gross) : '—',    sub: 'Before deductions' },
            { label: 'Net Payable',     value: latest ? inrPaiseToRupeesShort(latest.total_net)   : '—',    sub: 'After deductions' },
          ].map((s, i) => (
            <div key={s.label} style={{ padding: 24, borderLeft: i > 0 ? '1px solid var(--ck-line)' : 'none' }}>
              <div style={{ fontSize: 11.5, color: 'var(--ck-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ck-ink)', letterSpacing: '-0.02em' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--ck-muted)', marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card padding={0}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--ck-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ck-ink)' }}>Payroll history</div>
            <div style={{ fontSize: 12.5, color: 'var(--ck-muted)', marginTop: 2 }}>All processed payroll periods.</div>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ck-muted)' }}>{loading ? 'Loading…' : `${periods.length} periods`}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
                {['Period', 'Employees', 'Gross', 'Net Payable', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && periods.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
                  No payroll periods yet. Run the first payroll to get started.
                </td></tr>
              )}
              {periods.map((p) => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--ck-line)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ck-surface-alt)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '14px 16px', fontWeight: 600 }}>{MONTHS[p.month - 1]} {p.year}</td>
                  <td style={{ padding: '14px 16px' }}>{Number(p.employee_count)}</td>
                  <td style={{ padding: '14px 16px' }}>{inrPaiseToRupeesShort(p.total_gross)}</td>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--ck-ink)' }}>{inrPaiseToRupeesShort(p.total_net)}</td>
                  <td style={{ padding: '14px 16px' }}><StatusPill status={STATUS_LABELS[p.status] ?? p.status} /></td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button size="sm" icon={FileText} variant="ghost">View</Button>
                      <Button size="sm" icon={Download} variant="ghost">Download</Button>
                    </div>
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

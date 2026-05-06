import { useEffect, useState } from 'react';
import { Wallet, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { inrPaiseToRupees, inrPaiseToRupeesShort } from '../../lib/format';

type Grade = {
  id: string;
  code: string;
  kind: string;
  min_gross: number | string;
  max_gross: number | string;
  employee_count: number | string;
};

type ListResp = { data: Grade[] };

export function SalaryMasterPage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ListResp>('/salary-grades')
      .then((r) => setGrades(r.data.data))
      .catch(() => setError('Failed to load salary grades.'))
      .finally(() => setLoading(false));
  }, []);

  const totalEmployees = grades.reduce((sum, g) => sum + Number(g.employee_count || 0), 0);

  return (
    <div>
      <PageHeader
        title="Salary Structure & Components"
        subtitle="Grade ladder and the components that make up each pay package."
      />

      <Card padding={0} style={{ marginBottom: 22 }}>
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--ck-line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ck-ink)' }}>Grade ladder</div>
            <div style={{ fontSize: 12.5, color: 'var(--ck-muted)', marginTop: 2 }}>
              Monthly gross ranges and resulting annual CTC.
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ck-muted)' }}>
            {loading ? 'Loading…' : `${grades.length} grades · ${totalEmployees} employees`}
          </div>
        </div>

        {error ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ck-danger-fg)' }}>{error}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
                  <Th>Grade</Th>
                  <Th>Kind</Th>
                  <Th>Min Gross / month</Th>
                  <Th>Max Gross / month</Th>
                  <Th>Annual CTC range</Th>
                  <Th>Headcount</Th>
                </tr>
              </thead>
              <tbody>
                {!loading && grades.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
                      No grades configured.
                    </td>
                  </tr>
                )}
                {grades.map((g) => {
                  const min = Number(g.min_gross);
                  const max = Number(g.max_gross);
                  return (
                    <tr key={g.id} style={{ borderTop: '1px solid var(--ck-line)' }}>
                      <Td>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 44,
                            height: 28,
                            padding: '0 10px',
                            borderRadius: 8,
                            background: 'var(--ck-line-soft)',
                            color: 'var(--ck-ink)',
                            fontWeight: 700,
                            fontSize: 12.5,
                            fontFamily: 'var(--ck-font-mono)',
                          }}
                        >
                          {g.code}
                        </div>
                      </Td>
                      <Td>{g.kind}</Td>
                      <Td>{inrPaiseToRupees(min)}</Td>
                      <Td>{inrPaiseToRupees(max)}</Td>
                      <Td>
                        <span style={{ color: 'var(--ck-ink-soft)' }}>
                          {inrPaiseToRupeesShort(min * 12)} – {inrPaiseToRupeesShort(max * 12)}
                        </span>
                      </Td>
                      <Td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            color: 'var(--ck-ink)',
                            fontWeight: 600,
                          }}
                        >
                          <Users size={13} style={{ color: 'var(--ck-muted)' }} />
                          {Number(g.employee_count || 0)}
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card padding={24}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Wallet size={18} style={{ color: 'var(--ck-muted)' }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ck-ink)' }}>Salary components</div>
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--ck-muted)' }}>
          Components like Basic, HRA, Conveyance, PF, ESIC and Gratuity are configured per grade and
          drive the payroll calculation. Component management UI lands together with the payroll
          engine in a later step.
        </div>
      </Card>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: '10px 16px',
        fontSize: 11.5,
        fontWeight: 600,
        color: 'var(--ck-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>{children}</td>;
}

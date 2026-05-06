import { useEffect, useState } from 'react';
import { Plus, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { inrPaiseToRupeesShort } from '../../lib/format';
import { Modal } from '../../components/ui/Modal';

type Increment = {
  id: string; cycle_year: number; current_ctc: number|string; proposed_ctc: number|string;
  hike_pct: number|string; rating: string; stage: string; effective: string|null;
  employee_id: string; code: string; first_name: string; last_name: string; designation: string;
};
type Resp = { data: Increment[] };

const TABS = ['In-flight', 'Approved', 'History'];
const STAGE_MAP: Record<string, string> = {
  manager_review: 'Manager Review', hr: 'HR', finance: 'Finance', done: 'Done',
};
const PIPELINE = ['manager_review', 'hr', 'finance', 'done'];

const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  remarks: z.string().optional(),
});
type DecisionForm = z.infer<typeof decisionSchema>;

export function IncrementsPage() {
  const [tab, setTab] = useState('In-flight');
  const [items, setItems] = useState<Increment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState<Increment | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchIncrements = () => {
    const ctrl = new AbortController();
    setLoading(true);
    const stageFilter = tab === 'In-flight' ? undefined : tab === 'Approved' ? 'done' : undefined;
    api.get<Resp>('/increments', { params: stageFilter ? { stage: stageFilter } : {}, signal: ctrl.signal })
      .then((r) => setItems(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  };

  useEffect(fetchIncrements, [tab]);

  const displayed = tab === 'Approved' ? items.filter((i) => i.stage === 'done')
    : tab === 'In-flight' ? items.filter((i) => i.stage !== 'done')
    : items;

  const { register, handleSubmit, reset } = useForm<DecisionForm>({
    resolver: zodResolver(decisionSchema),
    defaultValues: { decision: 'approve' },
  });

  const onDecide = async (data: DecisionForm) => {
    if (!deciding) return;
    setSaving(true);
    try {
      await api.post(`/increments/${deciding.id}/decide`, data);
      toast.success(`Increment ${data.decision === 'approve' ? 'approved' : 'rejected'}`);
      setDeciding(null);
      reset({ decision: 'approve', remarks: '' });
      fetchIncrements();
    } catch { toast.error('Action failed'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Increments & Appraisals" subtitle="Manage appraisal cycles and salary revisions."
        actions={<Button icon={Plus} variant="primary">New Increment</Button>} />

      <Card padding={0}>
        <div style={{ display: 'flex', gap: 4, padding: '14px 16px', borderBottom: '1px solid var(--ck-line)', alignItems: 'center' }}>
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '7px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: tab === t ? 'var(--ck-ink)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--ck-muted)' }}>
              {t} {!loading && t !== 'History' && `(${displayed.length})`}
            </button>
          ))}
        </div>

        {!loading && displayed.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
            No increments in this stage. Start an appraisal cycle to add.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14, padding: 16 }}>
            {displayed.map((inc, i) => {
              const hike = Number(inc.hike_pct);
              const stageIdx = PIPELINE.indexOf(inc.stage);
              return (
                <Card key={inc.id} padding={20}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <Avatar name={`${inc.first_name} ${inc.last_name}`} hue={(i * 53) % 360} size={40} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: 'var(--ck-ink)' }}>{inc.first_name} {inc.last_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--ck-muted)' }}>{inc.designation} · {inc.code}</div>
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: 'oklch(0.95 0.05 145)', color: 'oklch(0.42 0.12 145)' }}>
                      {inc.rating}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--ck-muted)' }}>Current</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{inrPaiseToRupeesShort(inc.current_ctc)}</div>
                    </div>
                    <TrendingUp size={18} style={{ color: 'var(--ck-accent)', flexShrink: 0 }} />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--ck-muted)' }}>Proposed</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ck-accent)' }}>{inrPaiseToRupeesShort(inc.proposed_ctc)}</div>
                    </div>
                    <div style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 999, background: 'var(--ck-accent-soft)', color: 'var(--ck-accent)', fontSize: 13, fontWeight: 700 }}>
                      +{hike.toFixed(1)}%
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {PIPELINE.map((p, pi) => (
                      <div key={p} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', margin: '0 auto 4px',
                          background: pi <= stageIdx ? 'var(--ck-accent)' : 'var(--ck-line)',
                          border: pi === stageIdx ? '3px solid var(--ck-accent)' : 'none',
                          boxShadow: pi === stageIdx ? '0 0 0 3px var(--ck-accent-soft)' : 'none' }} />
                        <div style={{ fontSize: 9, color: pi <= stageIdx ? 'var(--ck-accent)' : 'var(--ck-faint)', fontWeight: 600 }}>
                          {STAGE_MAP[p]}
                        </div>
                      </div>
                    ))}
                  </div>
                  {inc.stage !== 'done' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                      <Button size="sm" variant="accent" onClick={() => { setDeciding(inc); reset({ decision: 'approve', remarks: '' }); }}>Approve</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setDeciding(inc); reset({ decision: 'reject', remarks: '' }); }}>Reject</Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      <Modal open={!!deciding} onClose={() => setDeciding(null)} title="Decision" subtitle={deciding ? `${deciding.first_name} ${deciding.last_name}` : undefined} width={420}
        footer={<>
          <Button onClick={() => setDeciding(null)}>Cancel</Button>
          <Button variant="primary" type="submit" form="increment-decision-form" disabled={saving}>{saving ? 'Saving…' : 'Confirm'}</Button>
        </>}
      >
        <form id="increment-decision-form" onSubmit={handleSubmit(onDecide)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ck-ink-soft)' }}>Decision *</span>
              <select {...register('decision')} style={{ height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' }}>
                <option value="approve">Approve</option>
                <option value="reject">Reject</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ck-ink-soft)' }}>Remarks</span>
              <textarea {...register('remarks')} rows={3} style={{ padding: 10, border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' }} />
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}

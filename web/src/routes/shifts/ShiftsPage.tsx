import { useEffect, useState, type ReactNode } from 'react';
import { Clock, Coffee, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

type Shift = {
  id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  kind: string;
  break_min: number;
};

type ListResp = { data: Shift[] };

const KIND_TONE: Record<string, { bg: string; fg: string }> = {
  General:    { bg: 'oklch(0.95 0.05 250)', fg: 'oklch(0.45 0.13 250)' },
  Production: { bg: 'oklch(0.95 0.06 340)', fg: 'oklch(0.45 0.16 340)' },
  Office:     { bg: 'oklch(0.95 0.05 145)', fg: 'oklch(0.42 0.12 145)' },
};

const schema = z.object({
  name: z.string().min(1, 'Required'),
  startTime: z.string().min(1, 'Required'),
  endTime: z.string().min(1, 'Required'),
  kind: z.string().min(1, 'Required'),
  breakMin: z.coerce.number().int().min(0),
});
type FormValues = z.infer<typeof schema>;

export function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editShift, setEditShift] = useState<Shift | null>(null);

  const fetchShifts = () => {
    api
      .get<ListResp>('/shifts')
      .then((r) => setShifts(r.data.data))
      .catch(() => setError('Failed to load shifts.'))
      .finally(() => setLoading(false));
  };

  useEffect(fetchShifts, []);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const openEdit = (s: Shift) => {
    setEditShift(s);
    reset({
      name: s.name,
      startTime: s.start_time,
      endTime: s.end_time,
      kind: s.kind,
      breakMin: s.break_min,
    });
  };

  const onSubmit = async (data: FormValues) => {
    if (!editShift) return;
    try {
      await api.patch(`/shifts/${editShift.id}`, data);
      toast.success('Shift updated');
      setEditShift(null); fetchShifts();
    } catch { toast.error('Failed to update shift'); }
  };

  const inp: React.CSSProperties = { width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' };

  return (
    <div>
      <PageHeader
        title="Duty Shifts & Rosters"
        subtitle="Defined work shifts across plants and offices."
      />

      <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--ck-muted)' }}>
        {loading ? 'Loading shifts…' : `${shifts.length} shift definitions`}
      </div>

      {error ? (
        <Card padding={32}>
          <div style={{ textAlign: 'center', color: 'var(--ck-danger-fg)' }}>{error}</div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginBottom: 22 }}>
          {shifts.map((s) => {
            const tone = KIND_TONE[s.kind] || { bg: 'var(--ck-line-soft)', fg: 'var(--ck-muted)' };
            return (
              <Card key={s.id} padding={20}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: tone.bg,
                      color: tone.fg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Clock size={20} strokeWidth={1.8} />
                  </div>
                  <button
                    aria-label="Edit shift"
                    onClick={() => openEdit(s)}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      border: '1px solid var(--ck-line)',
                      background: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--ck-muted)',
                    }}
                  >
                    <Pencil size={14} />
                  </button>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ck-ink)', marginBottom: 2 }}>
                  {s.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ck-muted)', marginBottom: 14, fontFamily: 'var(--ck-font-mono)' }}>
                  {s.code}
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 999,
                    background: 'var(--ck-line-soft)',
                    color: 'var(--ck-ink)',
                    fontSize: 12.5,
                    fontWeight: 600,
                    fontFamily: 'var(--ck-font-mono)',
                    marginBottom: 12,
                  }}
                >
                  {s.start_time} – {s.end_time}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5 }}>
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: 999,
                      fontSize: 11.5,
                      fontWeight: 600,
                      background: tone.bg,
                      color: tone.fg,
                    }}
                  >
                    {s.kind}
                  </span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      color: 'var(--ck-muted)',
                    }}
                  >
                    <Coffee size={13} /> {s.break_min} min break
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card padding={24}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ck-ink)', marginBottom: 6 }}>
          Weekly roster
        </div>
        <div style={{ fontSize: 13, color: 'var(--ck-muted)' }}>
          The roster grid (employee × day) needs roster entries to be populated. Once we capture
          assignments — manually or by importing from biometrics — that grid lights up here.
        </div>
      </Card>

      <Modal open={!!editShift} onClose={() => { setEditShift(null); reset(); }} title="Edit Shift" width={420}
        footer={<>
          <Button onClick={() => { setEditShift(null); reset(); }}>Cancel</Button>
          <Button variant="primary" type="submit" form="shift-form" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save'}</Button>
        </>}
      >
        <form id="shift-form" onSubmit={handleSubmit(onSubmit)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <F2 label="Name *" error={errors.name?.message}><input {...register('name')} style={inp} /></F2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <F2 label="Start time *" error={errors.startTime?.message}><input type="time" {...register('startTime')} style={inp} /></F2>
              <F2 label="End time *" error={errors.endTime?.message}><input type="time" {...register('endTime')} style={inp} /></F2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <F2 label="Kind *" error={errors.kind?.message}><input {...register('kind')} style={inp} /></F2>
              <F2 label="Break (min) *" error={errors.breakMin?.message}><input type="number" {...register('breakMin')} style={inp} /></F2>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function F2({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ck-ink-soft)' }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 11.5, color: 'var(--ck-danger-fg)' }}>{error}</span>}
    </label>
  );
}

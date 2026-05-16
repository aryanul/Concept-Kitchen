// Applications tab for the Job Listing detail page.
//
// Add (manual upload), Fetch (stub — would pull from LinkedIn/Naukri/etc.),
// View, plus per-row actions Screen / Reject / Hold / Tag.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Plus, RefreshCcw, Search, MoreHorizontal, Tag as TagIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';

// ─── Types ─────────────────────────────────────────────────────────────────
export type Applicant = {
  id: string; app_no: string | null;
  full_name: string; email: string; phone: string | null;
  image_url: string | null;
  current_company: string | null; current_role: string | null;
  location: string | null;
  experience_years: number | string | null;
  salary_min: number | string | null; salary_max: number | string | null; salary_currency: string | null;
  education_level: string | null; institution: string | null;
  match_ratio: number | string | null;
  screen_score: number | string | null; interview_score: number | string | null;
  source: string | null; status: string;
  notes: string | null;
  applied_at: string;
  tags: Array<{ id: string; name: string; color: string | null }>;
};
type Lookup = { id: string; code: string; label: string; color: string | null; is_default?: number | boolean };
type Tag = { id: string; name: string; color: string | null };

const inp: React.CSSProperties = { width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' };

const addSchema = z.object({
  fullName: z.string().min(1, 'Required'),
  email:    z.string().email('Valid email required'),
  phone:    z.string().optional(),
  imageUrl: z.string().optional(),
  currentCompany: z.string().optional(),
  currentRole:    z.string().optional(),
  location:       z.string().optional(),
  experienceYears: z.coerce.number().optional(),
  salaryMin:       z.coerce.number().optional(),
  salaryMax:       z.coerce.number().optional(),
  salaryCurrency:  z.string().optional(),
  educationLevel:  z.string().optional(),
  institution:     z.string().optional(),
  matchRatio:      z.coerce.number().min(0).max(100).optional(),
  source:          z.string().optional(),
  status:          z.string().min(1, 'Required'),
  notes:           z.string().optional(),
});
type AddForm = z.infer<typeof addSchema>;

export function ApplicationsTab({ listingId }: { listingId: string }) {
  const [apps, setApps]       = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [statuses, setStatuses]     = useState<Lookup[]>([]);
  const [sources, setSources]       = useState<Lookup[]>([]);
  const [currencies, setCurrencies] = useState<Lookup[]>([]);
  const [educations, setEducations] = useState<Lookup[]>([]);
  const [tags, setTags]             = useState<Tag[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [tagTarget, setTagTarget] = useState<Applicant | null>(null);
  const [viewTarget, setViewTarget] = useState<Applicant | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const fetchApps = () => {
    setLoading(true);
    api.get<{ data: Applicant[] }>(`/job-listings/${listingId}/applicants`, { params: { search: search || undefined, status: statusFilter || undefined } })
      .then((r) => setApps(r.data.data))
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchApps(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [listingId, search, statusFilter]);
  useEffect(() => {
    api.get<{ data: Lookup[] }>('/lookups', { params: { category: 'applicant_status' } }).then((r) => setStatuses(r.data.data)).catch(() => {});
    api.get<{ data: Lookup[] }>('/lookups', { params: { category: 'applicant_source' } }).then((r) => setSources(r.data.data)).catch(() => {});
    api.get<{ data: Lookup[] }>('/lookups', { params: { category: 'salary_currency' } }).then((r) => setCurrencies(r.data.data)).catch(() => {});
    api.get<{ data: Lookup[] }>('/lookups', { params: { category: 'education_level' } }).then((r) => setEducations(r.data.data)).catch(() => {});
    api.get<{ data: Tag[] }>('/tags').then((r) => setTags(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  const setStatus = async (id: string, status: string) => {
    try { await api.patch(`/job-listing-applicants/${id}`, { status }); fetchApps(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--ck-muted)', pointerEvents: 'none' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, App ID..."
            style={{ width: '100%', height: 36, padding: '0 12px 0 32px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 12.5, background: 'var(--ck-surface)' }} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          style={{ height: 36, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, background: 'var(--ck-surface)', fontSize: 12.5, minWidth: 180 }}>
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s.id} value={s.code}>{s.label}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Button size="sm" variant="ghost" icon={RefreshCcw} onClick={() => toast.message('Portal fetch will arrive with API integrations.')}>Fetch</Button>
          <Button size="sm" variant="primary" icon={Plus} onClick={() => setAddOpen(true)}>Add</Button>
        </div>
      </div>

      {/* Table */}
      <div className="ck-table-wrap" style={{ border: '1px solid var(--ck-line)', borderRadius: 8, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
              {['APP ID', 'CANDIDATE', 'SOURCE', 'EXPERIENCE', 'CURRENT ROLE', 'COMPANY', 'LOCATION', 'SALARY', 'EDUCATION', 'MATCH %', 'STATUS', 'TAGS', ''].map((h) => (
                <th key={h} style={{ padding: '10px 10px', fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={13} style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)' }}>Loading…</td></tr>}
            {!loading && apps.length === 0 && (
              <tr><td colSpan={13} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
                No applications yet. Click "Add" to upload one manually.
              </td></tr>
            )}
            {apps.map((a, i) => {
              const status = statuses.find((s) => s.code === a.status);
              return (
                <tr key={a.id} style={{ borderTop: '1px solid var(--ck-line)' }}>
                  <td style={{ padding: '10px', fontFamily: 'var(--ck-font-mono)', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{a.app_no ?? '—'}</td>
                  <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={a.full_name} hue={(i * 53) % 360} size={32} />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--ck-ink)' }}>{a.full_name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ck-muted)' }}>{a.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px', color: 'var(--ck-ink-soft)' }}>{a.source ?? '—'}</td>
                  <td style={{ padding: '10px' }}>{a.experience_years != null ? `${a.experience_years}y` : '—'}</td>
                  <td style={{ padding: '10px', color: 'var(--ck-ink-soft)' }}>{a.current_role ?? '—'}</td>
                  <td style={{ padding: '10px', color: 'var(--ck-ink-soft)' }}>{a.current_company ?? '—'}</td>
                  <td style={{ padding: '10px', color: 'var(--ck-muted)' }}>{a.location ?? '—'}</td>
                  <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{formatSalary(a.salary_min, a.salary_max, a.salary_currency)}</td>
                  <td style={{ padding: '10px', color: 'var(--ck-ink-soft)' }}>
                    {a.education_level ?? '—'}
                    {a.institution && <div style={{ fontSize: 11, color: 'var(--ck-muted)' }}>{a.institution}</div>}
                  </td>
                  <td style={{ padding: '10px', fontWeight: 700, color: 'var(--ck-accent)' }}>{a.match_ratio != null ? `${a.match_ratio}%` : '—'}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: status?.color ?? 'var(--ck-line-soft)', color: status?.color ? '#fff' : 'var(--ck-ink-soft)' }}>
                      {status?.label ?? a.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 180 }}>
                      {a.tags.map((t) => (
                        <span key={t.id} style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, background: t.color ?? 'var(--ck-line-soft)', color: t.color ? '#fff' : 'var(--ck-ink-soft)' }}>
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '10px', position: 'relative' }}>
                    <button aria-label="Actions"
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === a.id ? null : a.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ck-muted)', padding: 4 }}>
                      <MoreHorizontal size={18} />
                    </button>
                    {menuOpen === a.id && (
                      <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', right: 12, top: 38, minWidth: 180, background: 'var(--ck-surface)', border: '1px solid var(--ck-line)', borderRadius: 8, boxShadow: 'var(--ck-shadow-lg)', zIndex: 10 }}>
                        <MenuItem onClick={() => { setMenuOpen(null); setViewTarget(a); }}>View</MenuItem>
                        <MenuItem onClick={() => { setMenuOpen(null); setStatus(a.id, 'Screening'); }}>Screen</MenuItem>
                        <MenuItem onClick={() => { setMenuOpen(null); setStatus(a.id, 'On Hold'); }}>Hold</MenuItem>
                        <MenuItem onClick={() => { setMenuOpen(null); setStatus(a.id, 'Rejected'); }}>Reject</MenuItem>
                        <MenuItem onClick={() => { setMenuOpen(null); setTagTarget(a); }}>Tag…</MenuItem>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <AddApplicantModal
          listingId={listingId}
          statuses={statuses} sources={sources} currencies={currencies} educations={educations} tags={tags}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); fetchApps(); toast.success('Applicant added'); }}
        />
      )}
      {tagTarget && (
        <TagPickerModal applicant={tagTarget} tags={tags}
          onClose={() => setTagTarget(null)}
          onSaved={() => { setTagTarget(null); fetchApps(); }} />
      )}
      {viewTarget && (
        <ViewApplicantModal applicant={viewTarget} statuses={statuses} onClose={() => setViewTarget(null)} />
      )}
    </div>
  );
}

function MenuItem({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ck-ink)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ck-surface-alt)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
      {children}
    </button>
  );
}

function formatSalary(min: number | string | null, max: number | string | null, currency: string | null): string {
  const lo = min != null && min !== '' ? Number(min) : null;
  const hi = max != null && max !== '' ? Number(max) : null;
  if (lo == null && hi == null) return '—';
  const cur = currency ?? '';
  if (lo != null && hi != null) return `${cur}${lo.toLocaleString('en-IN')} – ${hi.toLocaleString('en-IN')}`;
  return `${cur}${(lo ?? hi)?.toLocaleString('en-IN')}`;
}

// ─── Add modal ────────────────────────────────────────────────────────────
function AddApplicantModal({ listingId, statuses, sources, currencies, educations, tags, onClose, onSaved }: {
  listingId: string;
  statuses: Lookup[]; sources: Lookup[]; currencies: Lookup[]; educations: Lookup[]; tags: Tag[];
  onClose: () => void; onSaved: () => void;
}) {
  const defaultStatus = statuses.find((s) => Number(s.is_default))?.code ?? statuses[0]?.code ?? 'Screening';
  const form = useForm<AddForm>({
    resolver: zodResolver(addSchema),
    defaultValues: { status: defaultStatus, salaryCurrency: currencies[0]?.code ?? 'INR' },
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const onSubmit = async (data: AddForm) => {
    try {
      await api.post(`/job-listings/${listingId}/applicants`, { ...data, tags: selectedTags });
      onSaved();
    } catch { toast.error('Failed'); }
  };

  return (
    <Modal open onClose={onClose} title="Add Applicant" width={620}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" form="add-app" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Saving…' : 'Add Applicant'}
        </Button>
      </>}>
      <form id="add-app" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="ck-form-grid-2">
          <F label="Full name *" error={form.formState.errors.fullName?.message}><input {...form.register('fullName')} style={inp} /></F>
          <F label="Email *" error={form.formState.errors.email?.message}><input type="email" {...form.register('email')} style={inp} /></F>
          <F label="Phone"><input {...form.register('phone')} style={inp} /></F>
          <F label="Image URL"><input {...form.register('imageUrl')} style={inp} /></F>
          <F label="Source">
            <select {...form.register('source')} style={inp}>
              <option value="">— None —</option>
              {sources.map((s) => <option key={s.id} value={s.code}>{s.label}</option>)}
            </select>
          </F>
          <F label="Status *" error={form.formState.errors.status?.message}>
            <select {...form.register('status')} style={inp}>
              {statuses.map((s) => <option key={s.id} value={s.code}>{s.label}</option>)}
            </select>
          </F>
          <F label="Current role"><input {...form.register('currentRole')} style={inp} /></F>
          <F label="Current company"><input {...form.register('currentCompany')} style={inp} /></F>
          <F label="Location"><input {...form.register('location')} style={inp} /></F>
          <F label="Experience (years)"><input type="number" step="0.1" {...form.register('experienceYears')} style={inp} /></F>
          <F label="Salary min"><input type="number" {...form.register('salaryMin')} style={inp} /></F>
          <F label="Salary max"><input type="number" {...form.register('salaryMax')} style={inp} /></F>
          <F label="Currency">
            <select {...form.register('salaryCurrency')} style={inp}>
              {currencies.map((c) => <option key={c.id} value={c.code}>{c.label}</option>)}
            </select>
          </F>
          <F label="Match %"><input type="number" min={0} max={100} {...form.register('matchRatio')} style={inp} /></F>
          <F label="Education">
            <select {...form.register('educationLevel')} style={inp}>
              <option value="">— None —</option>
              {educations.map((e) => <option key={e.id} value={e.code}>{e.label}</option>)}
            </select>
          </F>
          <F label="Institution"><input {...form.register('institution')} style={inp} /></F>
          <F label="Tags" full>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: 8, border: '1px solid var(--ck-line)', borderRadius: 8, minHeight: 38 }}>
              {tags.map((t) => {
                const on = selectedTags.includes(t.id);
                return (
                  <button key={t.id} type="button"
                    onClick={() => setSelectedTags(on ? selectedTags.filter((x) => x !== t.id) : [...selectedTags, t.id])}
                    style={{
                      padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                      background: on ? (t.color ?? 'var(--ck-ink)') : 'var(--ck-surface-alt)',
                      color: on ? '#fff' : 'var(--ck-ink-soft)',
                      border: '1px solid ' + (on ? (t.color ?? 'var(--ck-ink)') : 'var(--ck-line)'),
                    }}>
                    {t.name}
                  </button>
                );
              })}
              {tags.length === 0 && <span style={{ fontSize: 12, color: 'var(--ck-muted)' }}>No tags defined. Add some in Masters → Tags.</span>}
            </div>
          </F>
          <F label="Notes" full><textarea {...form.register('notes')} rows={3} style={{ ...inp, height: 'auto', padding: 10 }} /></F>
        </div>
      </form>
    </Modal>
  );
}

// ─── Tag picker modal ─────────────────────────────────────────────────────
function TagPickerModal({ applicant, tags, onClose, onSaved }: { applicant: Applicant; tags: Tag[]; onClose: () => void; onSaved: () => void }) {
  const [selected, setSelected] = useState<string[]>(applicant.tags.map((t) => t.id));
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await api.patch(`/job-listing-applicants/${applicant.id}`, { tags: selected }); onSaved(); }
    catch { toast.error('Failed'); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Tag applicant" subtitle={applicant.full_name} width={420}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon={TagIcon} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save tags'}</Button>
      </>}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {tags.map((t) => {
          const on = selected.includes(t.id);
          return (
            <button key={t.id} onClick={() => setSelected(on ? selected.filter((x) => x !== t.id) : [...selected, t.id])}
              style={{
                padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: on ? (t.color ?? 'var(--ck-ink)') : 'var(--ck-surface-alt)',
                color: on ? '#fff' : 'var(--ck-ink-soft)',
                border: '1px solid ' + (on ? (t.color ?? 'var(--ck-ink)') : 'var(--ck-line)'),
              }}>
              {t.name}
            </button>
          );
        })}
        {tags.length === 0 && <div style={{ fontSize: 13, color: 'var(--ck-muted)' }}>No tags defined. Add some in Masters → Tags.</div>}
      </div>
    </Modal>
  );
}

// ─── View modal ───────────────────────────────────────────────────────────
function ViewApplicantModal({ applicant, statuses, onClose }: { applicant: Applicant; statuses: Lookup[]; onClose: () => void }) {
  const status = statuses.find((s) => s.code === applicant.status);
  return (
    <Modal open onClose={onClose} title={applicant.full_name} subtitle={applicant.app_no ?? ''} width={560}
      footer={<Button onClick={onClose}>Close</Button>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Detail label="Email" value={applicant.email} />
        <Detail label="Phone" value={applicant.phone ?? '—'} />
        <Detail label="Source" value={applicant.source ?? '—'} />
        <Detail label="Status" value={
          <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: status?.color ?? 'var(--ck-line-soft)', color: status?.color ? '#fff' : 'var(--ck-ink-soft)' }}>
            {status?.label ?? applicant.status}
          </span>
        } />
        <Detail label="Experience" value={applicant.experience_years != null ? `${applicant.experience_years} years` : '—'} />
        <Detail label="Match %" value={applicant.match_ratio != null ? `${applicant.match_ratio}%` : '—'} />
        <Detail label="Current role" value={applicant.current_role ?? '—'} />
        <Detail label="Current company" value={applicant.current_company ?? '—'} />
        <Detail label="Location" value={applicant.location ?? '—'} />
        <Detail label="Salary" value={formatSalary(applicant.salary_min, applicant.salary_max, applicant.salary_currency)} />
        <Detail label="Education" value={applicant.education_level ?? '—'} />
        <Detail label="Institution" value={applicant.institution ?? '—'} />
        {applicant.tags.length > 0 && (
          <Detail label="Tags" full value={
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {applicant.tags.map((t) => (
                <span key={t.id} style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: t.color ?? 'var(--ck-line-soft)', color: t.color ? '#fff' : 'var(--ck-ink-soft)' }}>{t.name}</span>
              ))}
            </div>
          } />
        )}
        {applicant.notes && <Detail label="Notes" full value={applicant.notes} />}
      </div>
    </Modal>
  );
}

function Detail({ label, value, full }: { label: string; value: ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--ck-ink)' }}>{value}</div>
    </div>
  );
}

function F({ label, error, full, children }: { label: string; error?: string; full?: boolean; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: full ? '1 / -1' : 'auto' }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ck-ink-soft)' }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 11.5, color: 'var(--ck-danger-fg)' }}>{error}</span>}
    </label>
  );
}


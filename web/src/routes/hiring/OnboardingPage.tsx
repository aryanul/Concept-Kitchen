import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, SlidersHorizontal, Mail, Phone, Eye, Play, Printer, Ban, Archive,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Modal } from '../../components/ui/Modal';

type HiredApplicant = {
  id: string; app_no: string | null; image_url: string | null;
  full_name: string; email: string; phone: string | null;
  current_company: string | null; current_role: string | null; location: string | null;
  experience_years: number | string | null;
  salary_min: number | string | null; salary_max: number | string | null; salary_currency: string | null;
  education_level: string | null; institution: string | null;
  match_ratio: number | string | null; match_score: number | null;
  screen_score: number | null; interview_score: number | null;
  source: string | null;
  branch_name: string | null; company_name: string | null;
  designation: string | null; job_title: string | null;
  applicant_status: string | null;
  offer_ctc: string | number | null; offer_currency: string | null;
  offer_joining_date: string | null; offer_designation: string | null;
  onboarding_status: string;
  promoted_employee_id: string | null;
  applied_at: string;
};

type SalaryGrade = { id: string; code: string; kind: string; min_gross: number | string; max_gross: number | string };

const STATUS_STYLE: Record<string, { background: string; color: string; border: string }> = {
  pending:    { background: '#fff',    color: '#888',    border: '1px solid #ccc' },
  onboarding: { background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' },
  onboarded:  { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' },
  completed:  { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' },
};

export function OnboardingPage() {
  const navigate = useNavigate();
  const [applicants, setApplicants] = useState<HiredApplicant[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [viewTarget, setViewTarget] = useState<HiredApplicant | null>(null);
  const [closeTarget, setCloseTarget] = useState<HiredApplicant | null>(null);
  const [grades, setGrades] = useState<SalaryGrade[]>([]);

  const fetchApplicants = () => {
    setLoading(true);
    const params = search ? { search } : {};
    api.get<{ data: HiredApplicant[] }>('/applicants/hired', { params })
      .then((r) => setApplicants(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(fetchApplicants, [search]);
  useEffect(() => {
    api.get<{ data: SalaryGrade[] }>('/salary-grades', { params: { pageSize: 200 } })
      .then((r) => setGrades(r.data.data ?? [])).catch(() => {});
  }, []);

  const reject = async (a: HiredApplicant) => {
    if (!window.confirm(`Reject ${a.full_name}? This will mark the applicant rejected and end onboarding.`)) return;
    try {
      await api.post(`/applicants/${a.id}/reject`);
      toast.success(`${a.full_name} rejected`);
      fetchApplicants();
    } catch { toast.error('Reject failed'); }
  };

  return (
    <div>
      <PageHeader title="Induction & Onboarding"
        subtitle="Onboarding process begins here. Manage giveaways, induction, account opening, and training." />

      <Card padding={0}>
        <div style={{ display: 'flex', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--ck-line)', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 420 }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--ck-muted)', pointerEvents: 'none' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Candidates...."
              style={{ width: '100%', height: 36, padding: '0 12px 0 32px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 12.5, background: 'var(--ck-surface)' }} />
          </div>
          <Button variant="ghost" size="sm" icon={SlidersHorizontal}>Filters</Button>
        </div>

        <div className="ck-table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
                <th style={{ width: 40, padding: '10px 10px 10px 16px' }}><input type="checkbox" /></th>
                {['APP ID', 'CANDIDATE', 'CONTACT', 'EXPERIENCE', 'SCORES', 'CTC / JOINING', 'STATUS', 'ACTIONS'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>Loading…</td></tr>
              )}
              {!loading && applicants.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
                  No hired candidates yet. Complete the hiring pipeline to see candidates here.
                </td></tr>
              )}
              {applicants.map((a, i) => {
                const sstyle = STATUS_STYLE[a.onboarding_status] ?? STATUS_STYLE['pending'];
                const appId = a.app_no ?? `APP${String(i + 1).padStart(3, '0')}`;
                const onboarded = a.onboarding_status === 'onboarded' || a.onboarding_status === 'completed';
                return (
                  <tr key={a.id} style={{ borderTop: '1px solid var(--ck-line)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ck-surface-alt)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '12px 10px 12px 16px' }}><input type="checkbox" /></td>
                    <td style={{ padding: '12px', fontWeight: 700, color: 'var(--ck-ink)', fontFamily: 'var(--ck-font-mono)', fontSize: 12 }}>{appId}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={a.full_name} hue={(i * 53) % 360} size={38} />
                        <div>
                          {/* Super-link: name opens the View modal which shows offer letter + details */}
                          <button onClick={() => setViewTarget(a)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                              fontWeight: 700, color: 'var(--ck-accent)', textAlign: 'left', textDecoration: 'underline' }}>
                            {a.full_name}
                          </button>
                          <div style={{ fontSize: 11.5, color: 'var(--ck-muted)' }}>{a.branch_name ?? '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--ck-ink-soft)' }}>
                          <Mail size={11} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140, whiteSpace: 'nowrap' }}>{a.email}</span>
                        </div>
                        {a.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--ck-ink-soft)' }}>
                            <Phone size={11} />{a.phone}
                          </div>
                        )}
                        {a.source && <div style={{ fontSize: 11, color: 'oklch(0.55 0.14 250)' }}>{a.source}</div>}
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ck-ink)' }}>{a.experience_years != null ? `${a.experience_years} years` : '—'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ck-muted)', marginTop: 2 }}>{a.offer_designation ?? a.designation ?? a.job_title}</div>
                      <div style={{ fontSize: 11, color: 'var(--ck-muted)' }}>{a.company_name ?? '—'}</div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {a.match_ratio != null || a.screen_score != null || a.interview_score != null ? (
                        <div style={{ fontSize: 11.5, lineHeight: 1.7 }}>
                          {a.match_ratio != null && (
                            <div>
                              <span style={{ color: 'var(--ck-muted)', width: 70, display: 'inline-block' }}>Match</span>
                              <button onClick={() => setViewTarget(a)} style={{ ...linkBtn, fontWeight: 700 }}>{a.match_ratio}%</button>
                            </div>
                          )}
                          {a.screen_score != null && (
                            <div>
                              <span style={{ color: 'var(--ck-muted)', width: 70, display: 'inline-block' }}>Screen</span>
                              <button onClick={() => setViewTarget(a)} style={{ ...linkBtn, fontWeight: 700 }}>{a.screen_score}%</button>
                            </div>
                          )}
                          {a.interview_score != null && (
                            <div>
                              <span style={{ color: 'var(--ck-muted)', width: 70, display: 'inline-block' }}>Interview</span>
                              <button onClick={() => setViewTarget(a)} style={{ ...linkBtn, fontWeight: 700 }}>{a.interview_score}%</button>
                            </div>
                          )}
                        </div>
                      ) : <span style={{ color: 'var(--ck-faint)', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: '12px', fontSize: 12 }}>
                      {a.offer_ctc != null
                        ? <div style={{ fontWeight: 600, color: 'var(--ck-ink)' }}>{(a.offer_currency ?? '') + ' ' + Number(a.offer_ctc).toLocaleString('en-IN')}</div>
                        : <span style={{ color: 'var(--ck-faint)' }}>—</span>}
                      <div style={{ fontSize: 11, color: 'var(--ck-muted)' }}>
                        {a.offer_joining_date ? `joins ${a.offer_joining_date.slice(0, 10)}` : 'no joining date'}
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ ...sstyle, padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, display: 'inline-block', textTransform: 'capitalize' }}>
                        {a.onboarding_status}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <IconBtn title="View / Offer letter" onClick={() => setViewTarget(a)}><Eye size={16} /></IconBtn>
                        <IconBtn title={onboarded ? 'View Onboarding' : a.onboarding_status === 'pending' ? 'Start Onboarding' : 'Continue Onboarding'}
                          onClick={() => navigate(`/onboarding/${a.id}`)} variant={onboarded ? undefined : 'success'}>
                          <Play size={16} />
                        </IconBtn>
                        <IconBtn title="Print ID Card" onClick={() => window.open(`/onboarding/${a.id}/id-card`, '_blank', 'noopener,noreferrer')}><Printer size={16} /></IconBtn>
                        <IconBtn title="Close & Archive" disabled={onboarded} onClick={() => setCloseTarget(a)} variant="success">
                          <Archive size={16} />
                        </IconBtn>
                        <IconBtn title="Reject" disabled={onboarded} onClick={() => reject(a)} variant="danger"><Ban size={16} /></IconBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {viewTarget && <ViewApplicantModal applicant={viewTarget} onClose={() => setViewTarget(null)} />}
      {closeTarget && (
        <CloseArchiveModal applicant={closeTarget} grades={grades}
          onClose={() => setCloseTarget(null)}
          onSaved={() => { setCloseTarget(null); fetchApplicants(); }} />
      )}
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, marginLeft: 4, cursor: 'pointer',
  color: 'var(--ck-accent)', textDecoration: 'underline', fontSize: 11.5,
};

function IconBtn({ title, onClick, children, variant, disabled }: {
  title: string; onClick: () => void; children: ReactNode;
  variant?: 'danger' | 'success'; disabled?: boolean;
}) {
  const fg = variant === 'danger' ? '#b91c1c' : variant === 'success' ? '#15803d' : 'var(--ck-ink)';
  return (
    <button aria-label={title} title={title} onClick={onClick} disabled={disabled}
      style={{
        background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        color: 'var(--ck-muted)',
        padding: 6, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.background = 'var(--ck-surface-alt)'; e.currentTarget.style.color = fg; } }}
      onMouseLeave={(e) => { if (!disabled) { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--ck-muted)'; } }}>
      {children}
    </button>
  );
}

// ─── View modal — applicant details + offer letter preview ────────────────
function ViewApplicantModal({ applicant, onClose }: { applicant: HiredApplicant; onClose: () => void }) {
  const [offer, setOffer] = useState<{ draft_body: string | null; ctc: string | number | null; ctc_currency: string | null; joining_date: string | null; designation: string | null; status: string } | null>(null);
  useEffect(() => {
    api.get(`/applicants/${applicant.id}/offer`).then((r) => setOffer(r.data?.data ?? null)).catch(() => {});
  }, [applicant.id]);

  return (
    <Modal open onClose={onClose} title={applicant.full_name} subtitle={applicant.app_no ?? ''} width={720}
      footer={<Button onClick={onClose}>Close</Button>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
        <Detail label="Email" value={applicant.email} />
        <Detail label="Phone" value={applicant.phone ?? '—'} />
        <Detail label="Source" value={applicant.source ?? '—'} />
        <Detail label="Designation" value={applicant.offer_designation ?? applicant.designation ?? '—'} />
        <Detail label="Experience" value={applicant.experience_years != null ? `${applicant.experience_years} years` : '—'} />
        <Detail label="Current role" value={applicant.current_role ?? '—'} />
        <Detail label="Current company" value={applicant.current_company ?? '—'} />
        <Detail label="Location" value={applicant.location ?? '—'} />
        <Detail label="Match Ratio" value={applicant.match_ratio != null ? `${applicant.match_ratio}%` : '—'} />
        <Detail label="Screening Score" value={applicant.screen_score != null ? `${applicant.screen_score}%` : '—'} />
        <Detail label="Interview Score" value={applicant.interview_score != null ? `${applicant.interview_score}%` : '—'} />
        <Detail label="Education" value={applicant.education_level ?? '—'} />
        <Detail label="Institution" value={applicant.institution ?? '—'} />
        <Detail label="Offer CTC" value={applicant.offer_ctc != null ? `${applicant.offer_currency ?? ''} ${Number(applicant.offer_ctc).toLocaleString('en-IN')}` : '—'} />
        <Detail label="Joining date" value={applicant.offer_joining_date?.slice(0, 10) ?? '—'} />
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Offer letter {offer?.status ? `· ${offer.status}` : ''}
        </div>
        {offer?.draft_body
          ? <pre style={{ padding: 14, background: 'var(--ck-surface-alt)', borderRadius: 8, fontSize: 12.5, lineHeight: 1.55,
              whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: 'var(--ck-ink)', margin: 0, maxHeight: 280, overflowY: 'auto' }}>
              {offer.draft_body}
            </pre>
          : <div style={{ padding: 14, background: 'var(--ck-line-soft)', borderRadius: 8, fontSize: 12.5, color: 'var(--ck-muted)' }}>
              No offer letter drafted yet.
            </div>}
      </div>
    </Modal>
  );
}

// ─── Close & Archive modal — picks salary grade, then promotes to employees ─
function CloseArchiveModal({ applicant, grades, onClose, onSaved }: {
  applicant: HiredApplicant; grades: SalaryGrade[]; onClose: () => void; onSaved: () => void;
}) {
  const [gradeId, setGradeId] = useState('');
  const [createEmployee, setCreateEmployee] = useState(true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const r = await api.post<{ data: { employeeId: string | null; employeeCode: string | null; warning: string | null } }>(
        `/applicants/${applicant.id}/onboarding/close`,
        { createEmployee, gradeId: gradeId || null }
      );
      if (r.data.data?.warning) {
        toast.message(r.data.data.warning);
      } else if (r.data.data?.employeeCode) {
        toast.success(`Onboarding closed. Employee created: ${r.data.data.employeeCode}`);
      } else {
        toast.success('Onboarding closed');
      }
      onSaved();
    } catch { toast.error('Failed to close'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Close & Archive Onboarding" subtitle={applicant.full_name} width={520}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit} disabled={saving || (createEmployee && !gradeId)}>
          {saving ? 'Closing…' : 'Close & Archive'}
        </Button>
      </>}>
      <div style={{ fontSize: 13, color: 'var(--ck-ink-soft)', marginBottom: 14, lineHeight: 1.55 }}>
        Marks onboarding as <strong>onboarded</strong>. When "Create employee" is on, an
        Employees record is created from the offer + onboarding header data, allocated
        assets are re-pointed to the new employee, and the assigned phone is bound to them.
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 12 }}>
        <input type="checkbox" checked={createEmployee} onChange={(e) => setCreateEmployee(e.target.checked)} />
        Create employees record on close
      </label>
      {createEmployee && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ck-ink-soft)' }}>Salary grade *</span>
          <select value={gradeId} onChange={(e) => setGradeId(e.target.value)}
            style={{ height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' }}>
            <option value="">Select grade</option>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.code} · {g.kind}</option>)}
          </select>
          <span style={{ fontSize: 11.5, color: 'var(--ck-muted)' }}>
            Other fields (branch, department, designation, CTC, joining date) come from the offer and onboarding header.
          </span>
        </label>
      )}
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--ck-ink)' }}>{value}</div>
    </div>
  );
}


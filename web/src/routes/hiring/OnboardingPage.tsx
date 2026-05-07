import { useEffect, useState, type ReactNode } from 'react';
import { Search, SlidersHorizontal, Mail, Phone, X, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';

// ─── Types ─────────────────────────────────────────────────────────────────────
type HiredApplicant = {
  id: string; full_name: string; email: string; phone: string | null;
  current_company: string | null; experience_years: number | string | null;
  match_score: number | null; screen_score: number | null; interview_score: number | null;
  source: string | null; branch_name: string; company_name: string;
  designation: string | null; job_title: string; onboarding_status: string; applied_at: string;
};

type OnboardingSession = {
  id?: string; giveaways: string[] | null; email_assigned: string | null;
  phone_assigned: string | null; induction_notes: string | null;
  onboarding_notes: string | null; training_notes: string | null; status: string;
};

type GiveawayTemplate = { id: string; name: string };

const STATUS_STYLE: Record<string, { background: string; color: string; border: string }> = {
  pending:       { background: '#fff',     color: '#888', border: '1px solid #ccc' },
  onboarding:    { background: '#f0f9ff',  color: '#0369a1', border: '1px solid #bae6fd' },
  completed:     { background: '#f0fdf4',  color: '#166534', border: '1px solid #bbf7d0' },
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function OnboardingPage() {
  const [applicants, setApplicants] = useState<HiredApplicant[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [selected,   setSelected]   = useState<HiredApplicant | null>(null);

  const fetchApplicants = () => {
    setLoading(true);
    const params = search ? { search } : {};
    api.get<{ data: HiredApplicant[] }>('/applicants/hired', { params })
      .then((r) => setApplicants(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(fetchApplicants, [search]);

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
                {['APPLICATION ID', 'CANDIDATE', 'CONTACT', 'EXPERIENCE', 'SCORES', 'STATUS', 'ACTIONS'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && applicants.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
                  No hired candidates yet. Complete the hiring pipeline to see candidates here.
                </td></tr>
              )}
              {applicants.map((a, i) => {
                const sstyle = STATUS_STYLE[a.onboarding_status] ?? STATUS_STYLE['pending'];
                const appId = `APP${String(i + 1).padStart(3, '0')}`;
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
                          <div style={{ fontWeight: 700, color: 'var(--ck-ink)' }}>{a.full_name}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--ck-muted)' }}>{a.branch_name}</div>
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
                      <div style={{ fontSize: 11.5, color: 'var(--ck-muted)', marginTop: 2 }}>{a.designation ?? a.job_title}</div>
                      <div style={{ fontSize: 11, color: 'var(--ck-muted)' }}>{a.company_name}</div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {a.match_score != null || a.screen_score != null || a.interview_score != null ? (
                        <div style={{ fontSize: 11.5, lineHeight: 1.7 }}>
                          {a.match_score != null && <div><span style={{ color: 'var(--ck-muted)', width: 70, display: 'inline-block' }}>Match</span><strong>: {a.match_score}%</strong></div>}
                          {a.screen_score != null && <div><span style={{ color: 'var(--ck-muted)', width: 70, display: 'inline-block' }}>Screen</span><strong>: {a.screen_score}%</strong></div>}
                          {a.interview_score != null && <div><span style={{ color: 'var(--ck-muted)', width: 70, display: 'inline-block' }}>Interview</span><strong>: {a.interview_score}%</strong></div>}
                        </div>
                      ) : <span style={{ color: 'var(--ck-faint)', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ ...sstyle, padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, display: 'inline-block', textTransform: 'capitalize' }}>
                        {a.onboarding_status === 'pending' ? 'Pending' : a.onboarding_status === 'onboarding' ? 'Onboarding' : 'Completed'}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <Button size="sm" variant="primary" onClick={() => setSelected(a)}>
                        Start Onboarding
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && (
        <OnboardingModal applicant={selected} onClose={() => { setSelected(null); fetchApplicants(); }} />
      )}
    </div>
  );
}

// ─── Onboarding Modal ─────────────────────────────────────────────────────────
function OnboardingModal({ applicant, onClose }: { applicant: HiredApplicant; onClose: () => void }) {
  const [tab,        setTab]       = useState<'pre' | 'induction' | 'onboarding' | 'trainings'>('pre');
  const [session,    setSession]   = useState<OnboardingSession | null>(null);
  const [templates,  setTemplates] = useState<GiveawayTemplate[]>([]);
  const [giveaways,  setGiveaways] = useState<string[]>([]);
  const [emailAddr,       setEmailAddr]       = useState('');
  const [phone,           setPhone]           = useState('');
  const [setupEmail,      setSetupEmail]      = useState(false);
  const [inductionNotes,  setInductionNotes]  = useState('');
  const [onboardingNotes, setOnboardingNotes] = useState('');
  const [trainingNotes,   setTrainingNotes]   = useState('');
  const [saving,          setSaving]          = useState(false);
  const [newGiveaway,     setNewGiveaway]     = useState('');

  useEffect(() => {
    api.get<{ data: OnboardingSession | null }>(`/applicants/${applicant.id}/onboarding`)
      .then((r) => {
        const s = r.data.data;
        if (s) {
          setSession(s);
          setGiveaways(Array.isArray(s.giveaways) ? s.giveaways : (s.giveaways ? JSON.parse(s.giveaways as unknown as string) : []));
          setEmailAddr(s.email_assigned ?? applicant.email);
          setPhone(s.phone_assigned ?? applicant.phone ?? '');
          setInductionNotes(s.induction_notes ?? '');
          setOnboardingNotes(s.onboarding_notes ?? '');
          setTrainingNotes(s.training_notes ?? '');
        } else {
          setEmailAddr(applicant.email);
          setPhone(applicant.phone ?? '');
        }
      }).catch(() => {});
    api.get<{ data: GiveawayTemplate[] }>('/onboarding/giveaways')
      .then((r) => setTemplates(r.data.data)).catch(() => {});
  }, [applicant.id]);

  const addGiveaway = (name: string) => {
    if (name && !giveaways.includes(name)) setGiveaways((g) => [...g, name]);
    setNewGiveaway('');
  };
  const removeGiveaway = (name: string) => setGiveaways((g) => g.filter((x) => x !== name));

  const save = async () => {
    setSaving(true);
    try {
      await api.post(`/applicants/${applicant.id}/onboarding`, {
        giveaways,
        emailAssigned: emailAddr || null,
        phoneAssigned: phone || null,
        inductionNotes: inductionNotes || null,
        onboardingNotes: onboardingNotes || null,
        trainingNotes: trainingNotes || null,
        status: 'onboarding',
      });
      toast.success('Saved');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const TABS: { key: typeof tab; label: string }[] = [
    { key: 'pre',        label: 'Pre On Boarding' },
    { key: 'induction',  label: 'Induction' },
    { key: 'onboarding', label: 'Onboarding' },
    { key: 'trainings',  label: 'Trainings' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: '100%', maxWidth: 760, background: 'var(--ck-surface)', borderRadius: 14, boxShadow: 'var(--ck-shadow-lg)', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}>

        {/* Candidate header */}
        <div style={{ padding: '20px 24px 0', position: 'relative', borderBottom: '1px solid var(--ck-line)' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 20, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ck-muted)' }}>
            <X size={20} />
          </button>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
            <Avatar name={applicant.full_name} hue={220} size={56} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ck-ink)', marginBottom: 4 }}>{applicant.full_name}</div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12.5, color: 'var(--ck-muted)', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={12} />{applicant.email}</span>
                {applicant.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={12} />{applicant.phone}</span>}
                <span>{applicant.company_name}</span>
                <span>{applicant.branch_name}</span>
                <span style={{ padding: '2px 10px', borderRadius: 4, border: '1px solid #ccc', fontSize: 11.5, color: '#666' }}>
                  {session?.status === 'onboarding' ? 'Onboarding' : 'Pending'}
                </span>
              </div>
            </div>
          </div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2 }}>
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ padding: '8px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, borderRadius: '8px 8px 0 0',
                  background: tab === t.key ? '#222' : 'var(--ck-line-soft)',
                  color: tab === t.key ? '#fff' : 'var(--ck-muted)' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div style={{ padding: 24, maxHeight: '60vh', overflowY: 'auto' }}>
          {tab === 'pre' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Give Aways */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ck-ink)' }}>Give Aways</div>
                  <Button size="sm" variant="primary" icon={Plus} onClick={() => addGiveaway(newGiveaway)}>Add Give Away</Button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
                  {giveaways.map((g) => (
                    <div key={g} style={{ padding: '12px', border: '1px solid var(--ck-line)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative' }}>
                      <button onClick={() => removeGiveaway(g)} style={{ position: 'absolute', top: 6, right: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ck-muted)', padding: 0 }}>
                        <Trash2 size={13} />
                      </button>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--ck-line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🎁</div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ck-ink)', textAlign: 'center' }}>{g}</span>
                    </div>
                  ))}
                  {templates.filter((t) => !giveaways.includes(t.name)).map((t) => (
                    <div key={t.id} onClick={() => addGiveaway(t.name)}
                      style={{ padding: '12px', border: '2px dashed var(--ck-line)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', opacity: 0.6 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--ck-line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>+</div>
                      <span style={{ fontSize: 12, color: 'var(--ck-muted)', textAlign: 'center' }}>{t.name}</span>
                    </div>
                  ))}
                </div>
                {/* Custom giveaway input */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={newGiveaway} onChange={(e) => setNewGiveaway(e.target.value)} placeholder="Add custom item…"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGiveaway(newGiveaway); } }}
                    style={{ flex: 1, height: 36, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' }} />
                  <Button size="sm" onClick={() => addGiveaway(newGiveaway)}>Add</Button>
                </div>
              </div>

              {/* Email & Phone */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ck-ink)' }}>Email &amp; Phone</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={setupEmail} onChange={(e) => setSetupEmail(e.target.checked)} />
                    Setup Email Account
                  </label>
                </div>
                <div className="ck-form-grid-2">
                  <FL label="Email Address"><input value={emailAddr} onChange={(e) => setEmailAddr(e.target.value)} style={{ width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: setupEmail ? 'var(--ck-surface)' : 'var(--ck-line-soft)', color: 'var(--ck-ink)' }} /></FL>
                  {setupEmail && (
                    <FL label="Password"><input type="password" placeholder="••••••••••••" style={{ width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' }} /></FL>
                  )}
                  <FL label="Phone Assignment" full={!setupEmail}>
                    <select value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' }}>
                      <option value="">Select Phone Number</option>
                      {applicant.phone && <option value={applicant.phone}>{applicant.phone} (applicant)</option>}
                    </select>
                  </FL>
                </div>
              </div>
            </div>
          )}

          {tab === 'induction' && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ck-ink)', marginBottom: 8 }}>Induction</div>
              <div style={{ fontSize: 12.5, color: 'var(--ck-muted)', marginBottom: 10 }}>Record induction notes, documents checked, and sessions completed.</div>
              <textarea
                value={inductionNotes}
                onChange={(e) => setInductionNotes(e.target.value)}
                rows={10}
                placeholder="e.g. Company policy briefing completed, ID proof collected, team introduction done…"
                style={{ width: '100%', padding: 12, border: '1px solid var(--ck-line)', borderRadius: 8, fontSize: 13, background: 'var(--ck-surface)', resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>
          )}

          {tab === 'onboarding' && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ck-ink)', marginBottom: 8 }}>Onboarding</div>
              <div style={{ fontSize: 12.5, color: 'var(--ck-muted)', marginBottom: 10 }}>Track onboarding tasks — system access, team introductions, first-week goals.</div>
              <textarea
                value={onboardingNotes}
                onChange={(e) => setOnboardingNotes(e.target.value)}
                rows={10}
                placeholder="e.g. Laptop assigned, email account created, Slack added to team channels, first project briefed…"
                style={{ width: '100%', padding: 12, border: '1px solid var(--ck-line)', borderRadius: 8, fontSize: 13, background: 'var(--ck-surface)', resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>
          )}

          {tab === 'trainings' && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ck-ink)', marginBottom: 8 }}>Trainings</div>
              <div style={{ fontSize: 12.5, color: 'var(--ck-muted)', marginBottom: 10 }}>Note training programs assigned, completion status, and upcoming sessions.</div>
              <textarea
                value={trainingNotes}
                onChange={(e) => setTrainingNotes(e.target.value)}
                rows={10}
                placeholder="e.g. Product safety training — scheduled 10 May, Excel Advanced — completed 8 May…"
                style={{ width: '100%', padding: 12, border: '1px solid var(--ck-line)', borderRadius: 8, fontSize: 13, background: 'var(--ck-surface)', resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--ck-line)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save Progress'}</Button>
        </div>
      </div>
    </div>
  );
}

function FL({ label, full, children }: { label: string; full?: boolean; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: full ? '1 / -1' : 'auto' }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ck-ink-soft)' }}>{label}</span>
      {children}
    </label>
  );
}

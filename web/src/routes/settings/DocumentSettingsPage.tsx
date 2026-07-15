import { useCallback, useEffect, useState } from 'react';
import { FileText, Building2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { MediaUpload } from '../../components/ui/MediaUpload';
import { api } from '../../lib/api';
import { useAuth } from '../../stores/auth';

type OrgProfile = { companyName?: string; addressLine?: string; city?: string; logoUrl?: string; email?: string; phone?: string };
type Template = {
  doc_type: string; title: string; show_letterhead: number; letterhead_url: string | null;
  body_template: string | null; signatory_name: string | null; signatory_designation: string | null;
  signature_url: string | null; footer_text: string | null; accent_color: string; enabled: number;
};

const PLACEHOLDERS = [
  'employee_name', 'employee_code', 'designation', 'department', 'branch', 'joining_date',
  'last_working_day', 'exit_type', 'reason', 'company_name', 'company_address', 'today',
  'net_payable', 'gross_earnings', 'total_deductions',
];

const label: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--ck-faint)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 5, display: 'block' };
const input: React.CSSProperties = { width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--ck-line)', background: 'var(--ck-bg)', fontSize: 13, fontFamily: 'inherit', outline: 'none' };

export function DocumentSettingsPage() {
  const isAdmin = useAuth((s) => s.user?.role) === 'HR_ADMIN';
  const [org, setOrg] = useState<OrgProfile>({});
  const [templates, setTemplates] = useState<Template[]>([]);

  const load = useCallback(async () => {
    try {
      const [o, t] = await Promise.all([
        api.get<{ data: OrgProfile }>('/settings/org-profile'),
        api.get<{ data: Template[] }>('/document-templates'),
      ]);
      setOrg(o.data.data ?? {});
      setTemplates(t.data.data);
    } catch { /* silent */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader
        title="Document Templates"
        subtitle="Configure letterhead, letter text, signatory and organisation profile used to generate exit documents."
      />

      {!isAdmin && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--ck-muted)' }}>Only HR Admins can edit document templates. You can view the current configuration below.</div>
        </Card>
      )}

      {/* Org profile */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Building2 size={18} style={{ color: 'var(--ck-accent)' }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ck-ink)' }}>Organisation Profile</span>
          <span style={{ fontSize: 12, color: 'var(--ck-muted)' }}>— resolves the company placeholders</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><label style={label}>Company Name</label><input value={org.companyName ?? ''} onChange={(e) => setOrg({ ...org, companyName: e.target.value })} style={input} disabled={!isAdmin} /></div>
          <div><label style={label}>City</label><input value={org.city ?? ''} onChange={(e) => setOrg({ ...org, city: e.target.value })} style={input} disabled={!isAdmin} /></div>
          <div><label style={label}>Address Line</label><input value={org.addressLine ?? ''} onChange={(e) => setOrg({ ...org, addressLine: e.target.value })} style={input} disabled={!isAdmin} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={label}>Email</label><input value={org.email ?? ''} onChange={(e) => setOrg({ ...org, email: e.target.value })} style={input} disabled={!isAdmin} /></div>
            <div><label style={label}>Phone</label><input value={org.phone ?? ''} onChange={(e) => setOrg({ ...org, phone: e.target.value })} style={input} disabled={!isAdmin} /></div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label}>Logo (used when a template has no letterhead image)</label>
            <MediaUpload mode="image" value={org.logoUrl ?? ''} onChange={(url) => setOrg({ ...org, logoUrl: url })} readOnly={!isAdmin} />
          </div>
        </div>
        {isAdmin && (
          <div style={{ marginTop: 16 }}>
            <Button variant="primary" icon={Save} onClick={async () => {
              try { await api.put('/settings/org-profile', org); toast.success('Organisation profile saved'); }
              catch { toast.error('Failed to save'); }
            }}>Save Profile</Button>
          </div>
        )}
      </Card>

      {/* Placeholder reference */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ck-ink-soft)', marginBottom: 8 }}>Available placeholders — paste any of these into a template body:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PLACEHOLDERS.map((p) => (
            <code key={p} style={{ fontSize: 11.5, background: 'var(--ck-line-soft)', padding: '2px 7px', borderRadius: 5, color: 'var(--ck-ink)' }}>{`{{${p}}}`}</code>
          ))}
        </div>
      </Card>

      {/* Templates */}
      {templates.map((t) => (
        <TemplateCard key={t.doc_type} template={t} isAdmin={isAdmin} onSaved={load} />
      ))}
    </div>
  );
}

function TemplateCard({ template, isAdmin, onSaved }: { template: Template; isAdmin: boolean; onSaved: () => void }) {
  const [t, setT] = useState(template);
  useEffect(() => { setT(template); }, [template]);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/document-templates/${t.doc_type}`, {
        title: t.title, showLetterhead: t.show_letterhead, letterheadUrl: t.letterhead_url,
        bodyTemplate: t.body_template, signatoryName: t.signatory_name, signatoryDesignation: t.signatory_designation,
        signatureUrl: t.signature_url, footerText: t.footer_text, accentColor: t.accent_color, enabled: t.enabled,
      });
      toast.success(`${t.title} saved`);
      onSaved();
    } catch { toast.error('Failed to save'); } finally { setSaving(false); }
  }

  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <FileText size={18} style={{ color: 'var(--ck-accent)' }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ck-ink)' }}>{t.title}</span>
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ck-ink-soft)', cursor: isAdmin ? 'pointer' : 'default' }}>
          <input type="checkbox" checked={!!t.enabled} disabled={!isAdmin} onChange={(e) => setT({ ...t, enabled: e.target.checked ? 1 : 0 })} /> Enabled
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div><label style={label}>Document Title</label><input value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} style={input} disabled={!isAdmin} /></div>
        <div><label style={label}>Accent Colour</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={t.accent_color} onChange={(e) => setT({ ...t, accent_color: e.target.value })} disabled={!isAdmin} style={{ width: 44, height: 38, border: '1px solid var(--ck-line)', borderRadius: 8, background: 'none', cursor: 'pointer' }} />
            <input value={t.accent_color} onChange={(e) => setT({ ...t, accent_color: e.target.value })} style={{ ...input, width: 120 }} disabled={!isAdmin} />
          </div>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ ...label, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', fontSize: 12.5 }}>
            <input type="checkbox" checked={!!t.show_letterhead} disabled={!isAdmin} onChange={(e) => setT({ ...t, show_letterhead: e.target.checked ? 1 : 0 })} />
            Show letterhead image (overrides the org logo/name header)
          </label>
          {!!t.show_letterhead && <MediaUpload mode="image" value={t.letterhead_url ?? ''} onChange={(url) => setT({ ...t, letterhead_url: url })} readOnly={!isAdmin} />}
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={label}>Body Text</label>
          <textarea value={t.body_template ?? ''} onChange={(e) => setT({ ...t, body_template: e.target.value })} rows={7} disabled={!isAdmin}
            style={{ ...input, height: 'auto', padding: 10, resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit' }} />
        </div>
        <div><label style={label}>Signatory Name</label><input value={t.signatory_name ?? ''} onChange={(e) => setT({ ...t, signatory_name: e.target.value })} style={input} disabled={!isAdmin} /></div>
        <div><label style={label}>Signatory Designation</label><input value={t.signatory_designation ?? ''} onChange={(e) => setT({ ...t, signatory_designation: e.target.value })} style={input} disabled={!isAdmin} /></div>
        <div><label style={label}>Signature Image (optional)</label><MediaUpload mode="image" value={t.signature_url ?? ''} onChange={(url) => setT({ ...t, signature_url: url })} readOnly={!isAdmin} /></div>
        <div><label style={label}>Footer Text</label><input value={t.footer_text ?? ''} onChange={(e) => setT({ ...t, footer_text: e.target.value })} style={input} disabled={!isAdmin} /></div>
      </div>

      {isAdmin && (
        <div style={{ marginTop: 16 }}>
          <Button variant="primary" icon={Save} onClick={save} disabled={saving}>{saving ? 'Saving…' : `Save ${t.title}`}</Button>
        </div>
      )}
    </Card>
  );
}

// Dedicated ID Card print page.
//
// Opens in its own tab (linked from the Onboarding list page Print icon and
// the detail page ID Card section). Renders a credit-card-sized layout for
// Concept Kitchen with logo / photo / name / designation / location, and
// auto-triggers the browser print dialog once data has loaded.
//
// The component sets document.title before printing so the browser uses the
// candidate name as the filename suggestion when "Save as PDF" is chosen.

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, X } from 'lucide-react';
import { api } from '../../lib/api';
import { Avatar } from '../../components/ui/Avatar';

type Applicant = {
  id: string; app_no: string | null; image_url: string | null;
  full_name: string; email: string; phone: string | null;
  designation: string | null; job_title: string | null;
  branch_name: string | null; branch_city: string | null;
  location_name: string | null;
};

type AOParent = {
  id: string;
  email_assigned: string | null;
  phone_assigned: string | null;
  id_card_printed_at: string | null;
} | null;

export function IdCardPage() {
  const { applicantId = '' } = useParams<{ applicantId: string }>();
  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [parent, setParent] = useState<AOParent>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoPrinted, setAutoPrinted] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<{ data: Applicant }>(`/applicants/${applicantId}`),
      api.get<{ data: { parent: AOParent } }>(`/applicants/${applicantId}/onboarding/full`).catch(() => ({ data: { data: { parent: null } } })),
    ])
      .then(([a, full]) => {
        setApplicant(a.data.data);
        setParent(full.data.data?.parent ?? null);
      })
      .catch(() => setError('Failed to load applicant'));
  }, [applicantId]);

  // Auto-print once data is ready. Stamp id_card_printed_at server-side too.
  useEffect(() => {
    if (!applicant || autoPrinted) return;
    setAutoPrinted(true);
    document.title = `ID Card · ${applicant.full_name}`;
    api.patch(`/applicants/${applicantId}/onboarding/header`, { idCardPrintedAt: new Date().toISOString() }).catch(() => {});
    // Defer a tick so the layout settles before the print dialog fires.
    const t = setTimeout(() => { window.print(); }, 250);
    return () => clearTimeout(t);
  }, [applicant, applicantId, autoPrinted]);

  if (error) return <div style={{ padding: 40 }}>{error}</div>;
  if (!applicant) return <div style={{ padding: 40, color: 'var(--ck-muted)' }}>Loading ID card…</div>;

  const designation = applicant.designation ?? applicant.job_title ?? '—';
  const branchLine = [applicant.branch_name, applicant.location_name ?? applicant.branch_city].filter(Boolean).join(' · ');
  const email = parent?.email_assigned ?? applicant.email;
  const phone = parent?.phone_assigned ?? applicant.phone;
  const idLine = applicant.app_no ?? applicant.id;

  return (
    <>
      {/* Print-only stylesheet — strips browser chrome, sizes the card. */}
      <style>{`
        @page { size: 86mm 54mm; margin: 0; }
        body { background: #f1f5f9; }
        @media print {
          body { background: #fff !important; }
          .id-toolbar { display: none !important; }
          .id-card-wrap { padding: 0 !important; box-shadow: none !important; min-height: 0 !important; }
          .id-card { box-shadow: none !important; transform: none !important; }
        }
      `}</style>

      <div className="id-toolbar" style={{
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 20px', background: '#fff', borderBottom: '1px solid #e5e7eb',
      }}>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          ID Card · <strong style={{ color: '#111' }}>{applicant.full_name}</strong>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.print()} style={btnPrimary}><Printer size={14} /> Print again</button>
          <button onClick={() => window.close()} style={btnGhost}><X size={14} /> Close</button>
        </div>
      </div>

      <div className="id-card-wrap" style={{
        minHeight: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 40, gap: 24,
      }}>
        {/* Front of the card */}
        <div className="id-card" style={cardOuter}>
          <div style={cardHeader}>
            <Logo />
            <div style={{ fontSize: 7.5, letterSpacing: '0.18em', opacity: 0.85 }}>EMPLOYEE ID</div>
          </div>
          <div style={cardBody}>
            <div style={{ width: 78, height: 78, borderRadius: 8, overflow: 'hidden', background: '#1f2937', flexShrink: 0,
              border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>
              {applicant.image_url
                ? <img src={applicant.image_url} alt={applicant.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <Avatar name={applicant.full_name} hue={220} size={78} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1.15, marginBottom: 2 }}>
                {applicant.full_name}
              </div>
              <div style={{ fontSize: 9, color: '#fff', opacity: 0.9, marginBottom: 8, lineHeight: 1.25 }}>
                {designation}
              </div>
              <div style={{ fontSize: 7.5, color: '#fff', opacity: 0.75, lineHeight: 1.6 }}>
                {branchLine && <div>{branchLine}</div>}
                {email && <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>}
                {phone && <div>{phone}</div>}
              </div>
            </div>
          </div>
          <div style={cardFooter}>
            <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: 7, opacity: 0.7 }}>{idLine}</div>
            <div style={{ fontSize: 6.5, opacity: 0.6, letterSpacing: '0.06em' }}>conceptkitchen.com</div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', maxWidth: 360 }}>
          If the print dialog didn't open automatically, click <strong>Print again</strong> above.
        </div>
      </div>
    </>
  );
}

// Lightweight inline-SVG logo so we don't need a static asset.
function Logo() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="20" height="20" rx="5" fill="#fff" />
        <path d="M7 14.5c0-3 2-5 5-5s5 2 5 5" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="8" r="1.6" fill="#0f172a" />
      </svg>
      <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.14em', color: '#fff' }}>CONCEPT KITCHEN</span>
    </div>
  );
}

const cardOuter: React.CSSProperties = {
  width: '86mm', height: '54mm', borderRadius: '4mm',
  background: 'linear-gradient(135deg, #1f2937 0%, #0f172a 100%)',
  boxShadow: '0 10px 35px rgba(15, 23, 42, 0.35)', color: '#fff',
  padding: '5mm 6mm', boxSizing: 'border-box',
  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
};
const cardHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const cardBody:   React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'flex-start', flex: 1 };
const cardFooter: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: 'none', borderRadius: 7, background: '#0f172a', color: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 };
const btnGhost:   React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: '1px solid #e5e7eb', borderRadius: 7, background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 };

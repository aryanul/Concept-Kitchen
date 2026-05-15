import { useRef, useState } from 'react';
import { Upload, ClipboardPaste, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { api } from '../../../lib/api';

type Tab = 'live' | 'csv' | 'paste';

// Mapping of incoming CSV/paste headers → API field names.
// Keep flexible so we can ingest LinkedIn exports later without code changes.
const HEADER_ALIASES: Record<string, string> = {
  'name': 'name', 'full name': 'name', 'full_name': 'name',
  'email': 'email', 'email address': 'email',
  'phone': 'phone', 'phone number': 'phone', 'mobile': 'phone',
  'platform': 'platform', 'source': 'platform',
  'experience': 'experienceYears', 'experience years': 'experienceYears', 'years of experience': 'experienceYears', 'exp': 'experienceYears',
  'current role': 'currentRole', 'role': 'currentRole', 'designation': 'currentRole', 'title': 'currentRole',
  'company': 'company', 'current company': 'company', 'employer': 'company',
  'location': 'location', 'city': 'location',
  'salary range': 'salaryRange', 'salary': 'salaryRange', 'expected salary': 'salaryRange',
  'education': 'education', 'qualification': 'education', 'degree': 'education',
  'institution': 'institution', 'college': 'institution', 'university': 'institution',
  'match ratio': 'matchRatio', 'match': 'matchRatio',
  'engagement signal': 'engagementSignal', 'signal': 'engagementSignal',
  'application status': 'applicationStatus', 'status': 'applicationStatus',
};

function parseCsvLine(line: string): string[] {
  // Simple CSV parser: handles quoted fields with commas inside.
  const out: string[] = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuote = false;
      else cur += ch;
    } else {
      if (ch === '"') inQuote = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const fieldNames = headers.map((h) => HEADER_ALIASES[h] ?? h);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < fieldNames.length; j++) {
      if (cells[j] != null && cells[j] !== '') row[fieldNames[j]] = cells[j];
    }
    if (row.name || row.email) rows.push(row);
  }
  return rows;
}

export function NestConnectImportModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const [tab, setTab] = useState<Tab>('live');
  const [paste, setPaste] = useState('');
  const [parsed, setParsed] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File | null) => {
    if (!f) return;
    const text = await f.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      toast.error('No valid rows found. Need at least "name" and "email" columns.');
      return;
    }
    setParsed(rows);
    setPaste(text);
    toast.success(`Parsed ${rows.length} row${rows.length === 1 ? '' : 's'}`);
  };

  const handlePasteParse = () => {
    const rows = parseCsv(paste);
    if (rows.length === 0) {
      toast.error('No valid rows. First line should be headers including "name" and "email".');
      return;
    }
    setParsed(rows);
    toast.success(`Parsed ${rows.length} row${rows.length === 1 ? '' : 's'}`);
  };

  const doImport = async () => {
    if (parsed.length === 0) return;
    setImporting(true);
    try {
      const r = await api.post<{ data: { inserted: number; skipped: number; total: number } }>('/prospects/import', { rows: parsed });
      const { inserted, skipped } = r.data.data;
      toast.success(`Imported ${inserted} prospect${inserted === 1 ? '' : 's'}${skipped > 0 ? ` (${skipped} skipped)` : ''}`);
      setParsed([]); setPaste('');
      onImported();
      onClose();
    } catch {
      toast.error('Import failed');
    } finally { setImporting(false); }
  };

  return (
    <Modal open={open} onClose={onClose}
      title="Nest Connect"
      subtitle="AI-assisted prospect discovery and import"
      width={680}
      footer={parsed.length > 0 ? <>
        <Button size="sm" onClick={() => { setParsed([]); setPaste(''); }}>Clear</Button>
        <Button size="sm" variant="primary" disabled={importing} onClick={doImport}>
          {importing ? 'Importing…' : `Import ${parsed.length} Prospect${parsed.length === 1 ? '' : 's'}`}
        </Button>
      </> : <Button size="sm" onClick={onClose}>Close</Button>}>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--ck-line)' }}>
        <button onClick={() => setTab('live')} style={tabStyle(tab === 'live')}>
          <Sparkles size={13} style={{ marginRight: 6 }} /> Live Sync
        </button>
        <button onClick={() => setTab('csv')} style={tabStyle(tab === 'csv')}>
          <Upload size={13} style={{ marginRight: 6 }} /> Upload CSV
        </button>
        <button onClick={() => setTab('paste')} style={tabStyle(tab === 'paste')}>
          <ClipboardPaste size={13} style={{ marginRight: 6 }} /> Paste Rows
        </button>
      </div>

      {tab === 'live' && (
        <div style={{ padding: 28, textAlign: 'center', background: 'var(--ck-bg)', border: '1px dashed var(--ck-line)', borderRadius: 10 }}>
          <Sparkles size={32} strokeWidth={1.4} style={{ color: 'var(--ck-muted)', marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ck-ink)', marginBottom: 6 }}>
            Live LinkedIn / Naukri sync — Coming Soon
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ck-muted)', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
            Real-time prospect discovery via LinkedIn Sales Navigator and Naukri APIs is pending integration. For now, export candidates from those platforms and use <strong>Upload CSV</strong> or <strong>Paste Rows</strong>.
          </div>
        </div>
      )}

      {tab === 'csv' && (
        <div>
          <div style={{ fontSize: 12.5, color: 'var(--ck-muted)', marginBottom: 14 }}>
            Upload a CSV exported from LinkedIn / Naukri / your spreadsheet. Required columns: <code>name</code>, <code>email</code>. Optional: phone, platform, experience, current role, company, location, salary range, education, institution, match ratio, engagement signal, application status.
          </div>
          <div onClick={() => fileRef.current?.click()}
            style={{ padding: 36, border: '2px dashed var(--ck-line)', borderRadius: 10, textAlign: 'center', cursor: 'pointer', background: 'var(--ck-bg)' }}>
            <Upload size={28} strokeWidth={1.4} style={{ color: 'var(--ck-muted)', marginBottom: 8 }} />
            <div style={{ fontSize: 13, color: 'var(--ck-ink)', fontWeight: 600, marginBottom: 4 }}>Click to upload .csv</div>
            <div style={{ fontSize: 11.5, color: 'var(--ck-muted)' }}>First row should be column headers</div>
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
        </div>
      )}

      {tab === 'paste' && (
        <div>
          <div style={{ fontSize: 12.5, color: 'var(--ck-muted)', marginBottom: 8 }}>
            Paste CSV-style rows. First line = header row.
          </div>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)}
            placeholder={'name,email,phone,company,current_role\nAsha Rao,asha@example.com,+91…,Acme,Senior Manager'}
            rows={8}
            style={{ width: '100%', padding: 12, border: '1px solid var(--ck-line)', borderRadius: 8, fontFamily: 'var(--ck-font-mono)', fontSize: 12, background: 'var(--ck-surface)', resize: 'vertical' }} />
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="sm" onClick={handlePasteParse} disabled={!paste.trim()}>Parse Rows</Button>
          </div>
        </div>
      )}

      {parsed.length > 0 && (
        <div style={{ marginTop: 18, padding: 12, background: 'var(--ck-surface-alt)', border: '1px solid var(--ck-line)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ck-ink)', marginBottom: 8 }}>
            Preview — {parsed.length} row{parsed.length === 1 ? '' : 's'}
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto', fontSize: 11.5 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--ck-bg)' }}>
                  <th style={previewTh}>Name</th>
                  <th style={previewTh}>Email</th>
                  <th style={previewTh}>Company</th>
                  <th style={previewTh}>Role</th>
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 10).map((r, i) => (
                  <tr key={i}>
                    <td style={previewTd}>{r.name || '—'}</td>
                    <td style={previewTd}>{r.email || '—'}</td>
                    <td style={previewTd}>{r.company || '—'}</td>
                    <td style={previewTd}>{r.currentRole || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.length > 10 && (
              <div style={{ padding: 6, textAlign: 'center', color: 'var(--ck-muted)' }}>… and {parsed.length - 10} more</div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center',
    padding: '8px 14px', background: 'transparent', border: 'none',
    borderBottom: active ? '2px solid var(--ck-ink)' : '2px solid transparent',
    color: active ? 'var(--ck-ink)' : 'var(--ck-muted)',
    cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 500,
    marginBottom: -1,
  };
}
const previewTh: React.CSSProperties = { padding: '6px 10px', fontSize: 10.5, fontWeight: 600, color: 'var(--ck-muted)', textAlign: 'left', borderBottom: '1px solid var(--ck-line)' };
const previewTd: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid var(--ck-line)' };

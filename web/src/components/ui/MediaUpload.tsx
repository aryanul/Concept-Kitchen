import { useRef, useState } from 'react';
import { Upload, X, FileText, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';

type Props = {
  /** 'image' previews as thumbnail; 'file' shows a link. */
  mode: 'image' | 'file';
  value?: string | null;
  onChange: (v: string) => void;
  /** Max file size in MB (default 10). */
  maxFileMb?: number;
  /** Override the file input's accept attribute. */
  accept?: string;
  /** Show only a preview (no upload/remove buttons) — for view mode. */
  readOnly?: boolean;
};

const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px',
  border: '1px solid var(--ck-line)', borderRadius: 8, background: 'var(--ck-surface)',
  fontSize: 12.5, fontWeight: 600, color: 'var(--ck-ink-soft)', cursor: 'pointer',
};

function isImageUrl(url: string): boolean {
  return (
    url.startsWith('data:image') ||
    /\/image\/upload\//i.test(url) ||   // Cloudinary image
    /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(url)
  );
}

export function MediaUpload({ mode, value, onChange, maxFileMb = 10, accept, readOnly }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const hasValue = !!value;
  const isImage = !!value && isImageUrl(value);

  if (readOnly) {
    if (!hasValue) return <span style={{ fontSize: 13, color: 'var(--ck-muted)' }}>—</span>;
    return isImage
      ? <img src={value as string} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--ck-line)' }} />
      : <a href={value as string} target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: 'none', color: 'var(--ck-accent)' }}><Eye size={14} /> View file</a>;
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    if (mode === 'image' && !file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > maxFileMb * 1024 * 1024) {
      toast.error(`File too large — maximum is ${maxFileMb} MB`);
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', mode === 'image' ? 'image' : 'raw');
      const res = await api.post<{ data: { url: string; publicId: string } }>('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(res.data.data.url);
    } catch {
      toast.error('Upload failed — please try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {hasValue && isImage ? (
        <img src={value as string} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--ck-line)' }} />
      ) : hasValue ? (
        <a href={value as string} target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: 'none', color: 'var(--ck-accent)' }}>
          <Eye size={14} /> View file
        </a>
      ) : (
        <div style={{ width: 48, height: 48, borderRadius: 8, border: '1px dashed var(--ck-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ck-faint)', flexShrink: 0 }}>
          {busy
            ? <Loader2 size={18} className="ck-spin" />
            : mode === 'image' ? <Upload size={18} /> : <FileText size={18} />
          }
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept ?? (mode === 'image' ? 'image/*' : undefined)}
        onChange={onFile}
        style={{ display: 'none' }}
      />

      <button
        type="button"
        style={{ ...btn, opacity: busy ? 0.6 : 1 }}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy
          ? <><Loader2 size={14} className="ck-spin" /> Uploading…</>
          : <><Upload size={14} /> {hasValue ? 'Replace' : (mode === 'image' ? 'Upload image' : 'Upload file')}</>
        }
      </button>

      {hasValue && !busy && (
        <button type="button" style={{ ...btn, color: 'var(--ck-danger-fg)' }} onClick={() => onChange('')}>
          <X size={14} /> Remove
        </button>
      )}
    </div>
  );
}

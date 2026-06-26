import { useRef, useState } from 'react';
import { Upload, X, FileText, Eye } from 'lucide-react';
import { toast } from 'sonner';

/** Downscale an image file to a JPEG data URL no larger than `max` px on a side. */
export function resizeImageToDataUrl(file: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('no canvas context'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Read any file as a base64 data URL (used for documents — no resizing). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

type Props = {
  /** 'image' resizes + previews; 'file' stores any document as-is. */
  mode: 'image' | 'file';
  value?: string | null;
  onChange: (v: string) => void;
  /** Max document size in MB (file mode only). */
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

/**
 * Upload control that stores the chosen file as a base64 data URL (this
 * deployment has no external file storage). Images are downscaled; documents
 * are stored as-is up to `maxFileMb`. Replaces "paste a URL" inputs.
 */
export function MediaUpload({ mode, value, onChange, maxFileMb = 5, accept, readOnly }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const hasValue = !!value;
  // data:image uploads, or legacy http(s) links that point at an image file.
  const isImage = !!value && (value.startsWith('data:image') || /^https?:\/\/.*\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(value));

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
    if (mode === 'image' && !file.type.startsWith('image/')) { toast.error('Please choose an image file'); return; }
    if (mode === 'file' && file.size > maxFileMb * 1024 * 1024) { toast.error(`File too large (max ${maxFileMb} MB)`); return; }
    setBusy(true);
    try {
      onChange(mode === 'image' ? await resizeImageToDataUrl(file, 512) : await fileToDataUrl(file));
    } catch { toast.error('Could not read that file'); }
    finally { setBusy(false); }
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
          {mode === 'image' ? <Upload size={18} /> : <FileText size={18} />}
        </div>
      )}
      <input ref={inputRef} type="file" accept={accept ?? (mode === 'image' ? 'image/*' : undefined)} onChange={onFile} style={{ display: 'none' }} />
      <button type="button" style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => inputRef.current?.click()}>
        <Upload size={14} /> {busy ? 'Processing…' : hasValue ? 'Replace' : (mode === 'image' ? 'Upload image' : 'Upload file')}
      </button>
      {hasValue && (
        <button type="button" style={{ ...btn, color: 'var(--ck-danger-fg)' }} onClick={() => onChange('')}>
          <X size={14} /> Remove
        </button>
      )}
    </div>
  );
}

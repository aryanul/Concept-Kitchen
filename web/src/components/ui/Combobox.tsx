import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

type Props = {
  value: string;
  onChange: (v: string) => void;
  /** Suggestions pulled from a master; the user can also type a free value. */
  options: string[];
  placeholder?: string;
  style?: React.CSSProperties;
  /** Allow values not present in `options` (default true). */
  allowCustom?: boolean;
};

/**
 * Themed, type-ahead combobox: an editable input that filters `options` as you
 * type and lets you pick one, while still accepting free text. Replaces the
 * native <select> so the dropdown matches the app theme and is searchable.
 */
export function Combobox({ value, onChange, options, placeholder, style, allowCustom = true }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const q = value.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const choose = (val: string) => { onChange(val); setOpen(false); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, filtered.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); return; }
    if (e.key === 'Enter' && open) {
      if (filtered[active]) { e.preventDefault(); choose(filtered[active]); }
      else setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="ck-combo">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        style={{ paddingRight: 26, ...style }}
      />
      <ChevronDown
        size={14}
        onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        className="ck-combo__chevron"
      />
      {open && (
        <div className="ck-combo-panel" role="listbox">
          {filtered.length === 0 ? (
            <div className="ck-combo-empty">
              {allowCustom ? 'No match — keep typing to use a custom value' : 'No matches'}
            </div>
          ) : (
            filtered.map((o, i) => (
              <div
                key={`${o}-${i}`}
                role="option"
                aria-selected={o === value}
                data-active={i === active}
                className="ck-combo-option"
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); choose(o); }}
              >
                {o}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

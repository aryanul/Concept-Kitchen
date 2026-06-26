import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { IconAction } from './IconAction';
import { Tooltip } from './Tooltip';

export type ActionItem = {
  icon: LucideIcon;
  /** Short caption (e.g. "View", "Print"). */
  label: string;
  /** Richer text used for the inline hover tooltip and the menu row. */
  hint?: string;
  onClick: () => void;
  tone?: 'default' | 'danger' | 'success' | 'warning';
  disabled?: boolean;
};

type Props = {
  actions: ActionItem[];
  /** How many actions to show inline before collapsing the rest into a ⋯ menu. */
  inlineCount?: number;
  iconSize?: number;
};

/**
 * Compact action row: shows the first `inlineCount` actions inline (icon +
 * caption + hover tooltip) and tucks the remainder into a ⋯ overflow menu,
 * so dense tables stay narrow without losing any action or its caption.
 */
export function ActionBar({ actions, inlineCount = 2, iconSize = 14 }: Props) {
  const inline = actions.slice(0, inlineCount);
  const overflow = actions.slice(inlineCount);
  return (
    <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      {inline.map((a, i) => (
        <IconAction
          key={i}
          icon={a.icon}
          label={a.label}
          hint={a.hint}
          tone={a.tone}
          disabled={a.disabled}
          iconSize={iconSize}
          onClick={a.onClick}
        />
      ))}
      {overflow.length > 0 && <OverflowMenu items={overflow} />}
    </div>
  );
}

function OverflowMenu({ items }: { items: ActionItem[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const menuW = 184;
    const left = Math.max(8, Math.min(r.right - menuW, window.innerWidth - menuW - 8));
    setPos({ top: r.bottom + 6, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onScroll = () => setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  return (
    <>
      <Tooltip label="More actions">
        <button
          ref={btnRef}
          type="button"
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={open}
          className="ck-iconaction ck-iconaction--plain"
          onClick={() => setOpen((o) => !o)}
        >
          <MoreHorizontal size={16} />
        </button>
      </Tooltip>
      {open && pos && createPortal(
        <div ref={menuRef} role="menu" className="ck-actionmenu" style={{ top: pos.top, left: pos.left }}>
          {items.map((a, i) => (
            <button
              key={i}
              role="menuitem"
              type="button"
              disabled={a.disabled}
              className={`ck-actionmenu__item${a.tone === 'danger' ? ' ck-actionmenu__item--danger' : ''}`}
              onClick={() => { setOpen(false); a.onClick(); }}
            >
              <a.icon size={15} />
              <span>{a.hint ?? a.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

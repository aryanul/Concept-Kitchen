import type { ReactNode } from 'react';

type Props = {
  /** Caption text shown in the bubble on hover / keyboard focus. */
  label: ReactNode;
  /** Element the tooltip is attached to (a button, icon, link, etc.). */
  children: ReactNode;
  /** Show the bubble below the target instead of above. */
  placement?: 'top' | 'bottom';
};

/**
 * Lightweight, CSS-driven tooltip. Appears on hover AND keyboard focus
 * (focus-within), styled with the --ck-* design tokens. Wrap any element:
 *   <Tooltip label="Download report"><button>…</button></Tooltip>
 */
export function Tooltip({ label, children, placement = 'top' }: Props) {
  return (
    <span className={`ck-tip${placement === 'bottom' ? ' ck-tip--bottom' : ''}`}>
      {children}
      <span className="ck-tip__bubble" role="tooltip">{label}</span>
    </span>
  );
}

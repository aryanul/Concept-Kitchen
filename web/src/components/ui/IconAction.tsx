import type { MouseEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Tooltip } from './Tooltip';

type Props = {
  icon: LucideIcon;
  /** Visible caption next to the icon (e.g. "View", "Edit", "Delete"). */
  label: string;
  /** Richer hover-tooltip text. Defaults to `label` when omitted. */
  hint?: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  /** "bordered" (default) matches table action chips; "plain" is borderless. */
  variant?: 'bordered' | 'plain';
  tone?: 'default' | 'danger' | 'success' | 'warning';
  /** Hide the visible caption, keeping only the hover tooltip. */
  iconOnly?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  iconSize?: number;
  tipPlacement?: 'top' | 'bottom';
};

/**
 * Icon button with an always-visible caption AND a hover/focus tooltip, so
 * every icon in the UI is self-explanatory. Use across action columns,
 * toolbars and headers in place of bare icon <button>s.
 */
export function IconAction({
  icon: Icon,
  label,
  hint,
  onClick,
  variant = 'bordered',
  tone = 'default',
  iconOnly = false,
  disabled = false,
  type = 'button',
  iconSize = 14,
  tipPlacement = 'top',
}: Props) {
  const cls = [
    'ck-iconaction',
    variant === 'plain' ? 'ck-iconaction--plain' : '',
    tone !== 'default' ? `ck-iconaction--${tone}` : '',
  ].filter(Boolean).join(' ');

  return (
    <Tooltip label={hint ?? label} placement={tipPlacement}>
      <button
        type={type}
        className={cls}
        aria-label={hint ?? label}
        onClick={onClick}
        disabled={disabled}
        style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
      >
        <Icon size={iconSize} strokeWidth={2} />
        {!iconOnly && <span className="ck-iconaction__label">{label}</span>}
      </button>
    </Tooltip>
  );
}

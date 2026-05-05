import type { ReactNode, MouseEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  children?: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
};

const SIZES: Record<Size, { p: string; fs: number; h: number; iconSize: number }> = {
  sm: { p: '6px 12px',  fs: 12.5, h: 32, iconSize: 14 },
  md: { p: '9px 16px',  fs: 13,   h: 38, iconSize: 16 },
  lg: { p: '11px 20px', fs: 14,   h: 44, iconSize: 18 },
};

const VARIANTS: Record<Variant, { bg: string; fg: string; border: string; hover: string }> = {
  primary:   { bg: '#272727',     fg: '#fff',     border: '#272727', hover: '#000' },
  accent:    { bg: '#E91E63',     fg: '#fff',     border: '#E91E63', hover: '#C2185B' },
  secondary: { bg: '#fff',        fg: '#272727',  border: '#E5E7EB', hover: '#F9FAFB' },
  ghost:     { bg: 'transparent', fg: '#4D4D4D',  border: 'transparent', hover: '#F3F4F6' },
  danger:    { bg: '#E8504C',     fg: '#fff',     border: '#E8504C', hover: '#c8413d' },
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: IconCmp,
  children,
  onClick,
  disabled,
  type = 'button',
}: Props) {
  const sz = SIZES[size];
  const v = VARIANTS[variant];
  const [hover, setHover] = useState(false);
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: sz.h,
        padding: sz.p,
        fontSize: sz.fs,
        fontWeight: 600,
        background: hover && !disabled ? v.hover : v.bg,
        color: v.fg,
        border: `1px solid ${v.border}`,
        borderRadius: 10,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
        transition: 'background 120ms',
      }}
    >
      {IconCmp && <IconCmp size={sz.iconSize} strokeWidth={2} />}
      {children}
    </button>
  );
}

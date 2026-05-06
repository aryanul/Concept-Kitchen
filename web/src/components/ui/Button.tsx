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
  form?: string;
};

const SIZES: Record<Size, { p: string; fs: number; h: number; iconSize: number }> = {
  sm: { p: '6px 12px',  fs: 12.5, h: 32, iconSize: 14 },
  md: { p: '9px 16px',  fs: 13,   h: 38, iconSize: 16 },
  lg: { p: '11px 20px', fs: 14,   h: 44, iconSize: 18 },
};

const VARIANTS: Record<Variant, { bg: string; fg: string; border: string; hover: string }> = {
  primary:   { bg: '#6f6f6f',     fg: '#fff',     border: '#6f6f6f', hover: '#5f5f5f' },
  accent:    { bg: '#6f6f6f',     fg: '#fff',     border: '#6f6f6f', hover: '#5f5f5f' },
  secondary: { bg: '#fff',        fg: '#2f2f2f',  border: '#d8d8d8', hover: '#f3f3f3' },
  ghost:     { bg: 'transparent', fg: '#4a4a4a',  border: 'transparent', hover: '#f1f1f1' },
  danger:    { bg: '#e8504c',     fg: '#fff',     border: '#e8504c', hover: '#c8413d' },
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: IconCmp,
  children,
  onClick,
  disabled,
  type = 'button',
  form,
}: Props) {
  const sz = SIZES[size];
  const v = VARIANTS[variant];
  const [hover, setHover] = useState(false);
  return (
    <button
      type={type}
      form={form}
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
        borderRadius: 12,
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

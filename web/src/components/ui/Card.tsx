import type { CSSProperties, ReactNode } from 'react';

type Props = {
  children?: ReactNode;
  padding?: number;
  style?: CSSProperties;
};

export function Card({ children, padding = 24, style }: Props) {
  return (
    <div
      style={{
        background: 'var(--ck-surface)',
        border: '1px solid var(--ck-line)',
        borderRadius: 10,
        padding,
        boxShadow: 'var(--ck-shadow-sm)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

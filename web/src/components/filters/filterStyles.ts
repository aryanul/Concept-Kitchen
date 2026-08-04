import type { CSSProperties } from 'react';

export const inputStyle: CSSProperties = {
  height: 34,
  padding: '0 10px',
  borderRadius: 7,
  border: '1px solid var(--ck-line)',
  background: 'var(--ck-bg)',
  color: 'var(--ck-ink)',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
};

export const selectStyle: CSSProperties = {
  ...inputStyle,
  paddingRight: 28,
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239ca3af'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  cursor: 'pointer',
  minWidth: 140,
};

export const labelStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--ck-faint)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

export const thStyle: CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--ck-faint)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid var(--ck-line)',
  background: 'var(--ck-bg)',
  whiteSpace: 'nowrap',
};

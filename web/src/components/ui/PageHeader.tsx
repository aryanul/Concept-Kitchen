import type { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 16,
        padding: '14px 16px',
        background: 'var(--ck-line-soft)',
        border: '1px solid var(--ck-line)',
        borderRadius: 10,
      }}
    >
      <div>
        <h1
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--ck-ink)',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ck-muted)' }}>{subtitle}</p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

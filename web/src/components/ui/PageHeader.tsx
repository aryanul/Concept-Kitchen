import type { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <div className="ck-page-header">
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1
          style={{
            fontSize: 'clamp(16px, 2.5vw, 20px)',
            fontWeight: 700,
            color: 'var(--ck-ink)',
            letterSpacing: '-0.01em',
            margin: 0,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 12.5,
              color: 'var(--ck-muted)',
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          {actions}
        </div>
      )}
    </div>
  );
}

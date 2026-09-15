type Props = {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  onChange: (key: string) => void;
};

export function Tabs({ tabs, active, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 16px',
              borderRadius: 999,
              border: `1px solid ${isActive ? 'var(--ck-accent)' : 'var(--ck-line)'}`,
              background: isActive ? 'var(--ck-accent)' : 'var(--ck-surface)',
              color: isActive ? '#fff' : 'var(--ck-ink-soft)',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 120ms',
            }}
          >
            {t.label}
            {t.count != null && (
              <span
                style={{
                  padding: '1px 8px',
                  borderRadius: 999,
                  background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--ck-line-soft)',
                  color: isActive ? '#fff' : 'var(--ck-ink-soft)',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

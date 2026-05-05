type Props = { size?: number };

export function BrandMark({ size = 36 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="ck-brand-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E91E63" />
          <stop offset="1" stopColor="#C2185B" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#ck-brand-gradient)" />
      <path d="M32 14 L48 32 L32 50 L20 32 Z M32 14 L20 32 M32 50 L20 32" stroke="white" strokeWidth="3" fill="none" />
      <path d="M32 14 L32 50" stroke="white" strokeWidth="3" />
    </svg>
  );
}

export function BrandWordmark({ markSize = 36 }: { markSize?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <BrandMark size={markSize} />
      <div style={{ lineHeight: 1.05 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ck-ink)', letterSpacing: '-0.01em' }}>
          Concept
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ck-ink)', letterSpacing: '-0.01em' }}>
          kitchen<span style={{ color: 'var(--ck-accent)' }}>.</span>
        </div>
      </div>
    </div>
  );
}

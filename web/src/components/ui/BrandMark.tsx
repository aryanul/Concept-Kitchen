type Props = { size?: number };

export function BrandMark({ size = 36 }: Props) {
  return (
    <img
      src="/logock.png"
      alt="Concept Kitchen"
      style={{ height: size, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
    />
  );
}

export function BrandWordmark({ markSize = 40 }: { markSize?: number }) {
  return (
    <img
      src="/logock.png"
      alt="Concept Kitchen"
      style={{ height: markSize, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
    />
  );
}

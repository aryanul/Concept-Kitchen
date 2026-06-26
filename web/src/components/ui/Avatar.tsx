type Props = {
  name?: string;
  initials?: string;
  size?: number;
  hue?: number;
  /** Photo URL or base64 data URL. When set, shown instead of initials. */
  src?: string | null;
};

export function Avatar({ name, initials, size = 36, hue = 220, src }: Props) {
  const tint = hue;
  const ini =
    initials ||
    (name
      ? name
          .split(' ')
          .map((s) => s[0])
          .filter(Boolean)
          .slice(0, 2)
          .join('')
          .toUpperCase()
      : '??');

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? ''}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          background: `oklch(0.9 0.01 ${tint})`,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `oklch(0.9 0.01 ${tint})`,
        color: `oklch(0.45 0.02 ${tint})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.38,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {ini}
    </div>
  );
}

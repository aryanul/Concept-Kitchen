type Props = {
  name?: string;
  initials?: string;
  size?: number;
  hue?: number;
};

export function Avatar({ name, initials, size = 36, hue = 220 }: Props) {
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
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#e6e6e6',
        color: '#6d6d6d',
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

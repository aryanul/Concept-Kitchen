const TONES = {
  success: { bg: 'oklch(0.95 0.05 145)',  fg: 'oklch(0.42 0.12 145)', dot: 'oklch(0.55 0.16 145)' },
  warning: { bg: 'oklch(0.96 0.06 70)',   fg: 'oklch(0.5 0.13 60)',   dot: 'oklch(0.62 0.16 60)'  },
  info:    { bg: 'oklch(0.95 0.05 250)',  fg: 'oklch(0.45 0.13 250)', dot: 'oklch(0.6 0.16 250)'  },
  danger:  { bg: 'oklch(0.95 0.05 25)',   fg: 'oklch(0.45 0.15 25)',  dot: 'oklch(0.6 0.18 25)'   },
  neutral: { bg: 'oklch(0.94 0.005 250)', fg: 'oklch(0.45 0.01 250)', dot: 'oklch(0.6 0.01 250)'  },
  brand:   { bg: 'oklch(0.95 0.06 340)',  fg: 'oklch(0.45 0.16 340)', dot: 'oklch(0.6 0.2 340)'   },
};

export type Tone = keyof typeof TONES;

const STATUS_TO_TONE: Record<string, Tone> = {
  Active: 'success', Present: 'success', Approved: 'success', Ok: 'success', Settled: 'success',
  Pending: 'warning', Late: 'warning', 'Half-Day': 'warning', Hold: 'warning', Probation: 'warning',
  'In Review': 'info', 'On Leave': 'info', Submitted: 'info', 'Pending Settlement': 'info',
  Absent: 'danger', Rejected: 'danger', Exception: 'danger',
  Closed: 'neutral', Inactive: 'neutral', Exited: 'neutral',
  Outstanding: 'brand',
};

type Props = { status: string; tone?: Tone };

export function StatusPill({ status, tone }: Props) {
  const t = TONES[tone || STATUS_TO_TONE[status] || 'neutral'];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        fontSize: 11.5,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.dot }} />
      {status}
    </span>
  );
}

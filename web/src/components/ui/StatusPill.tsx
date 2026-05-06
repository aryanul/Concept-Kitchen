const TONES = {
  success: { bg: '#f1f1f1', fg: '#4a4a4a', border: '#d9d9d9' },
  warning: { bg: '#f1f1f1', fg: '#4a4a4a', border: '#d9d9d9' },
  info:    { bg: '#f1f1f1', fg: '#4a4a4a', border: '#d9d9d9' },
  danger:  { bg: '#f1f1f1', fg: '#4a4a4a', border: '#d9d9d9' },
  neutral: { bg: '#f1f1f1', fg: '#4a4a4a', border: '#d9d9d9' },
  brand:   { bg: '#f1f1f1', fg: '#4a4a4a', border: '#d9d9d9' },
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
        padding: '3px 10px',
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.border}`,
        fontSize: 11.5,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  );
}

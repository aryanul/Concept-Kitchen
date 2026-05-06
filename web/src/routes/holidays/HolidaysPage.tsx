import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, MapPin } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';

type Holiday = {
  id: string;
  date: string;
  name: string;
  kind: string;
  branch_names: string | null;
};

type ListResp = { data: Holiday[] };

const KIND_TONE: Record<string, { bg: string; fg: string }> = {
  Public:    { bg: 'oklch(0.95 0.05 250)',  fg: 'oklch(0.45 0.13 250)' },
  Optional:  { bg: 'oklch(0.96 0.06 70)',   fg: 'oklch(0.5 0.13 60)'  },
  Regional:  { bg: 'oklch(0.95 0.05 145)',  fg: 'oklch(0.42 0.12 145)' },
};

export function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<string>('');

  useEffect(() => {
    api
      .get<ListResp>('/holidays')
      .then((r) => setHolidays(r.data.data))
      .catch(() => setError('Failed to load holidays.'))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const total = holidays.length;
    const byKind: Record<string, number> = {};
    for (const h of holidays) byKind[h.kind] = (byKind[h.kind] || 0) + 1;
    return { total, byKind };
  }, [holidays]);

  const filtered = kindFilter ? holidays.filter((h) => h.kind === kindFilter) : holidays;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div>
      <PageHeader
        title="Holidays"
        subtitle="Public, regional and optional holidays for the year."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        <StatTile icon={CalendarDays} label="Total Holidays" value={String(stats.total)} tint={250} />
        <StatTile label="Public"   value={String(stats.byKind['Public']   || 0)} tint={250} />
        <StatTile label="Regional" value={String(stats.byKind['Regional'] || 0)} tint={145} />
        <StatTile label="Optional" value={String(stats.byKind['Optional'] || 0)} tint={60}  />
      </div>

      <Card padding={0}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 16,
            borderBottom: '1px solid var(--ck-line)',
          }}
        >
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            style={{
              height: 38,
              padding: '0 12px',
              border: '1px solid var(--ck-line)',
              borderRadius: 8,
              background: 'var(--ck-surface)',
              fontSize: 13,
              color: kindFilter ? 'var(--ck-ink)' : 'var(--ck-muted)',
              minWidth: 180,
            }}
          >
            <option value="">All kinds</option>
            <option value="Public">Public</option>
            <option value="Regional">Regional</option>
            <option value="Optional">Optional</option>
          </select>
          <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ck-muted)' }}>
            {loading ? 'Loading…' : `${filtered.length} of ${stats.total} shown`}
          </div>
        </div>

        {error ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ck-danger-fg)' }}>{error}</div>
        ) : (
          <div>
            {!loading && filtered.length === 0 && (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
                No holidays match this filter.
              </div>
            )}
            {filtered.map((h) => {
              const d = new Date(h.date);
              const isPast = d < today;
              const tone = KIND_TONE[h.kind] || { bg: 'var(--ck-line-soft)', fg: 'var(--ck-muted)' };
              return (
                <div
                  key={h.id}
                  style={{
                    padding: '16px 22px',
                    borderTop: '1px solid var(--ck-line)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 18,
                    opacity: isPast ? 0.55 : 1,
                  }}
                >
                  <div
                    style={{
                      width: 60,
                      height: 64,
                      border: '1px solid var(--ck-line)',
                      borderRadius: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--ck-accent)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {d.toLocaleDateString('en-IN', { month: 'short' })}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ck-ink)', lineHeight: 1 }}>
                      {String(d.getDate()).padStart(2, '0')}
                    </div>
                    <div style={{ fontSize: 9.5, color: 'var(--ck-muted)', marginTop: 2 }}>
                      {d.toLocaleDateString('en-IN', { weekday: 'short' })}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ck-ink)' }}>{h.name}</div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: 'var(--ck-muted)',
                        marginTop: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <MapPin size={13} />
                      {h.branch_names || 'All Branches'}
                    </div>
                  </div>
                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: 999,
                      fontSize: 11.5,
                      fontWeight: 600,
                      background: tone.bg,
                      color: tone.fg,
                    }}
                  >
                    {h.kind}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatTile({
  icon: Cmp,
  label,
  value,
  tint,
}: {
  icon?: typeof CalendarDays;
  label: string;
  value: string;
  tint: number;
}) {
  return (
    <Card padding={20}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `oklch(0.95 0.04 ${tint})`,
            color: `oklch(0.45 0.13 ${tint})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {Cmp ? <Cmp size={18} strokeWidth={1.8} /> : <span style={{ fontSize: 16, fontWeight: 700 }}>·</span>}
        </div>
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: 'var(--ck-faint)',
          fontWeight: 500,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ck-ink)', letterSpacing: '-0.02em' }}>{value}</div>
    </Card>
  );
}

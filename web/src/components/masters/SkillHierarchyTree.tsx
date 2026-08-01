import { useMemo } from 'react';

type SkillHeadRow = { id: string; name: string };
type SkillTypeRow = { id: string; name: string; skill_head_id: string | null };
type SkillRow = { id: string; name: string; skill_type_id?: string | null };

type Props = {
  heads: SkillHeadRow[];
  types: SkillTypeRow[];
  skills: SkillRow[];
};

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    (out[key] ??= []).push(item);
  }
  return out;
}

export function SkillHierarchyTree({ heads, types, skills }: Props) {
  const typesByHead = useMemo(() => groupBy(types, (t) => t.skill_head_id ?? ''), [types]);
  const skillsByType = useMemo(() => groupBy(skills, (s) => s.skill_type_id ?? ''), [skills]);

  if (heads.length === 0) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>No skill heads found.</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      {heads.map((head) => (
        <div key={head.id} style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ck-ink)' }}>{head.name}</div>
          <div style={{ marginLeft: 10, borderLeft: '1px solid var(--ck-line)', paddingLeft: 16, marginTop: 6 }}>
            {(typesByHead[head.id] ?? []).map((type) => (
              <div key={type.id} style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--ck-ink-soft)' }}>{type.name}</div>
                <div style={{ marginLeft: 10, borderLeft: '1px solid var(--ck-line)', paddingLeft: 16, marginTop: 4 }}>
                  {(skillsByType[type.id] ?? []).map((skill) => (
                    <div key={skill.id} style={{ marginTop: 4, fontSize: 12, color: 'var(--ck-muted)' }}>
                      {skill.name}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

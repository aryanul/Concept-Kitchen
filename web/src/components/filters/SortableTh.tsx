import type { CSSProperties, ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { thStyle } from './filterStyles';

type SortDir = 'asc' | 'desc';

type SortableThProps<K extends string> = {
  label: ReactNode;
  sortKey: K;
  sortBy?: string;
  sortDir: SortDir;
  onSort: (key: K) => void;
  sortable?: boolean;
  style?: CSSProperties;
};

export function SortableTh<K extends string>({ label, sortKey, sortBy, sortDir, onSort, sortable = true, style }: SortableThProps<K>) {
  if (!sortable) {
    return <th style={{ ...thStyle, cursor: 'default', ...style }}>{label}</th>;
  }
  const active = sortBy === sortKey;
  return (
    <th
      style={{ ...thStyle, cursor: 'pointer', userSelect: 'none', ...style }}
      onClick={() => onSort(sortKey)}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        {label}
        {active ? (
          sortDir === 'asc'
            ? <ChevronUp size={13} style={{ color: 'var(--ck-accent)', marginLeft: 4 }} />
            : <ChevronDown size={13} style={{ color: 'var(--ck-accent)', marginLeft: 4 }} />
        ) : (
          <ChevronsUpDown size={13} style={{ color: 'var(--ck-faint)', marginLeft: 4 }} />
        )}
      </span>
    </th>
  );
}

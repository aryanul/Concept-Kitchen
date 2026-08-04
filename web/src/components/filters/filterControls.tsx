import { Search, X } from 'lucide-react';
import { inputStyle, selectStyle, labelStyle } from './filterStyles';

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  width?: number;
  showButton?: boolean;
};

export function SearchInput({ value, onChange, onSubmit, placeholder = 'Search…', width = 240, showButton = true }: SearchInputProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, position: 'relative' }}>
      <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--ck-faint)', pointerEvents: 'none' }} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit?.()}
        placeholder={placeholder}
        style={{ ...inputStyle, paddingLeft: 32, width }}
      />
      {showButton && onSubmit && (
        <button
          onClick={onSubmit}
          type="button"
          style={{
            marginLeft: 6, height: 34, padding: '0 12px', borderRadius: 7,
            border: '1px solid var(--ck-line)', background: 'var(--ck-accent)',
            color: '#fff', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 500,
          }}
        >
          Search
        </button>
      )}
    </div>
  );
}

type FilterOption = { label: string; value: string };

type FilterSelectProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  placeholder?: string;
  minWidth?: number;
};

export function FilterSelect({ label, value, onChange, options, placeholder = 'All', minWidth }: FilterSelectProps) {
  const select = (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={minWidth ? { ...selectStyle, minWidth } : selectStyle}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
  if (!label) return select;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={labelStyle}>{label}</label>
      {select}
    </div>
  );
}

type ClearFiltersButtonProps = {
  onClick: () => void;
  visible: boolean;
};

export function ClearFiltersButton({ onClick, visible }: ClearFiltersButtonProps) {
  if (!visible) return null;
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        height: 34, padding: '0 12px', borderRadius: 7,
        border: '1px solid var(--ck-line)', background: 'var(--ck-bg)',
        color: 'var(--ck-muted)', cursor: 'pointer', fontSize: 12.5,
        fontFamily: 'inherit', alignSelf: 'flex-end',
      }}
    >
      <X size={13} /> Clear filters
    </button>
  );
}

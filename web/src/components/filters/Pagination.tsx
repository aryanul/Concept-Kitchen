import { ChevronLeft, ChevronRight } from 'lucide-react';

type PaginationProps = {
  page: number;
  totalPages: number;
  total?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  windowSize?: number;
};

export function Pagination({ page, totalPages, total, pageSize, onPageChange, windowSize = 7 }: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = total != null && pageSize != null ? (page - 1) * pageSize + 1 : undefined;
  const end = total != null && pageSize != null ? Math.min(page * pageSize, total) : undefined;

  const pages: number[] = Array.from({ length: Math.min(windowSize, totalPages) }, (_, i) => {
    if (totalPages <= windowSize) return i + 1;
    const half = Math.floor(windowSize / 2);
    if (page <= half + 1) return i + 1;
    if (page >= totalPages - half) return totalPages - windowSize + 1 + i;
    return page - half + i;
  });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 20px', borderTop: '1px solid var(--ck-line)',
    }}>
      <span style={{ fontSize: 12.5, color: 'var(--ck-muted)' }}>
        {start != null && end != null && total != null
          ? `Showing ${start}–${end} of ${total.toLocaleString('en-IN')}`
          : `Page ${page} of ${totalPages}`}
      </span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          type="button"
          style={{
            height: 32, width: 32, borderRadius: 7, border: '1px solid var(--ck-line)',
            background: 'var(--ck-bg)', color: page === 1 ? 'var(--ck-faint)' : 'var(--ck-ink-soft)',
            cursor: page === 1 ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ChevronLeft size={15} />
        </button>

        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            type="button"
            style={{
              height: 32, minWidth: 32, padding: '0 6px', borderRadius: 7,
              border: p === page ? '1px solid var(--ck-accent)' : '1px solid var(--ck-line)',
              background: p === page ? 'var(--ck-accent)' : 'var(--ck-bg)',
              color: p === page ? '#fff' : 'var(--ck-ink-soft)',
              cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: p === page ? 600 : 400,
            }}
          >
            {p}
          </button>
        ))}

        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          type="button"
          style={{
            height: 32, width: 32, borderRadius: 7, border: '1px solid var(--ck-line)',
            background: 'var(--ck-bg)', color: page === totalPages ? 'var(--ck-faint)' : 'var(--ck-ink-soft)',
            cursor: page === totalPages ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

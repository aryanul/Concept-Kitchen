import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';

export type SortDir = 'asc' | 'desc';

type UseServerListQueryOptions<TFilters extends Record<string, string>> = {
  /** API path, e.g. '/holidays'. */
  endpoint: string;
  /** All-string filter shape; '' means unset. */
  defaultFilters: TFilters;
  defaultSort?: { sortBy: string; sortDir: SortDir };
  /** Default 20. */
  pageSize?: number;
  /** Query param name the search box writes to. Default 'search'. */
  searchParamName?: string;
  /** Extra static params merged into every request (e.g. an employeeId cross-link). */
  extraParams?: Record<string, string | number | undefined>;
  /** Skip fetching entirely (e.g. while a required extra param isn't ready yet). */
  enabled?: boolean;
};

export type UseServerListQueryResult<Row, TFilters extends Record<string, string>> = {
  rows: Row[];
  loading: boolean;
  error: boolean;
  total: number;
  totalPages: number;
  page: number;
  setPage: (p: number) => void;
  /** The applied search term (only updates on applySearch, unlike searchInput which updates per keystroke). */
  search: string;
  searchInput: string;
  setSearchInput: (s: string) => void;
  applySearch: () => void;
  filters: TFilters;
  setFilter: (key: keyof TFilters, value: string) => void;
  sortBy?: string;
  sortDir: SortDir;
  toggleSort: (key: string) => void;
  hasActiveFilters: boolean;
  clearAll: () => void;
  refetch: () => void;
};

export function useServerListQuery<Row, TFilters extends Record<string, string>>(
  opts: UseServerListQueryOptions<TFilters>
): UseServerListQueryResult<Row, TFilters> {
  const {
    endpoint,
    defaultFilters,
    defaultSort,
    pageSize = 20,
    searchParamName = 'search',
    extraParams,
    enabled = true,
  } = opts;

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<TFilters>(defaultFilters);
  const [sortBy, setSortBy] = useState<string | undefined>(defaultSort?.sortBy);
  const [sortDir, setSortDir] = useState<SortDir>(defaultSort?.sortDir ?? 'desc');
  const [page, setPage] = useState(1);

  const extraParamsKey = JSON.stringify(extraParams ?? {});

  const fetchRows = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = { page, pageSize };
      if (search) params[searchParamName] = search;
      for (const [key, value] of Object.entries(filters)) {
        if (value) params[key] = value as string;
      }
      if (sortBy) {
        params.sortBy = sortBy;
        params.sortDir = sortDir;
      }
      if (extraParams) {
        for (const [key, value] of Object.entries(extraParams)) {
          if (value !== undefined && value !== '') params[key] = value;
        }
      }
      const r = await api.get(endpoint, { params });
      const data = r.data?.data;
      setRows(Array.isArray(data) ? data : []);
      setTotal(Number(r.data?.meta?.total ?? (Array.isArray(data) ? data.length : 0)));
    } catch {
      setRows([]);
      setTotal(0);
      setError(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, page, pageSize, search, searchParamName, JSON.stringify(filters), sortBy, sortDir, extraParamsKey, enabled]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const setFilter = useCallback((key: keyof TFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const applySearch = useCallback(() => {
    setSearch(searchInput);
    setPage(1);
  }, [searchInput]);

  const toggleSort = useCallback((key: string) => {
    setSortBy((prevKey) => {
      if (prevKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prevKey;
      }
      setSortDir('desc');
      return key;
    });
    setPage(1);
  }, []);

  const hasActiveFilters = Boolean(search) || Object.values(filters).some((v) => Boolean(v));

  const clearAll = useCallback(() => {
    setSearch('');
    setSearchInput('');
    setFilters(defaultFilters);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    rows, loading, error, total, totalPages,
    page, setPage: (p) => setPage(p),
    search, searchInput, setSearchInput, applySearch,
    filters, setFilter,
    sortBy, sortDir, toggleSort,
    hasActiveFilters, clearAll,
    refetch: fetchRows,
  };
}

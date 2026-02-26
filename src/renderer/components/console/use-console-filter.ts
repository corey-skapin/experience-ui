// src/renderer/components/console/use-console-filter.ts
// T090 — React hook for console entry filtering.

import { useCallback, useMemo, useState } from 'react';

import type { ConsoleEntry } from '../../../shared/types';
import { filterEntries } from './console-filter';

// ─── Return Type ──────────────────────────────────────────────────────────────

export interface UseConsoleFilterReturn {
  statusFilter: string;
  urlFilter: string;
  keywordFilter: string;
  setStatusFilter: (s: string) => void;
  setUrlFilter: (s: string) => void;
  setKeywordFilter: (s: string) => void;
  filteredEntries: ConsoleEntry[];
  clearFilters: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConsoleFilter(entries: ConsoleEntry[]): UseConsoleFilterReturn {
  const [statusFilter, setStatusFilter] = useState('all');
  const [urlFilter, setUrlFilter] = useState('');
  const [keywordFilter, setKeywordFilter] = useState('');

  const filteredEntries = useMemo(
    () => filterEntries(entries, statusFilter, urlFilter, keywordFilter),
    [entries, statusFilter, urlFilter, keywordFilter],
  );

  const clearFilters = useCallback(() => {
    setStatusFilter('all');
    setUrlFilter('');
    setKeywordFilter('');
  }, []);

  return {
    statusFilter,
    urlFilter,
    keywordFilter,
    setStatusFilter,
    setUrlFilter,
    setKeywordFilter,
    filteredEntries,
    clearFilters,
  };
}

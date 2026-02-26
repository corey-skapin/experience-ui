// src/renderer/components/console/console-filter.ts
// T090 — Pure filter functions for console entries.
// All filters use AND logic when combined.

import type { ConsoleEntry } from '../../../shared/types';

// ─── Status-code filter ───────────────────────────────────────────────────────

export function filterByStatusCode(entries: ConsoleEntry[], filter: string): ConsoleEntry[] {
  if (filter === 'all') return entries;
  const prefix = parseInt(filter[0], 10) * 100;
  return entries.filter((e) => {
    const code = e.response?.statusCode;
    return code !== undefined && code >= prefix && code < prefix + 100;
  });
}

// ─── URL-pattern filter ───────────────────────────────────────────────────────

export function filterByUrlPattern(entries: ConsoleEntry[], pattern: string): ConsoleEntry[] {
  if (!pattern) return entries;
  let regex: RegExp | null = null;
  try {
    regex = new RegExp(pattern, 'i');
  } catch {
    // Invalid regex — fall through to substring match
  }
  return entries.filter((e) => {
    const url = e.request.url;
    if (regex) return regex.test(url);
    return url.toLowerCase().includes(pattern.toLowerCase());
  });
}

// ─── Keyword filter ───────────────────────────────────────────────────────────

export function filterByKeyword(entries: ConsoleEntry[], keyword: string): ConsoleEntry[] {
  if (!keyword) return entries;
  const lower = keyword.toLowerCase();
  return entries.filter((e) => {
    const haystack = [
      e.request.method,
      e.request.url,
      e.request.body ?? '',
      e.response?.body ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(lower);
  });
}

// ─── Combined filter ──────────────────────────────────────────────────────────

export function filterEntries(
  entries: ConsoleEntry[],
  statusFilter: string,
  urlFilter: string,
  keywordFilter: string,
): ConsoleEntry[] {
  let result = filterByStatusCode(entries, statusFilter);
  result = filterByUrlPattern(result, urlFilter);
  result = filterByKeyword(result, keywordFilter);
  return result;
}

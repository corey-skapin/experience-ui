// src/renderer/components/console/console-filter.test.ts
// T086 — Unit tests for console entry filter logic.

import { describe, expect, it } from 'vitest';

import type { ConsoleEntry, ConsoleRequest, ConsoleResponse } from '../../../shared/types';
import {
  filterByKeyword,
  filterByStatusCode,
  filterByUrlPattern,
  filterEntries,
} from './console-filter';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEntry(
  method: string,
  url: string,
  statusCode: number,
  body = '',
): ConsoleEntry {
  const req: ConsoleRequest = { method, url, headers: {} };
  const res: ConsoleResponse = { statusCode, statusText: 'OK', headers: {}, body, bodySize: body.length };
  return {
    id: crypto.randomUUID(),
    tabId: 'tab-1',
    timestamp: new Date().toISOString(),
    request: req,
    response: res,
    elapsedMs: 10,
    status: 'completed',
  };
}

// ─── filterByStatusCode ───────────────────────────────────────────────────────

describe('filterByStatusCode', () => {
  const entries = [
    makeEntry('GET', '/a', 200),
    makeEntry('GET', '/b', 201),
    makeEntry('GET', '/c', 301),
    makeEntry('GET', '/d', 404),
    makeEntry('GET', '/e', 500),
  ];

  it('returns all entries when filter is "all"', () => {
    expect(filterByStatusCode(entries, 'all')).toHaveLength(5);
  });

  it('matches 2xx codes', () => {
    const result = filterByStatusCode(entries, '2xx');
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.response?.statusCode)).toEqual([200, 201]);
  });

  it('matches 3xx codes', () => {
    const result = filterByStatusCode(entries, '3xx');
    expect(result).toHaveLength(1);
    expect(result[0].response?.statusCode).toBe(301);
  });

  it('matches 4xx codes', () => {
    const result = filterByStatusCode(entries, '4xx');
    expect(result).toHaveLength(1);
    expect(result[0].response?.statusCode).toBe(404);
  });

  it('matches 5xx codes', () => {
    const result = filterByStatusCode(entries, '5xx');
    expect(result).toHaveLength(1);
    expect(result[0].response?.statusCode).toBe(500);
  });

  it('excludes entries with no response when filtering by code range', () => {
    const pending: ConsoleEntry = {
      id: 'p1',
      tabId: 'tab-1',
      timestamp: new Date().toISOString(),
      request: { method: 'GET', url: '/pending', headers: {} },
      response: null,
      elapsedMs: null,
      status: 'pending',
    };
    expect(filterByStatusCode([pending], '2xx')).toHaveLength(0);
  });
});

// ─── filterByUrlPattern ───────────────────────────────────────────────────────

describe('filterByUrlPattern', () => {
  const entries = [
    makeEntry('GET', 'https://api.example.com/users', 200),
    makeEntry('POST', 'https://api.example.com/posts', 201),
    makeEntry('DELETE', 'https://other.com/admin', 204),
  ];

  it('returns all entries when pattern is empty', () => {
    expect(filterByUrlPattern(entries, '')).toHaveLength(3);
  });

  it('matches substring (case insensitive)', () => {
    expect(filterByUrlPattern(entries, 'USERS')).toHaveLength(1);
    expect(filterByUrlPattern(entries, 'example.com')).toHaveLength(2);
  });

  it('falls back to regex matching', () => {
    expect(filterByUrlPattern(entries, '/us.rs')).toHaveLength(1);
  });

  it('treats invalid regex as substring', () => {
    // '[invalid' is not valid regex, should fall back to substring
    expect(() => filterByUrlPattern(entries, '[invalid')).not.toThrow();
  });
});

// ─── filterByKeyword ──────────────────────────────────────────────────────────

describe('filterByKeyword', () => {
  const entries = [
    makeEntry('GET', '/users', 200, '{"users":[]}'),
    makeEntry('POST', '/login', 200, '{"token":"abc"}'),
    makeEntry('DELETE', '/users/1', 204, ''),
  ];

  it('returns all entries when keyword is empty', () => {
    expect(filterByKeyword(entries, '')).toHaveLength(3);
  });

  it('matches on HTTP method', () => {
    expect(filterByKeyword(entries, 'DELETE')).toHaveLength(1);
  });

  it('matches on URL', () => {
    expect(filterByKeyword(entries, '/users')).toHaveLength(2);
  });

  it('matches on response body', () => {
    expect(filterByKeyword(entries, 'token')).toHaveLength(1);
  });

  it('is case insensitive', () => {
    expect(filterByKeyword(entries, 'get')).toHaveLength(1);
  });
});

// ─── filterEntries (combined AND logic) ──────────────────────────────────────

describe('filterEntries — combined filters', () => {
  const entries = [
    makeEntry('GET', '/users', 200, '{"users":[]}'),
    makeEntry('POST', '/users', 201, '{"id":1}'),
    makeEntry('GET', '/posts', 404, ''),
    makeEntry('DELETE', '/users/1', 500, ''),
  ];

  it('all entries pass when all filters are empty', () => {
    expect(filterEntries(entries, 'all', '', '')).toHaveLength(4);
  });

  it('combines statusCode AND url filters', () => {
    const result = filterEntries(entries, '2xx', '/users', '');
    expect(result).toHaveLength(2);
  });

  it('combines all three filters', () => {
    const result = filterEntries(entries, '2xx', '/users', 'POST');
    expect(result).toHaveLength(1);
    expect(result[0].request.method).toBe('POST');
  });
});

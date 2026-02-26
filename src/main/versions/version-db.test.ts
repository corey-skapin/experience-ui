// @vitest-environment node
// src/main/versions/version-db.test.ts
// T065 — Unit tests for VersionDB SQLite operations.
// Uses an in-memory database and real temp files for code storage.

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VersionDB } from './version-db';

// ─── Setup ───────────────────────────────────────────────────────────────────

let db: VersionDB;
let testDir: string;

beforeEach(() => {
  vi.useRealTimers();
  testDir = join(tmpdir(), `vdb-test-${process.hrtime.bigint().toString()}`);
  mkdirSync(testDir, { recursive: true });
  db = new VersionDB(':memory:');
});

afterEach(() => {
  db.close();
  if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function writeCodeFile(name: string, content: string): string {
  const filePath = join(testDir, name);
  writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function makeVersionData(
  overrides: Partial<{
    id: string;
    interface_id: string;
    parent_version_id: string | null;
    is_revert: 0 | 1;
    reverted_from_id: string | null;
    created_at: string;
    description: string;
    change_type: string;
    code_path: string;
    code_hash: string;
    generation_prompt: string | null;
  }> = {},
) {
  const codePath =
    overrides.code_path ??
    writeCodeFile(`code-${Date.now()}-${Math.random()}.tsx`, 'const App = () => null;');
  return {
    id: overrides.id ?? `v-${Math.random()}`,
    interface_id: overrides.interface_id ?? 'iface-1',
    parent_version_id: overrides.parent_version_id ?? null,
    is_revert: overrides.is_revert ?? 0,
    reverted_from_id: overrides.reverted_from_id ?? null,
    created_at: overrides.created_at ?? new Date().toISOString(),
    description: overrides.description ?? 'Initial generation',
    change_type: overrides.change_type ?? 'generation',
    code_path: codePath,
    code_hash: overrides.code_hash ?? 'abc123',
    generation_prompt: overrides.generation_prompt ?? null,
  } as const;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('VersionDB — createVersion', () => {
  it('inserts a row and returns the id', () => {
    const data = makeVersionData({ id: 'v-001' });
    const returnedId = db.createVersion(data);
    expect(returnedId).toBe('v-001');
  });

  it('auto-increments version_number per interface_id starting at 1', () => {
    db.createVersion(makeVersionData({ id: 'v-001', interface_id: 'iface-1' }));
    db.createVersion(makeVersionData({ id: 'v-002', interface_id: 'iface-1' }));
    db.createVersion(makeVersionData({ id: 'v-003', interface_id: 'iface-1' }));

    const v1 = db.getVersion('v-001')!;
    const v2 = db.getVersion('v-002')!;
    const v3 = db.getVersion('v-003')!;

    expect(v1.version_number).toBe(1);
    expect(v2.version_number).toBe(2);
    expect(v3.version_number).toBe(3);
  });

  it('version_number is independent across different interface_ids', () => {
    db.createVersion(makeVersionData({ id: 'a-001', interface_id: 'iface-a' }));
    db.createVersion(makeVersionData({ id: 'a-002', interface_id: 'iface-a' }));
    db.createVersion(makeVersionData({ id: 'b-001', interface_id: 'iface-b' }));

    expect(db.getVersion('b-001')!.version_number).toBe(1);
  });
});

describe('VersionDB — listVersions', () => {
  it('returns versions for an interface, newest first', () => {
    db.createVersion(
      makeVersionData({
        id: 'v-001',
        interface_id: 'iface-1',
        created_at: '2024-01-01T00:00:00.000Z',
      }),
    );
    db.createVersion(
      makeVersionData({
        id: 'v-002',
        interface_id: 'iface-1',
        created_at: '2024-01-02T00:00:00.000Z',
      }),
    );
    db.createVersion(
      makeVersionData({
        id: 'v-003',
        interface_id: 'iface-1',
        created_at: '2024-01-03T00:00:00.000Z',
      }),
    );

    const rows = db.listVersions('iface-1', 1, 10);
    expect(rows).toHaveLength(3);
    expect(rows[0].id).toBe('v-003');
    expect(rows[1].id).toBe('v-002');
    expect(rows[2].id).toBe('v-001');
  });

  it('returns empty array for unknown interface', () => {
    expect(db.listVersions('nonexistent', 1, 10)).toEqual([]);
  });

  it('paginates correctly', () => {
    for (let i = 0; i < 5; i++) {
      db.createVersion(makeVersionData({ id: `v-00${i}`, interface_id: 'iface-1' }));
    }
    const page1 = db.listVersions('iface-1', 1, 2);
    const page2 = db.listVersions('iface-1', 2, 2);
    const page3 = db.listVersions('iface-1', 3, 2);

    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(2);
    expect(page3).toHaveLength(1);
  });
});

describe('VersionDB — loadCode', () => {
  it('returns the code string from the filesystem path', () => {
    const code = 'export default function App() { return <div>Hello</div>; }';
    const codePath = writeCodeFile('comp.tsx', code);

    const id = db.createVersion(makeVersionData({ id: 'v-001', code_path: codePath }));
    expect(db.loadCode(id)).toBe(code);
  });

  it('returns null for a nonexistent version id', () => {
    expect(db.loadCode('nonexistent')).toBeNull();
  });

  it('returns null if the file no longer exists on disk', () => {
    const codePath = join(testDir, 'missing.tsx');
    db.createVersion(makeVersionData({ id: 'v-001', code_path: codePath }));
    expect(db.loadCode('v-001')).toBeNull();
  });
});

describe('VersionDB — rollback (append-only new entry)', () => {
  it('creates a new entry with is_revert=1 and reverted_from_id set', () => {
    const origCode = 'const A = () => null;';
    const origPath = writeCodeFile('orig.tsx', origCode);
    const revertCode = 'const B = () => null;';
    const revertPath = writeCodeFile('revert.tsx', revertCode);

    db.createVersion(
      makeVersionData({ id: 'v-original', interface_id: 'iface-1', code_path: origPath }),
    );
    db.createVersion(
      makeVersionData({
        id: 'v-revert',
        interface_id: 'iface-1',
        is_revert: 1,
        reverted_from_id: 'v-original',
        code_path: revertPath,
      }),
    );

    const revert = db.getVersion('v-revert')!;
    expect(revert.is_revert).toBe(1);
    expect(revert.reverted_from_id).toBe('v-original');
    expect(revert.version_number).toBe(2);
  });

  it('does not modify existing versions (append-only)', () => {
    const codePath = writeCodeFile('orig.tsx', 'original code');
    db.createVersion(
      makeVersionData({ id: 'v-001', interface_id: 'iface-1', code_path: codePath }),
    );

    const revertPath = writeCodeFile('revert.tsx', 'revert code');
    db.createVersion(
      makeVersionData({
        id: 'v-002',
        interface_id: 'iface-1',
        is_revert: 1,
        reverted_from_id: 'v-001',
        code_path: revertPath,
      }),
    );

    // Original row must be unchanged
    const original = db.getVersion('v-001')!;
    expect(original.is_revert).toBe(0);
    expect(original.reverted_from_id).toBeNull();
  });
});

describe('VersionDB — getVersion', () => {
  it('returns the version row by id', () => {
    const data = makeVersionData({ id: 'v-42', interface_id: 'iface-x', description: 'test desc' });
    db.createVersion(data);
    const row = db.getVersion('v-42')!;
    expect(row.id).toBe('v-42');
    expect(row.description).toBe('test desc');
  });

  it('returns undefined for an unknown id', () => {
    expect(db.getVersion('missing')).toBeUndefined();
  });
});

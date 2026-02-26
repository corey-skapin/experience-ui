// src/renderer/services/version-manager/version-manager.test.ts
// T066 — Unit tests for the version manager service.
// Mocks window.experienceUI.versions IPC calls.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getDiff, listVersions, loadVersionCode, rollback, saveSnapshot } from './version-manager';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockVersions = {
  saveSnapshot: vi.fn(),
  list: vi.fn(),
  loadCode: vi.fn(),
  getDiff: vi.fn(),
};

beforeEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, 'experienceUI', {
    value: { versions: mockVersions },
    configurable: true,
    writable: true,
  });
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('saveSnapshot', () => {
  it('calls versions.saveSnapshot IPC with correct args and returns versionId', async () => {
    mockVersions.saveSnapshot.mockResolvedValue({
      success: true,
      versionId: 'v-abc',
      versionNumber: 1,
      codePath: '/data/v1/generated.tsx',
      codeHash: 'deadbeef',
    });

    const versionId = await saveSnapshot(
      'iface-1',
      'tab-1',
      'const App = () => null;',
      'Initial generation',
      'generation',
    );

    expect(versionId).toBe('v-abc');
    expect(mockVersions.saveSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        interfaceId: 'iface-1',
        generatedCode: 'const App = () => null;',
        description: 'Initial generation',
        changeType: 'generation',
      }),
    );
  });

  it('throws when IPC returns success: false', async () => {
    mockVersions.saveSnapshot.mockResolvedValue({
      success: false,
      versionId: '',
      versionNumber: 0,
      codePath: '',
      codeHash: '',
    });

    await expect(saveSnapshot('iface-1', 'tab-1', 'code', 'desc', 'generation')).rejects.toThrow();
  });
});

describe('listVersions', () => {
  it('returns the versions array from IPC', async () => {
    mockVersions.list.mockResolvedValue({
      versions: [
        {
          id: 'v-1',
          versionNumber: 1,
          parentVersionId: null,
          changeType: 'generation',
          description: 'v1',
          isRevert: false,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'v-2',
          versionNumber: 2,
          parentVersionId: 'v-1',
          changeType: 'customization',
          description: 'v2',
          isRevert: false,
          createdAt: '2024-01-02T00:00:00.000Z',
        },
      ],
      totalCount: 2,
      page: 1,
      pageSize: 50,
    });

    const versions = await listVersions('iface-1');

    expect(versions).toHaveLength(2);
    expect(versions[0].id).toBe('v-1');
    expect(versions[1].id).toBe('v-2');
    expect(mockVersions.list).toHaveBeenCalledWith(
      expect.objectContaining({ interfaceId: 'iface-1' }),
    );
  });

  it('returns empty array when IPC returns no versions', async () => {
    mockVersions.list.mockResolvedValue({ versions: [], totalCount: 0, page: 1, pageSize: 50 });
    const versions = await listVersions('iface-1');
    expect(versions).toEqual([]);
  });
});

describe('loadVersionCode', () => {
  it('returns code string from IPC', async () => {
    mockVersions.loadCode.mockResolvedValue({
      code: 'const MyApp = () => <div />;',
      codeHash: 'hash123',
      versionNumber: 2,
    });

    const code = await loadVersionCode('iface-1', 'v-2');
    expect(code).toBe('const MyApp = () => <div />;');
    expect(mockVersions.loadCode).toHaveBeenCalledWith(
      expect.objectContaining({ versionId: 'v-2', interfaceId: 'iface-1' }),
    );
  });
});

describe('rollback', () => {
  it('loads target version code, saves new snapshot with rollback changeType, returns new versionId', async () => {
    mockVersions.loadCode.mockResolvedValue({
      code: 'const OldApp = () => null;',
      codeHash: 'oldhash',
      versionNumber: 1,
    });
    mockVersions.saveSnapshot.mockResolvedValue({
      success: true,
      versionId: 'v-rollback',
      versionNumber: 3,
      codePath: '/data/v3/generated.tsx',
      codeHash: 'rollbackhash',
    });

    const result = await rollback('iface-1', 'tab-1', 'v-1');

    expect(result.newVersionId).toBe('v-rollback');
    expect(result.code).toBe('const OldApp = () => null;');
    expect(mockVersions.saveSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        changeType: 'rollback',
        revertedFromVersionId: 'v-1',
      }),
    );
  });
});

describe('getDiff', () => {
  it('returns a JSON string of diffLines from IPC', async () => {
    mockVersions.getDiff.mockResolvedValue({
      additions: 1,
      deletions: 1,
      diffLines: [
        { type: 'delete', content: '-old line', lineNumber: 1 },
        { type: 'add', content: '+new line', lineNumber: 1 },
      ],
    });

    const diff = await getDiff('iface-1', 'v-1', 'v-2');
    const parsed = JSON.parse(diff) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
  });
});

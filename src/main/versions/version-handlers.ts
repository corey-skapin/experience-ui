// src/main/versions/version-handlers.ts
// T068 — IPC handlers for the versions domain.
// Extracted to keep src/main/index.ts under 300 lines.

import { createHash } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import { ipcMain } from 'electron';
import DiffMatchPatch from 'diff-match-patch';

import {
  IPC_VERSIONS_GET_DIFF,
  IPC_VERSIONS_LIST,
  IPC_VERSIONS_LOAD_CODE,
  IPC_VERSIONS_SAVE_SNAPSHOT,
} from '../../shared/ipc-channels';
import type {
  VersionDiffRequest,
  VersionDiffResponse,
  VersionListRequest,
  VersionSaveRequest,
} from '../preload-types';
import type { VersionDB } from './version-db';

// ─── Diff cache (LRU-approximated, max 20 entries) ───────────────────────────

const diffCache = new Map<string, VersionDiffResponse>();

function evictDiffCache(): void {
  if (diffCache.size > 20) {
    const oldest = diffCache.keys().next().value;
    if (oldest !== undefined) diffCache.delete(oldest);
  }
}

// ─── Handler Registration ─────────────────────────────────────────────────────

export function registerVersionHandlers(db: VersionDB, userDataPath: string): void {
  // ── versions:save-snapshot ──────────────────────────────────────────────

  ipcMain.handle(IPC_VERSIONS_SAVE_SNAPSHOT, (_event, req: VersionSaveRequest) => {
    try {
      const nextRow = db.listVersions(req.interfaceId, 1, 1);
      const existingMax = nextRow.length > 0 ? nextRow[0].version_number : 0;
      const versionNum = existingMax + 1;

      const codePath = join(
        userDataPath,
        'interfaces',
        req.interfaceId,
        'versions',
        `v${versionNum}`,
        'generated.tsx',
      );

      mkdirSync(dirname(codePath), { recursive: true });
      writeFileSync(codePath, req.generatedCode, 'utf8');

      const codeHash = createHash('sha256').update(req.generatedCode).digest('hex');
      const versionId = `${req.interfaceId}-v${versionNum}-${Date.now()}`;

      db.createVersion({
        id: versionId,
        interface_id: req.interfaceId,
        parent_version_id: req.parentVersionId ?? null,
        is_revert: req.revertedFromVersionId ? 1 : 0,
        reverted_from_id: req.revertedFromVersionId ?? null,
        created_at: new Date().toISOString(),
        description: req.description,
        change_type: req.changeType,
        code_path: codePath,
        code_hash: codeHash,
        generation_prompt: req.generationPrompt ?? null,
      });

      return { success: true, versionId, versionNumber: versionNum, codePath, codeHash };
    } catch (err) {
      return {
        success: false,
        versionId: '',
        versionNumber: 0,
        codePath: '',
        codeHash: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  // ── versions:list ────────────────────────────────────────────────────────

  ipcMain.handle(IPC_VERSIONS_LIST, (_event, req: VersionListRequest) => {
    const page = req.page ?? 1;
    const pageSize = req.pageSize ?? 50;
    const rows = db.listVersions(req.interfaceId, page, pageSize);
    return {
      versions: rows.map((r) => ({
        id: r.id,
        versionNumber: r.version_number,
        parentVersionId: r.parent_version_id,
        changeType: r.change_type,
        description: r.description,
        isRevert: r.is_revert === 1,
        createdAt: r.created_at,
      })),
      totalCount: rows.length,
      page,
      pageSize,
    };
  });

  // ── versions:load-code ───────────────────────────────────────────────────

  ipcMain.handle(
    IPC_VERSIONS_LOAD_CODE,
    (_event, req: { interfaceId: string; versionId: string }) => {
      const code = db.loadCode(req.versionId);
      if (code === null) {
        return { code: '', codeHash: '', versionNumber: 0, error: 'Version not found' };
      }
      const row = db.getVersion(req.versionId)!;
      return { code, codeHash: row.code_hash, versionNumber: row.version_number };
    },
  );

  // ── versions:get-diff ────────────────────────────────────────────────────

  ipcMain.handle(IPC_VERSIONS_GET_DIFF, (_event, req: VersionDiffRequest) => {
    const cacheKey = `${req.fromVersionId}:${req.toVersionId}`;
    if (diffCache.has(cacheKey)) return diffCache.get(cacheKey)!;

    const fromCode = db.loadCode(req.fromVersionId) ?? '';
    const toCode = db.loadCode(req.toVersionId) ?? '';

    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(fromCode, toCode);
    dmp.diff_cleanupSemantic(diffs);

    const diffLines: VersionDiffResponse['diffLines'] = [];
    let lineNum = 1;
    let additions = 0;
    let deletions = 0;

    for (const [op, text] of diffs) {
      const lines = text.split('\n');
      for (const line of lines) {
        if (op === 1) {
          diffLines.push({ type: 'add', content: line, lineNumber: lineNum++ });
          additions++;
        } else if (op === -1) {
          diffLines.push({ type: 'delete', content: line, lineNumber: lineNum });
          deletions++;
        } else {
          diffLines.push({ type: 'unchanged', content: line, lineNumber: lineNum++ });
        }
      }
    }

    const result: VersionDiffResponse = { additions, deletions, diffLines };
    evictDiffCache();
    diffCache.set(cacheKey, result);

    return result;
  });
}

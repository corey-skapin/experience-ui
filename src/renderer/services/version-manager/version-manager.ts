// src/renderer/services/version-manager/version-manager.ts
// T070 — Renderer-side version management service.
// Orchestrates version CRUD through IPC (window.experienceUI.versions).

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single version entry as returned by the IPC list call. */
export interface VersionEntry {
  id: string;
  versionNumber: number;
  parentVersionId: string | null;
  changeType: string;
  description: string;
  isRevert: boolean;
  createdAt: string;
}

export interface RollbackResult {
  newVersionId: string;
  code: string;
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Save a new code snapshot for an interface.
 * Returns the new version id.
 */
export async function saveSnapshot(
  interfaceId: string,
  _tabId: string,
  code: string,
  description: string,
  changeType: string,
  opts: {
    parentVersionId?: string;
    revertedFromVersionId?: string;
    generationPrompt?: string;
  } = {},
): Promise<string> {
  const result = await window.experienceUI.versions.saveSnapshot({
    interfaceId,
    generatedCode: code,
    description,
    changeType: changeType as 'generation' | 'customization' | 'rollback',
    parentVersionId: opts.parentVersionId,
    revertedFromVersionId: opts.revertedFromVersionId,
    generationPrompt: opts.generationPrompt,
  });

  if (!result.success) {
    throw new Error(`Failed to save version snapshot for interface ${interfaceId}`);
  }

  return result.versionId;
}

/**
 * List all versions for an interface, newest first.
 */
export async function listVersions(interfaceId: string): Promise<VersionEntry[]> {
  const result = await window.experienceUI.versions.list({
    interfaceId,
    page: 1,
    pageSize: 50,
  });
  return result.versions.map((v) => ({
    id: v.id,
    versionNumber: v.versionNumber,
    parentVersionId: v.parentVersionId,
    changeType: v.changeType,
    description: v.description,
    isRevert: v.isRevert,
    createdAt: v.createdAt,
  }));
}

/**
 * Load the raw TypeScript code for a specific version.
 */
export async function loadVersionCode(interfaceId: string, versionId: string): Promise<string> {
  const result = await window.experienceUI.versions.loadCode({ interfaceId, versionId });
  return result.code;
}

/**
 * Rollback to a previous version.
 * Creates a new version entry (is_revert=true) pointing to the target code.
 * Returns the new version id and the raw code.
 */
export async function rollback(
  interfaceId: string,
  tabId: string,
  targetVersionId: string,
): Promise<RollbackResult> {
  const loadResult = await window.experienceUI.versions.loadCode({
    interfaceId,
    versionId: targetVersionId,
  });

  const newVersionId = await saveSnapshot(
    interfaceId,
    tabId,
    loadResult.code,
    `Rollback to v${loadResult.versionNumber}`,
    'rollback',
    { revertedFromVersionId: targetVersionId },
  );

  return { newVersionId, code: loadResult.code };
}

/**
 * Compute a diff between two versions.
 * Returns a JSON-serialised array of diff lines for VersionDiffViewer.
 */
export async function getDiff(
  interfaceId: string,
  fromVersionId: string,
  toVersionId: string,
): Promise<string> {
  const result = await window.experienceUI.versions.getDiff({
    interfaceId,
    fromVersionId,
    toVersionId,
  });
  return JSON.stringify(result.diffLines);
}

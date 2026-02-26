// src/renderer/hooks/use-versions.ts
// T071 — React hook for version history operations.
// Wraps version-manager service calls and syncs with the Zustand version store.

import { useCallback } from 'react';

import {
  getDiff as vmGetDiff,
  listVersions as vmListVersions,
  loadVersionCode as vmLoadVersionCode,
  rollback as vmRollback,
  saveSnapshot as vmSaveSnapshot,
  type VersionEntry,
} from '../services/version-manager/version-manager';
import { useVersionStore } from '../stores/version-store';

// ─── Hook Return Type ─────────────────────────────────────────────────────────

export interface UseVersionsReturn {
  versions: VersionEntry[];
  currentVersionId: string | null;
  isLoading: boolean;
  error: string | null;
  saveSnapshot(code: string, description: string, changeType: string): Promise<string>;
  loadVersion(versionId: string): Promise<string>;
  rollback(versionId: string): Promise<{ newVersionId: string; code: string }>;
  getDiff(v1: string, v2: string): Promise<string>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVersions(tabId: string, interfaceId: string | null): UseVersionsReturn {
  const {
    versions: allVersions,
    currentVersionId: allCurrentVersionIds,
    isLoading,
    error,
    setVersions,
    setCurrentVersion,
    setLoading,
    setError,
  } = useVersionStore();

  const tabVersions = interfaceId ? (allVersions[interfaceId] ?? []) : [];
  const currentVersionId = allCurrentVersionIds[tabId] ?? null;

  // ── Refresh helper ────────────────────────────────────────────────────────

  const refreshVersions = useCallback(
    async (ifaceId: string) => {
      const updated = await vmListVersions(ifaceId);
      setVersions(ifaceId, updated);
    },
    [setVersions],
  );

  // ── saveSnapshot ──────────────────────────────────────────────────────────

  const saveSnapshot = useCallback(
    async (code: string, description: string, changeType: string): Promise<string> => {
      if (!interfaceId) throw new Error('No interface loaded');
      setLoading(true);
      setError(null);
      try {
        const versionId = await vmSaveSnapshot(interfaceId, tabId, code, description, changeType);
        await refreshVersions(interfaceId);
        setCurrentVersion(tabId, versionId);
        return versionId;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [interfaceId, tabId, setLoading, setError, setCurrentVersion, refreshVersions],
  );

  // ── loadVersion ───────────────────────────────────────────────────────────

  const loadVersion = useCallback(
    async (versionId: string): Promise<string> => {
      if (!interfaceId) throw new Error('No interface loaded');
      setLoading(true);
      setError(null);
      try {
        const code = await vmLoadVersionCode(interfaceId, versionId);
        setCurrentVersion(tabId, versionId);
        return code;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [interfaceId, tabId, setLoading, setError, setCurrentVersion],
  );

  // ── rollback ──────────────────────────────────────────────────────────────

  const rollback = useCallback(
    async (versionId: string): Promise<{ newVersionId: string; code: string }> => {
      if (!interfaceId) throw new Error('No interface loaded');
      setLoading(true);
      setError(null);
      try {
        const result = await vmRollback(interfaceId, tabId, versionId);
        await refreshVersions(interfaceId);
        setCurrentVersion(tabId, result.newVersionId);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [interfaceId, tabId, setLoading, setError, setCurrentVersion, refreshVersions],
  );

  // ── getDiff ───────────────────────────────────────────────────────────────

  const getDiff = useCallback(
    async (v1: string, v2: string): Promise<string> => {
      if (!interfaceId) throw new Error('No interface loaded');
      return vmGetDiff(interfaceId, v1, v2);
    },
    [interfaceId],
  );

  return {
    versions: tabVersions,
    currentVersionId,
    isLoading,
    error,
    saveSnapshot,
    loadVersion,
    rollback,
    getDiff,
  };
}

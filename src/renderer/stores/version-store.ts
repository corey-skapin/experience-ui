// src/renderer/stores/version-store.ts
// T069 — Zustand store for version history state.
// Tracks versions per interfaceId and the current versionId per tab.

import { create } from 'zustand';

import type { VersionEntry } from '../services/version-manager/version-manager';

// ─── State Shape ──────────────────────────────────────────────────────────────

interface VersionState {
  /** interfaceId → ordered list of version entries (newest first). */
  versions: Record<string, VersionEntry[]>;
  /** tabId → the currently loaded versionId (null if none). */
  currentVersionId: Record<string, string | null>;
  isLoading: boolean;
  error: string | null;

  setVersions(interfaceId: string, versions: VersionEntry[]): void;
  setCurrentVersion(tabId: string, versionId: string | null): void;
  setLoading(loading: boolean): void;
  setError(error: string | null): void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useVersionStore = create<VersionState>()((set) => ({
  versions: {},
  currentVersionId: {},
  isLoading: false,
  error: null,

  setVersions(interfaceId: string, versions: VersionEntry[]) {
    set((s) => ({ versions: { ...s.versions, [interfaceId]: versions } }));
  },

  setCurrentVersion(tabId: string, versionId: string | null) {
    set((s) => ({ currentVersionId: { ...s.currentVersionId, [tabId]: versionId } }));
  },

  setLoading(loading: boolean) {
    set({ isLoading: loading });
  },

  setError(error: string | null) {
    set({ error });
  },
}));

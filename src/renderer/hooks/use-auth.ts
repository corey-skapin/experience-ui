// src/renderer/hooks/use-auth.ts
// T051 — useAuth hook: wraps the auth IPC bridge with loading/error state.
// Delegates to useAuthStore for status tracking.

import { useCallback, useState } from 'react';

import type { ConnectionStatus } from '../../shared/types';
import { useAuthStore } from '../stores/auth-store';

// ─── Derived types (from global bridge, no main-process imports) ──────────────

type AuthConfigureMethod = Parameters<Window['experienceUI']['auth']['configure']>[0]['method'];
type AuthTestResponse = Awaited<ReturnType<Window['experienceUI']['auth']['testConnection']>>;
type OAuthFlowParams = Parameters<Window['experienceUI']['auth']['startOAuthFlow']>[0];

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseAuthReturn {
  /** All known connection statuses keyed by baseUrl. */
  connections: Record<string, ConnectionStatus>;
  isLoading: boolean;
  error: string | null;

  /** Configure auth credentials for a baseUrl and set status to 'connecting'. */
  configure(baseUrl: string, method: AuthConfigureMethod, persist: boolean): Promise<void>;

  /** Test connectivity for a baseUrl; updates status in the store. */
  testConnection(baseUrl: string, healthCheckPath?: string): Promise<AuthTestResponse>;

  /** Get current status for a baseUrl (defaults to 'disconnected'). */
  getStatus(baseUrl: string): ConnectionStatus;

  /** Start OAuth 2.0 PKCE flow. */
  startOAuthFlow(params: OAuthFlowParams): Promise<void>;

  /** Clear credentials for a baseUrl. */
  clearCredentials(baseUrl: string, clearPersisted?: boolean): Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): UseAuthReturn {
  const { connections, setStatus, getStatus, removeConnection } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configure = useCallback(
    async (baseUrl: string, method: AuthConfigureMethod, persist: boolean): Promise<void> => {
      setIsLoading(true);
      setError(null);
      setStatus(baseUrl, 'connecting');
      try {
        const res = await window.experienceUI.auth.configure({ baseUrl, method, persist });
        if (!res.success) {
          setStatus(baseUrl, 'disconnected');
          setError(res.error ?? 'Configuration failed');
        }
        // Status will be updated by testConnection or health check push
      } catch (err) {
        setStatus(baseUrl, 'disconnected');
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    },
    [setStatus],
  );

  const testConnection = useCallback(
    async (baseUrl: string, healthCheckPath?: string): Promise<AuthTestResponse> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await window.experienceUI.auth.testConnection({ baseUrl, healthCheckPath });
        // Map test response status to ConnectionStatus
        const statusMap: Record<string, ConnectionStatus> = {
          connected: 'connected',
          degraded: 'degraded',
          unreachable: 'unreachable',
          unauthorized: 'expired',
        };
        setStatus(baseUrl, statusMap[res.status] ?? 'disconnected');
        return res;
      } catch (err) {
        setStatus(baseUrl, 'unreachable');
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        return { status: 'unreachable', responseTimeMs: 0, error: msg };
      } finally {
        setIsLoading(false);
      }
    },
    [setStatus],
  );

  const startOAuthFlow = useCallback(
    async (params: OAuthFlowParams): Promise<void> => {
      setIsLoading(true);
      setError(null);
      setStatus(params.baseUrl, 'connecting');
      try {
        const res = await window.experienceUI.auth.startOAuthFlow(params);
        if (!res.success) {
          setStatus(params.baseUrl, 'disconnected');
          setError(res.error ?? 'OAuth flow failed');
        }
      } catch (err) {
        setStatus(params.baseUrl, 'disconnected');
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    },
    [setStatus],
  );

  const clearCredentials = useCallback(
    async (baseUrl: string, clearPersisted = false): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        await window.experienceUI.auth.clearCredentials({ baseUrl, clearPersisted });
        removeConnection(baseUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    },
    [removeConnection],
  );

  return {
    connections,
    isLoading,
    error,
    configure,
    testConnection,
    getStatus,
    startOAuthFlow,
    clearCredentials,
  };
}

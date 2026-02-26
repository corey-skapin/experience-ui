import { useState, useEffect, useCallback } from 'react';
import type { CLIState } from '../../shared/types';

interface UseCliReturn {
  sendMessage: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
  getStatus: () => Promise<CLIState>;
  restart: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useCli(): UseCliReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = window.experienceUI?.cli?.onStreamResponse?.((event: unknown) => {
      // Stream chunks are handled externally; expose via event emission if needed
      void event;
    });
    return () => unsubscribe?.();
  }, []);

  const sendMessage = useCallback(
    async (method: string, params?: Record<string, unknown>): Promise<unknown> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await window.experienceUI.cli.sendMessage({ method, params });
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const getStatus = useCallback(async (): Promise<CLIState> => {
    const result = await window.experienceUI.cli.getStatus();
    return result as CLIState;
  }, []);

  const restart = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await window.experienceUI.cli.restart();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { sendMessage, getStatus, restart, isLoading, error };
}

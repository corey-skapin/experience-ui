// src/renderer/hooks/use-cli.ts
// T027 — React hook for interacting with the Copilot CLI over IPC.
// Provides sendMessage, getStatus, and restart operations with loading/error states.
// Handles streaming response chunks via the cli:stream-response push notification.

import { useCallback, useEffect, useRef, useState } from 'react';

import type { CLIState } from '../../shared/types';

// ─── Local Types ──────────────────────────────────────────────────────────────

interface SendMessageContext {
  tabId: string;
  activeSpecId?: string;
  activeVersionId?: string;
}

interface CustomizeParams {
  tabId: string;
  prompt: string;
  currentCode: string;
  specContext: string;
  chatHistory: Array<{ role: string; content: string }>;
  onChunk?: (chunk: string, done: boolean) => void;
}

export interface CustomizeResult {
  code?: string;
  clarificationNeeded?: boolean;
  question?: string;
  options?: string[];
}

interface StreamResponseEvent {
  requestId: string;
  chunk: string;
  done: boolean;
}

// ─── Hook State ───────────────────────────────────────────────────────────────

interface UseCliState {
  /** Whether a message is currently being processed. */
  isLoading: boolean;
  /** Last error message, if any. */
  error: string | null;
  /** Current streaming content (accumulates chunks until done). */
  streamingContent: string | null;
}

interface UseCliReturn extends UseCliState {
  /**
   * Send a message to the CLI and return the full response string.
   * Accumulates streaming chunks on the side via the onChunk callback.
   */
  sendMessage(
    message: string,
    context?: SendMessageContext,
    onChunk?: (chunk: string, done: boolean) => void,
  ): Promise<string>;

  /**
   * Send a customization request to the CLI.
   * Handles clarification responses by returning a shaped result.
   */
  customize(params: CustomizeParams): Promise<CustomizeResult>;

  /** Fetch the current CLI status from the main process. */
  getStatus(): Promise<CLIState>;

  /** Force restart the CLI subprocess. */
  restart(): Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCli(): UseCliReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);

  /** Map of requestId → onChunk callback for streaming responses. */
  const chunkCallbacks = useRef<Map<string, (chunk: string, done: boolean) => void>>(new Map());
  /** Buffer of chunks that arrived before the callback was registered. */
  const chunkBuffer = useRef<Map<string, Array<{ chunk: string; done: boolean }>>>(new Map());

  // ── Subscribe to streaming chunks from main process ─────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !window.experienceUI?.cli) return;

    const unsubscribe = window.experienceUI.cli.onStreamResponse((event: StreamResponseEvent) => {
      const callback = chunkCallbacks.current.get(event.requestId);
      if (callback) {
        // Callback already registered — deliver directly
        callback(event.chunk, event.done);
        setStreamingContent((prev) => (event.done ? null : (prev ?? '') + event.chunk));
        if (event.done) {
          chunkCallbacks.current.delete(event.requestId);
          chunkBuffer.current.delete(event.requestId);
        }
      } else {
        // Buffer chunks until the callback is registered (race condition guard)
        const buf = chunkBuffer.current.get(event.requestId) ?? [];
        buf.push({ chunk: event.chunk, done: event.done });
        chunkBuffer.current.set(event.requestId, buf);
      }
    });

    return unsubscribe;
  }, []);

  // ── sendMessage ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (
      message: string,
      context?: SendMessageContext,
      onChunk?: (chunk: string, done: boolean) => void,
    ): Promise<string> => {
      if (!window.experienceUI?.cli) {
        throw new Error('CLI bridge is not available');
      }

      setIsLoading(true);
      setError(null);
      setStreamingContent(null);

      try {
        const result = await window.experienceUI.cli.sendMessage({ message, context });

        if (!result.success) {
          const errMsg = result.error ?? 'CLI request failed';
          setError(errMsg);
          throw new Error(errMsg);
        }

        // Register the chunk callback and replay any buffered chunks
        if (onChunk && result.requestId) {
          chunkCallbacks.current.set(result.requestId, onChunk);
          const buffered = chunkBuffer.current.get(result.requestId) ?? [];
          for (const { chunk, done } of buffered) {
            onChunk(chunk, done);
          }
          chunkBuffer.current.delete(result.requestId);
          if (buffered.some((b) => b.done)) {
            chunkCallbacks.current.delete(result.requestId);
          }
        }

        return result.response ?? '';
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // ── customize ────────────────────────────────────────────────────────────

  const customize = useCallback(
    async (params: CustomizeParams): Promise<CustomizeResult> => {
      const message = JSON.stringify({ method: 'customize', ...params });
      const response = await sendMessage(message, { tabId: params.tabId }, params.onChunk);
      try {
        const parsed = JSON.parse(response) as Record<string, unknown>;
        if (parsed.clarificationNeeded === true) {
          return {
            clarificationNeeded: true,
            question: String(parsed.question ?? ''),
            options: Array.isArray(parsed.options) ? (parsed.options as string[]) : [],
          };
        }
        return { code: String(parsed.code ?? response) };
      } catch {
        // If response is not JSON, treat as raw code
        return { code: response };
      }
    },
    [sendMessage],
  );

  // ── getStatus ────────────────────────────────────────────────────────────

  const getStatus = useCallback(async (): Promise<CLIState> => {
    if (!window.experienceUI?.cli) {
      throw new Error('CLI bridge is not available');
    }

    const result = await window.experienceUI.cli.getStatus();
    return {
      status: result.status,
      pid: result.pid,
      lastCrashAt: null,
      restartCount: result.restartCount,
      pendingRequests: result.pendingRequests,
      errorMessage: null,
    };
  }, []);

  // ── restart ──────────────────────────────────────────────────────────────

  const restart = useCallback(async (): Promise<void> => {
    if (!window.experienceUI?.cli) {
      throw new Error('CLI bridge is not available');
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.experienceUI.cli.restart();
      if (!result.success) {
        const errMsg = result.error ?? 'Restart failed';
        setError(errMsg);
        throw new Error(errMsg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, error, streamingContent, sendMessage, customize, getStatus, restart };
}

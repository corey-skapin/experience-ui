// src/renderer/hooks/use-sandbox.ts
// T039 — React hook for communicating with a sandboxed iframe.
// Manages lifecycle (loading → ready), error reporting, and typed message routing.

import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SandboxMessage {
  type: string;
  payload: unknown;
  nonce: string;
  timestamp: number;
}

interface ReadyPayload {
  nonce: string;
  version?: string;
}

interface ErrorPayload {
  message?: string;
  isFatal?: boolean;
}

export interface UseSandboxReturn {
  /** True once the sandbox has posted a READY message. */
  isReady: boolean;
  /** True from mount until the first READY or ERROR message. */
  isLoading: boolean;
  /** Last error message string, or null if no error. */
  error: string | null;
  /** The nonce generated for this sandbox session. */
  nonce: string;
  /** Post a typed message to the sandbox iframe. */
  sendToSandbox: (message: SandboxMessage) => void;
  /**
   * Register a one-shot or persistent handler for a specific sandbox message type.
   * Returns a cleanup function that removes the handler.
   */
  onSandboxMessage: (type: string, handler: (payload: unknown) => void) => () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Encapsulates all postMessage communication with a sandboxed iframe.
 *
 * Usage:
 *   const { isReady, sendToSandbox } = useSandbox(iframeRef);
 */
export function useSandbox(iframeRef: RefObject<HTMLIFrameElement | null>): UseSandboxReturn {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable nonce for the entire lifetime of this hook instance.
  const [nonce] = useState<string>(() => crypto.randomUUID());

  // Map of message type → handler. Using a ref avoids stale closures in the listener.
  const handlersRef = useRef<Map<string, (payload: unknown) => void>>(new Map());

  // ── sendToSandbox ──────────────────────────────────────────────────────────
  const sendToSandbox = useCallback(
    (message: SandboxMessage): void => {
      iframeRef.current?.contentWindow?.postMessage(message, '*');
    },
    [iframeRef],
  );

  // ── onSandboxMessage ───────────────────────────────────────────────────────
  const onSandboxMessage = useCallback(
    (type: string, handler: (payload: unknown) => void): (() => void) => {
      handlersRef.current.set(type, handler);
      return () => {
        handlersRef.current.delete(type);
      };
    },
    [],
  );

  // ── Message listener ───────────────────────────────────────────────────────
  useEffect(() => {
    setIsLoading(true);
    setIsReady(false);
    setError(null);

    const handleMessage = (event: MessageEvent): void => {
      if (!event.data || typeof event.data !== 'object') return;
      // Only accept messages from our own iframe.
      if (event.source !== iframeRef.current?.contentWindow) return;

      const { type, payload } = event.data as SandboxMessage;

      switch (type) {
        case 'READY': {
          const readyPayload = payload as ReadyPayload;
          // Verify the nonce echoed back by the sandbox matches ours.
          if (readyPayload?.nonce === nonce) {
            setIsReady(true);
            setIsLoading(false);
          }
          break;
        }
        case 'ERROR': {
          const errorPayload = payload as ErrorPayload;
          setError(errorPayload?.message ?? 'Unknown sandbox error');
          setIsLoading(false);
          break;
        }
        case 'RENDER_COMPLETE': {
          setIsLoading(false);
          break;
        }
        default:
          break;
      }

      // Dispatch to any registered handler.
      const handler = handlersRef.current.get(type);
      if (handler) handler(payload);
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [iframeRef, nonce]);

  return { isReady, isLoading, error, nonce, sendToSandbox, onSandboxMessage };
}

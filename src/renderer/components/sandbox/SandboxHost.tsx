// src/renderer/components/sandbox/SandboxHost.tsx
// T038 — Sandboxed iframe host component.
// Manages iframe lifecycle: CSP shell generation, INIT handshake, error recovery,
// and network request proxying via the main-process API bridge.

import { type JSX, useCallback, useEffect, useRef, useState } from 'react';

import { SANDBOX_CSP_TEMPLATE } from '../../../shared/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SandboxHostProps {
  compiledCode: string | null;
  theme: 'light' | 'dark';
  onReady?: () => void;
  onError?: (err: string) => void;
}

interface SandboxReadyPayload {
  nonce: string;
  version?: string;
}

interface SandboxErrorPayload {
  message?: string;
  isFatal?: boolean;
}

interface NetworkRequestPayload {
  requestId: string;
  baseUrl: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timeout?: number;
}

// ─── HTML Shell Builder ───────────────────────────────────────────────────────

/**
 * Produces a self-contained HTML document that:
 *  - Applies a strict CSP tied to a single-use nonce.
 *  - Mounts the compiled IIFE bundle inside a `<div id="root">`.
 *
 * The bundle is injected verbatim — the runtime.ts inside the iframe is
 * responsible for execution via the INIT handshake.
 */
function buildSandboxHtml(compiledCode: string, nonce: string, theme: 'light' | 'dark'): string {
  const csp = SANDBOX_CSP_TEMPLATE.replace(/\{\{NONCE\}\}/g, nonce);
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="UTF-8">',
    `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    `<meta name="viewport" content="width=device-width,initial-scale=1">`,
    `<style nonce="${nonce}">`,
    'html,body,#root{margin:0;padding:0;width:100%;height:100%;overflow:hidden}',
    '</style>',
    '</head>',
    `<body data-theme="${theme}">`,
    '<div id="root"></div>',
    `<script nonce="${nonce}">${compiledCode}</script>`,
    '</body>',
    '</html>',
  ].join('\n');
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SandboxHost({
  compiledCode,
  theme,
  onReady,
  onError,
}: SandboxHostProps): JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Stable nonce for the current compiledCode version.
  const [nonce] = useState<string>(() => crypto.randomUUID());

  const [isReady, setIsReady] = useState(false);

  // Preserve the last successfully initialized code for fatal-error recovery.
  const lastSafeCodeRef = useRef<string | null>(null);

  // ── Update iframe content when compiledCode changes ────────────────────────
  useEffect(() => {
    if (!compiledCode || !iframeRef.current) return;
    iframeRef.current.srcdoc = buildSandboxHtml(compiledCode, nonce, theme);
  }, [compiledCode, nonce, theme]);

  // ── Send INIT after iframe (re)loads ──────────────────────────────────────
  const handleLoad = useCallback(() => {
    if (!compiledCode || !iframeRef.current?.contentWindow) return;

    setIsReady(false);

    // The compiled code is already embedded in the iframe's HTML <script> tag
    // (via srcdoc) and has executed automatically at load time.
    // INIT is sent purely for configuration/handshake — bundledCode is omitted
    // to avoid double-execution by the sandbox runtime.
    iframeRef.current.contentWindow.postMessage(
      {
        type: 'INIT',
        payload: {
          nonce,
          bundledCode: '',
          reactRuntimeUrl: '',
          theme,
          containerSize: {
            width: iframeRef.current.offsetWidth || 800,
            height: iframeRef.current.offsetHeight || 600,
          },
        },
        nonce,
        timestamp: Date.now(),
      },
      '*',
    );
  }, [compiledCode, nonce, theme]);

  // ── Proxy network requests from sandbox through main process ──────────────
  const handleNetworkRequest = useCallback(
    async (requestPayload: NetworkRequestPayload, msgNonce: string): Promise<void> => {
      if (!iframeRef.current?.contentWindow) return;

      try {
        const response = await window.experienceUI.proxy.apiRequest({
          baseUrl: requestPayload.baseUrl,
          path: requestPayload.path,
          method: requestPayload.method,
          headers: requestPayload.headers,
          body: requestPayload.body,
          timeout: requestPayload.timeout,
        });

        iframeRef.current.contentWindow.postMessage(
          {
            type: 'NETWORK_RESPONSE',
            payload: { requestId: requestPayload.requestId, response },
            nonce: msgNonce,
            timestamp: Date.now(),
          },
          '*',
        );
      } catch (err) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: 'NETWORK_RESPONSE',
            payload: {
              requestId: requestPayload.requestId,
              error: err instanceof Error ? err.message : String(err),
            },
            nonce: msgNonce,
            timestamp: Date.now(),
          },
          '*',
        );
      }
    },
    [],
  );

  // ── Listen for messages from the sandbox ──────────────────────────────────
  useEffect(() => {
    const handler = (event: MessageEvent): void => {
      // Only process messages originating from our iframe.
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!event.data || typeof event.data !== 'object') return;

      const {
        type,
        payload,
        nonce: msgNonce,
      } = event.data as {
        type: string;
        payload: unknown;
        nonce: string;
      };

      switch (type) {
        case 'READY': {
          const readyPayload = payload as SandboxReadyPayload;
          if (readyPayload?.nonce !== nonce) {
            onError?.('Nonce mismatch — sandbox READY message rejected');
            return;
          }
          // Record this code as safe for potential recovery.
          if (compiledCode) lastSafeCodeRef.current = compiledCode;
          setIsReady(true);
          onReady?.();
          break;
        }

        case 'ERROR': {
          const errorPayload = payload as SandboxErrorPayload;
          const message = errorPayload?.message ?? 'Sandbox error';
          onError?.(message);

          // Fatal errors: attempt recovery by reverting to the last known-good code.
          if (errorPayload?.isFatal && lastSafeCodeRef.current && iframeRef.current) {
            iframeRef.current.srcdoc = buildSandboxHtml(lastSafeCodeRef.current, nonce, theme);
          }
          break;
        }

        case 'NETWORK_REQUEST': {
          void handleNetworkRequest(payload as NetworkRequestPayload, msgNonce);
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [nonce, compiledCode, theme, onReady, onError, handleNetworkRequest]);

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative' }}
      aria-label="Generated UI preview"
    >
      {!isReady && compiledCode && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-bg-primary)',
            color: 'var(--color-text-tertiary)',
            fontSize: 'var(--text-sm)',
            zIndex: 1,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          Loading…
        </div>
      )}
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="Generated UI"
        aria-label="Generated UI preview"
        onLoad={handleLoad}
      />
    </div>
  );
}

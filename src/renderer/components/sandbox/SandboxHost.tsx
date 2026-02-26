import React, { useRef, useEffect, useCallback } from 'react';
import { useSandbox } from '../../hooks/use-sandbox';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { SANDBOX_CSP_TEMPLATE } from '../../../shared/constants';

interface SandboxHostProps {
  compiledCode?: string;
  theme?: 'light' | 'dark';
}

function buildSandboxHtml(nonce: string, code: string, theme: string): string {
  const csp = SANDBOX_CSP_TEMPLATE.replace(/\{NONCE\}/g, nonce);
  return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <title>Sandbox</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    (function() {
      ${code}
    })();
  </script>
</body>
</html>`;
}

export function SandboxHost({
  compiledCode,
  theme = 'light',
}: SandboxHostProps): React.JSX.Element {
  const { sendToSandbox, nonce, isLoading, isError, errorMessage, iframeRef } = useSandbox();
  const srcDocRef = useRef<string>('');
  const lastSafeCodeRef = useRef<string | undefined>(undefined);

  // Build iframe srcDoc when compiledCode or nonce changes
  useEffect(() => {
    if (!compiledCode || !nonce) return;

    const html = buildSandboxHtml(nonce, compiledCode, theme);
    srcDocRef.current = html;
    if (iframeRef.current) {
      iframeRef.current.srcdoc = html;
    }
    lastSafeCodeRef.current = compiledCode;
  }, [compiledCode, nonce, theme, iframeRef]);

  // Theme changes
  useEffect(() => {
    if (!nonce) return;
    sendToSandbox({ type: 'THEME_CHANGE', payload: { theme } });
  }, [theme, nonce, sendToSandbox]);

  const handleIframeRef = useCallback(
    (el: HTMLIFrameElement | null) => {
      (iframeRef as React.MutableRefObject<HTMLIFrameElement | null>).current = el;
    },
    [iframeRef],
  );

  if (!compiledCode) {
    return (
      <div
        className="flex h-full items-center justify-center text-[var(--color-text-secondary)]"
        data-testid="sandbox-empty"
      >
        <div className="text-center">
          <p className="text-lg font-medium">No interface loaded</p>
          <p className="mt-1 text-sm">Provide an API spec in the chat to generate a UI.</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="flex h-full items-center justify-center text-red-500"
        data-testid="sandbox-error"
      >
        <div className="text-center">
          <p className="font-medium">Sandbox Error</p>
          <p className="mt-1 text-sm">{errorMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full" data-testid="sandbox-host">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50">
          <LoadingSpinner size="lg" label="Loading sandbox…" />
        </div>
      )}
      <iframe
        ref={handleIframeRef}
        title="Generated UI Sandbox"
        sandbox="allow-scripts"
        srcDoc={srcDocRef.current}
        className="h-full w-full border-none"
        data-testid="sandbox-iframe"
      />
    </div>
  );
}

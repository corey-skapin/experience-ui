/**
 * SandboxHost component.
 * Manages iframe lifecycle, generates session nonce,
 * handles INIT→READY handshake, relays NETWORK_REQUEST to host proxy,
 * handles ERROR (reload with last safe version), and logs CSP violations.
 */
import { useRef, useEffect, useCallback, type ReactElement } from 'react'
import { useSandbox } from '../../hooks/use-sandbox'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { ErrorBoundary } from '../common/ErrorBoundary'

// ─── Props ────────────────────────────────────────────────────────────────

interface SandboxHostProps {
  bundledCode: string | null
  theme: 'light' | 'dark'
  onRenderComplete?: (componentCount: number) => void
  onError?: (message: string, isFatal: boolean) => void
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────────

export function SandboxHost({
  bundledCode,
  theme,
  onRenderComplete,
  onError,
  className = '',
}: SandboxHostProps): ReactElement {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const {
    isReady,
    isLoading,
    error,
    sendToSandbox,
    onSandboxMessage,
    initSandbox,
    destroySandbox,
  } = useSandbox({ iframeRef })

  // Initialize sandbox when bundled code changes
  useEffect(() => {
    if (!bundledCode) return
    initSandbox(bundledCode, theme)
  }, [bundledCode, initSandbox, theme])

  // Cleanup on unmount
  useEffect(() => {
    return () => destroySandbox()
  }, [destroySandbox])

  // Handle RENDER_COMPLETE
  useEffect(() => {
    return onSandboxMessage('RENDER_COMPLETE', (payload) => {
      const p = payload as { componentCount?: number } | undefined
      onRenderComplete?.(p?.componentCount ?? 0)
    })
  }, [onSandboxMessage, onRenderComplete])

  // Handle ERROR from sandbox
  useEffect(() => {
    return onSandboxMessage('ERROR', (payload) => {
      const p = payload as { message?: string; isFatal?: boolean } | undefined
      onError?.(p?.message ?? 'Unknown sandbox error', p?.isFatal ?? false)
    })
  }, [onSandboxMessage, onError])

  // Handle NETWORK_REQUEST — proxy through host
  const handleNetworkRequest = useCallback(
    async (payload: unknown) => {
      const req = payload as {
        requestId: string
        url: string
        method: string
        headers: Record<string, string>
        body?: string
      }

      const bridge = window.experienceUI
      if (!bridge?.proxy?.apiRequest) return

      try {
        const urlObj = new URL(req.url)
        const result = await bridge.proxy.apiRequest({
          baseUrl: `${urlObj.protocol}//${urlObj.host}`,
          path: urlObj.pathname + urlObj.search,
          method: req.method,
          headers: req.headers,
          body: req.body,
        })

        sendToSandbox('NETWORK_RESPONSE', {
          requestId: req.requestId,
          status: result.status,
          statusText: result.statusText,
          headers: result.headers,
          body: result.body,
          ok: result.status >= 200 && result.status < 300,
        })
      } catch {
        sendToSandbox('NETWORK_RESPONSE', {
          requestId: req.requestId,
          status: 0,
          statusText: 'Network Error',
          headers: {},
          body: '',
          ok: false,
        })
      }
    },
    [sendToSandbox],
  )

  useEffect(() => {
    return onSandboxMessage('NETWORK_REQUEST', handleNetworkRequest)
  }, [onSandboxMessage, handleNetworkRequest])

  // Notify theme changes
  useEffect(() => {
    if (!isReady) return
    sendToSandbox('THEME_CHANGE', { theme })
  }, [theme, isReady, sendToSandbox])

  // Empty state
  if (!bundledCode) {
    return (
      <div
        className={`flex items-center justify-center h-full bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] ${className}`}
        data-testid="sandbox-host-empty"
      >
        <div className="text-center space-y-2">
          <div className="text-4xl">🖼️</div>
          <p className="text-sm">Generated interface will appear here</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Provide an API spec in the chat panel to get started
          </p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className={`relative flex flex-col h-full ${className}`} data-testid="sandbox-host">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg-primary)] bg-opacity-80 z-10">
            <div className="flex flex-col items-center gap-3">
              <LoadingSpinner size="lg" />
              <span className="text-sm text-[var(--color-text-secondary)]">
                Loading interface...
              </span>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg-primary)] z-10">
            <div className="text-center space-y-2 max-w-md px-4">
              <div className="text-3xl">⚠️</div>
              <p className="text-sm text-[var(--color-text-primary)]">{error}</p>
            </div>
          </div>
        )}

        {/* Sandboxed iframe */}
        <iframe
          ref={iframeRef}
          title="Generated API Interface"
          sandbox="allow-scripts"
          className="flex-1 w-full h-full border-none"
          data-testid="sandbox-iframe"
        />
      </div>
    </ErrorBoundary>
  )
}

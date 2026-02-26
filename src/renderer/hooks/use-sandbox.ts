/**
 * useSandbox hook.
 * Abstracts postMessage communication with the sandboxed iframe.
 * Manages nonce state, INIT→READY handshake, and RENDER_COMPLETE events.
 * Provides sendToSandbox/onSandboxMessage helpers.
 */
import { useState, useCallback, useRef, useEffect, type RefObject } from 'react'

// ─── Allowlist types (mirrored from sandbox/bridge.ts) ───────────────────

type SandboxInboundType =
  | 'READY'
  | 'RENDER_COMPLETE'
  | 'NETWORK_REQUEST'
  | 'LOG'
  | 'ERROR'
  | 'UI_EVENT'

type SandboxOutboundType =
  | 'INIT'
  | 'RENDER_DATA'
  | 'THEME_CHANGE'
  | 'RESIZE'
  | 'NETWORK_RESPONSE'
  | 'DESTROY'

export interface SandboxState {
  isReady: boolean
  isLoading: boolean
  error: string | null
  nonce: string | null
}

export interface UseSandboxOptions {
  iframeRef: RefObject<HTMLIFrameElement | null>
}

export interface UseSandboxReturn extends SandboxState {
  sendToSandbox: (type: SandboxOutboundType, payload?: unknown) => void
  onSandboxMessage: (type: SandboxInboundType, handler: (payload: unknown) => void) => () => void
  initSandbox: (bundledCode: string, theme: 'light' | 'dark') => void
  destroySandbox: () => void
}

// ─── Nonce generation ─────────────────────────────────────────────────────

function generateNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useSandbox({ iframeRef }: UseSandboxOptions): UseSandboxReturn {
  const [state, setState] = useState<SandboxState>({
    isReady: false,
    isLoading: false,
    error: null,
    nonce: null,
  })

  const nonceRef = useRef<string | null>(null)
  const handlersRef = useRef<Map<string, Array<(payload: unknown) => void>>>(new Map())

  // Listen for messages from the sandbox
  useEffect(() => {
    function handleMessage(event: MessageEvent): void {
      // Sandboxed iframes without allow-same-origin have origin 'null'
      if (event.source !== iframeRef.current?.contentWindow) return

      const { type, payload, nonce } = (event.data ?? {}) as {
        type?: string
        payload?: unknown
        nonce?: string
      }

      if (!type) return

      // READY message — verify nonce echo
      if (type === 'READY') {
        if (nonce !== nonceRef.current) {
          setState((s) => ({ ...s, error: 'Nonce mismatch: security violation', isLoading: false }))
          return
        }
        setState((s) => ({ ...s, isReady: true, isLoading: false }))
      }

      // Dispatch to registered handlers
      const handlers = handlersRef.current.get(type)
      if (handlers) {
        for (const handler of handlers) {
          handler(payload)
        }
      }

      // Handle RENDER_COMPLETE
      if (type === 'RENDER_COMPLETE') {
        setState((s) => ({ ...s, isLoading: false }))
      }

      // Handle ERROR
      if (type === 'ERROR') {
        const errPayload = payload as { message?: string; isFatal?: boolean } | undefined
        if (errPayload?.isFatal) {
          setState((s) => ({
            ...s,
            error: errPayload.message ?? 'Sandbox error',
            isLoading: false,
          }))
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [iframeRef])

  const sendToSandbox = useCallback(
    (type: SandboxOutboundType, payload?: unknown) => {
      const iframe = iframeRef.current
      if (!iframe?.contentWindow) return
      iframe.contentWindow.postMessage(
        { type, payload, nonce: nonceRef.current, timestamp: Date.now() },
        '*',
      )
    },
    [iframeRef],
  )

  const onSandboxMessage = useCallback(
    (type: SandboxInboundType, handler: (payload: unknown) => void): (() => void) => {
      const handlers = handlersRef.current.get(type) ?? []
      handlers.push(handler)
      handlersRef.current.set(type, handlers)

      return () => {
        const current = handlersRef.current.get(type) ?? []
        handlersRef.current.set(
          type,
          current.filter((h) => h !== handler),
        )
      }
    },
    [],
  )

  const initSandbox = useCallback(
    (bundledCode: string, theme: 'light' | 'dark') => {
      const nonce = generateNonce()
      nonceRef.current = nonce
      setState({ isReady: false, isLoading: true, error: null, nonce })

      const containerEl = iframeRef.current?.parentElement
      const containerSize = {
        width: containerEl?.clientWidth ?? 800,
        height: containerEl?.clientHeight ?? 600,
      }

      sendToSandbox('INIT', {
        nonce,
        bundledCode,
        theme,
        containerSize,
      })
    },
    [iframeRef, sendToSandbox],
  )

  const destroySandbox = useCallback(() => {
    sendToSandbox('DESTROY', {})
    nonceRef.current = null
    setState({ isReady: false, isLoading: false, error: null, nonce: null })
  }, [sendToSandbox])

  return { ...state, sendToSandbox, onSandboxMessage, initSandbox, destroySandbox }
}

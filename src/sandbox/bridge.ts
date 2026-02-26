/**
 * Sandbox postMessage bridge (sandbox side).
 * Handles communication between the sandboxed iframe and the host renderer.
 * Verifies nonce, filters message types, and proxies network requests.
 *
 * Exports HOST_ALLOWED_TYPES, SANDBOX_ALLOWED_TYPES, and createBridge
 * for testability.
 */

// ─── Allowlist exports ────────────────────────────────────────────────────

/** Message types the host accepts FROM the sandbox. */
export const HOST_ALLOWED_TYPES = [
  'READY',
  'RENDER_COMPLETE',
  'NETWORK_REQUEST',
  'LOG',
  'ERROR',
  'UI_EVENT',
] as const

/** Message types the sandbox accepts FROM the host. */
export const SANDBOX_ALLOWED_TYPES = [
  'INIT',
  'RENDER_DATA',
  'THEME_CHANGE',
  'RESIZE',
  'NETWORK_RESPONSE',
  'DESTROY',
] as const

export type HostAllowedType = (typeof HOST_ALLOWED_TYPES)[number]
export type SandboxAllowedType = (typeof SANDBOX_ALLOWED_TYPES)[number]

// ─── Bridge instance type ─────────────────────────────────────────────────

interface NetworkRequestPayload {
  requestId: string
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}

export interface BridgeInstance {
  handleMessage: (event: MessageEvent) => void
  sendToHost: (type: HostAllowedType, payload?: unknown) => void
  getNonce: () => string | null
  onNetworkRequest: (cb: (payload: NetworkRequestPayload) => void) => void
  simulateNetworkRequest: (payload: NetworkRequestPayload) => void
}

// ─── createBridge factory ─────────────────────────────────────────────────

interface BridgeOptions {
  parent?: Window
}

export function createBridge(options: BridgeOptions = {}): BridgeInstance {
  let sessionNonce: string | null = null
  let hostOriginRef: string | null = null
  const parentWindow = options.parent ?? window.parent
  const networkRequestListeners: Array<(payload: NetworkRequestPayload) => void> = []

  function isAllowedSandboxType(type: string): type is SandboxAllowedType {
    return (SANDBOX_ALLOWED_TYPES as readonly string[]).includes(type)
  }

  function sendToHost(type: HostAllowedType, payload?: unknown): void {
    const origin = hostOriginRef ?? '*'
    parentWindow.postMessage({ type, nonce: sessionNonce, payload }, origin)
  }

  function handleMessage(event: MessageEvent): void {
    if (event.source !== parentWindow) return

    const { type, nonce, payload } = (event.data ?? {}) as {
      type?: string
      nonce?: string
      payload?: unknown
    }

    if (!type || !isAllowedSandboxType(type)) return

    if (type === 'INIT') {
      sessionNonce = nonce ?? null
      hostOriginRef = event.origin
      sendToHost('READY', { nonce: sessionNonce, version: '1.0.0' })
      return
    }

    // All post-INIT messages must match established nonce
    if (!sessionNonce || nonce !== sessionNonce) return

    if (type === 'RENDER_DATA') {
      window.dispatchEvent(new CustomEvent('sandbox:render', { detail: payload }))
    } else if (type === 'THEME_CHANGE') {
      window.dispatchEvent(new CustomEvent('sandbox:theme', { detail: payload }))
    } else if (type === 'RESIZE') {
      window.dispatchEvent(new CustomEvent('sandbox:resize', { detail: payload }))
    } else if (type === 'NETWORK_RESPONSE') {
      window.dispatchEvent(new CustomEvent('sandbox:network-response', { detail: payload }))
    } else if (type === 'DESTROY') {
      window.dispatchEvent(new CustomEvent('sandbox:destroy'))
    }
  }

  function onNetworkRequest(cb: (payload: NetworkRequestPayload) => void): void {
    networkRequestListeners.push(cb)
  }

  function simulateNetworkRequest(payload: NetworkRequestPayload): void {
    for (const listener of networkRequestListeners) {
      listener(payload)
    }
  }

  return {
    handleMessage,
    sendToHost,
    getNonce: () => sessionNonce,
    onNetworkRequest,
    simulateNetworkRequest,
  }
}

interface NetworkResponseDetail {
  requestId: string
  response: {
    status: number
    statusText: string
    headers: Record<string, string>
    body: string
  }
}

// ─── Module-level singleton (for browser use) ─────────────────────────────

const bridge = createBridge()

// Override fetch to proxy all network requests through the host
const originalFetch = window.fetch.bind(window)
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const nonce = bridge.getNonce()
  if (!nonce) {
    return originalFetch(input, init)
  }

  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = init?.method ?? 'GET'
  const headers = init?.headers ? Object.fromEntries(new Headers(init.headers)) : {}
  const body = typeof init?.body === 'string' ? init.body : undefined
  const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  bridge.sendToHost('NETWORK_REQUEST', { requestId, url, method, headers, body })

  return new Promise<Response>((resolve, reject) => {
    const handler = (event: Event): void => {
      const detail = (event as CustomEvent<NetworkResponseDetail>).detail
      if (detail.requestId !== requestId) return

      window.removeEventListener('sandbox:network-response', handler)
      const { status, statusText, headers: resHeaders, body: resBody } = detail.response
      resolve(new Response(resBody, { status, statusText, headers: new Headers(resHeaders) }))
    }

    window.addEventListener('sandbox:network-response', handler)
    setTimeout(() => {
      window.removeEventListener('sandbox:network-response', handler)
      reject(new Error('Network request timeout'))
    }, 30_000)
  })
}

window.addEventListener('message', (e) => bridge.handleMessage(e))

export const { sendToHost } = bridge

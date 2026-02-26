/**
 * Sandbox postMessage bridge (sandbox side).
 * Handles communication between the sandboxed iframe and the host renderer.
 * Verifies nonce, filters message types, and proxies network requests.
 */
import { SANDBOX } from '../shared/constants'

type InboundMessageType = (typeof SANDBOX.ALLOWED_INBOUND_MESSAGE_TYPES)[number]
type OutboundMessageType = (typeof SANDBOX.ALLOWED_OUTBOUND_MESSAGE_TYPES)[number]

interface SandboxMessage {
  type: OutboundMessageType
  nonce: string
  payload?: unknown
}

interface BridgeOutboundMessage {
  type: InboundMessageType
  nonce: string
  payload?: unknown
}

let sessionNonce: string | null = null
let hostOrigin: string | null = null

function isAllowedOutboundType(type: string): type is OutboundMessageType {
  return (SANDBOX.ALLOWED_OUTBOUND_MESSAGE_TYPES as readonly string[]).includes(type)
}

function sendToHost(type: InboundMessageType, payload?: unknown): void {
  if (!sessionNonce || !hostOrigin) return
  const message: BridgeOutboundMessage = { type, nonce: sessionNonce, payload }
  window.parent.postMessage(message, hostOrigin)
}

function handleMessage(event: MessageEvent<SandboxMessage>): void {
  // Security: only accept messages from the direct parent
  if (event.source !== window.parent) return

  const { type, nonce, payload } = event.data ?? {}

  if (!type || !isAllowedOutboundType(type)) return

  // INIT message establishes the session nonce and trusted origin
  if (type === 'INIT') {
    sessionNonce = nonce
    hostOrigin = event.origin
    sendToHost('SANDBOX_READY')
    return
  }

  // All subsequent messages must match the established nonce
  if (nonce !== sessionNonce) return

  if (type === 'RENDER_DATA') {
    window.dispatchEvent(new CustomEvent('sandbox:render', { detail: payload }))
  } else if (type === 'THEME_CHANGE') {
    window.dispatchEvent(new CustomEvent('sandbox:theme', { detail: payload }))
  } else if (type === 'RESIZE') {
    window.dispatchEvent(new CustomEvent('sandbox:resize', { detail: payload }))
  } else if (type === 'NETWORK_RESPONSE') {
    window.dispatchEvent(new CustomEvent('sandbox:network-response', { detail: payload }))
  }
}

// Override fetch to proxy all network requests through the host
const originalFetch = window.fetch.bind(window)
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  if (!sessionNonce) {
    return originalFetch(input, init)
  }

  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = init?.method ?? 'GET'
  const headers = init?.headers ? Object.fromEntries(new Headers(init.headers)) : {}
  const body = typeof init?.body === 'string' ? init.body : undefined

  sendToHost('NETWORK_REQUEST', { url, method, headers, body })

  return new Promise<Response>((resolve, reject) => {
    const handler = (event: Event): void => {
      const { requestUrl, response } = (
        event as CustomEvent<{
          requestUrl: string
          response: {
            status: number
            statusText: string
            headers: Record<string, string>
            body: string
          }
        }>
      ).detail

      if (requestUrl !== url) return
      window.removeEventListener('sandbox:network-response', handler)

      const { status, statusText, headers: responseHeaders, body: responseBody } = response
      resolve(
        new Response(responseBody, {
          status,
          statusText,
          headers: new Headers(responseHeaders),
        }),
      )
    }

    window.addEventListener('sandbox:network-response', handler)

    // Reject after 30 seconds
    setTimeout(() => {
      window.removeEventListener('sandbox:network-response', handler)
      reject(new Error('Network request timeout'))
    }, 30_000)
  })
}

window.addEventListener('message', handleMessage)

export { sendToHost }

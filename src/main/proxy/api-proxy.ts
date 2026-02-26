/**
 * API network proxy.
 * Receives proxy:api-request IPC calls, executes HTTP requests via Node.js fetch,
 * and returns ProxyAPIResponse. Injects authentication headers from CredentialStore.
 */
import type { ProxyAPIRequest, ProxyAPIResponse } from '../../shared/types/ipc'
import type { CredentialStore } from '../credentials/credential-store'

// ─── Proxy handler ────────────────────────────────────────────────────────

export async function handleProxyRequest(
  req: ProxyAPIRequest,
  store?: CredentialStore,
): Promise<ProxyAPIResponse> {
  const startTime = Date.now()
  const url = `${req.baseUrl}${req.path}`

  const headers = new Headers(req.headers ?? {})
  if (!headers.has('Content-Type') && req.body) {
    headers.set('Content-Type', 'application/json')
  }

  // Inject auth headers from credential store
  if (store) {
    const authHeaders = store.getAuthHeaders(req.baseUrl)
    for (const [key, value] of Object.entries(authHeaders)) {
      if (!headers.has(key)) {
        headers.set(key, value)
      }
    }
  }

  const fetchOptions: RequestInit = {
    method: req.method,
    headers,
    body: req.body ?? undefined,
    signal: req.timeout ? AbortSignal.timeout(req.timeout) : undefined,
  }

  const response = await fetch(url, fetchOptions)
  const elapsedMs = Date.now() - startTime

  const responseHeaders: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value
  })

  let body: string
  try {
    body = await response.text()
  } catch {
    body = ''
  }

  return {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    body,
    elapsedMs,
  }
}

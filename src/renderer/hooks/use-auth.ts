/**
 * useAuth hook — provides auth configuration and connection management.
 * Uses window.experienceUI.auth bridge (no main process imports).
 */
import { useState, useCallback } from 'react'
import { useAuthStore } from '../stores/auth-store'

// ─── Types (derived from window bridge, no main imports) ──────────────────

type ConfigureRequest = Parameters<Window['experienceUI']['auth']['configure']>[0]
type TestRequest = Parameters<Window['experienceUI']['auth']['testConnection']>[0]
type OAuthRequest = Parameters<Window['experienceUI']['auth']['startOAuthFlow']>[0]
type ClearRequest = Parameters<Window['experienceUI']['auth']['clearCredentials']>[0]

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useAuth(baseUrl?: string) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { setConnection, setConnectionStatus, clearConnection, getStatus } = useAuthStore()

  const status = baseUrl ? getStatus(baseUrl) : 'disconnected'

  const configure = useCallback(
    async (url: string, method: ConfigureRequest['method'], persist = false) => {
      setIsLoading(true)
      setError(null)
      try {
        setConnectionStatus(url, 'connecting')
        const result = await window.experienceUI.auth.configure({ baseUrl: url, method, persist })
        if (result.success) {
          const authMethodType =
            method.type === 'apiKey' ? 'apiKey' : method.type === 'bearer' ? 'bearer' : 'oauth2'
          setConnection(url, {
            status: 'connected',
            authMethod: authMethodType,
            lastVerifiedAt: Date.now(),
            responseTimeMs: null,
          })
        } else {
          setConnectionStatus(url, 'disconnected')
          setError(result.error ?? 'Configuration failed')
        }
        return result
      } catch (err) {
        setConnectionStatus(url, 'disconnected')
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        return { success: false, connectionId: '', error: msg }
      } finally {
        setIsLoading(false)
      }
    },
    [setConnection, setConnectionStatus],
  )

  const testConnection = useCallback(
    async (url: string, healthCheckPath?: string) => {
      setIsLoading(true)
      setError(null)
      try {
        const req: TestRequest = { baseUrl: url }
        if (healthCheckPath) req.healthCheckPath = healthCheckPath
        const result = await window.experienceUI.auth.testConnection(req)
        setConnectionStatus(
          url,
          result.status === 'connected'
            ? 'connected'
            : result.status === 'unauthorized'
              ? 'expired'
              : result.status === 'degraded'
                ? 'degraded'
                : 'unreachable',
        )
        return result
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        return { status: 'unreachable' as const, responseTimeMs: 0, error: msg }
      } finally {
        setIsLoading(false)
      }
    },
    [setConnectionStatus],
  )

  const getConnectionStatus = useCallback(async (url: string) => {
    try {
      return await window.experienceUI.auth.getConnectionStatus({ baseUrl: url })
    } catch {
      return null
    }
  }, [])

  const startOAuthFlow = useCallback(
    async (params: OAuthRequest) => {
      setIsLoading(true)
      setError(null)
      try {
        setConnectionStatus(params.baseUrl, 'connecting')
        const result = await window.experienceUI.auth.startOAuthFlow(params)
        if (result.success) {
          setConnection(params.baseUrl, {
            status: 'connected',
            authMethod: 'oauth2',
            lastVerifiedAt: Date.now(),
            responseTimeMs: null,
          })
        } else {
          setConnectionStatus(params.baseUrl, 'disconnected')
          setError(result.error ?? 'OAuth flow failed')
        }
        return result
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        return { success: false, error: msg }
      } finally {
        setIsLoading(false)
      }
    },
    [setConnection, setConnectionStatus],
  )

  const clearCredentials = useCallback(
    async (url: string, clearPersisted = false) => {
      try {
        const req: ClearRequest = { baseUrl: url, clearPersisted }
        const result = await window.experienceUI.auth.clearCredentials(req)
        if (result.success) {
          clearConnection(url)
        }
        return result
      } catch {
        return { success: false }
      }
    },
    [clearConnection],
  )

  return {
    status,
    isLoading,
    error,
    configure,
    testConnection,
    getConnectionStatus,
    startOAuthFlow,
    clearCredentials,
  }
}

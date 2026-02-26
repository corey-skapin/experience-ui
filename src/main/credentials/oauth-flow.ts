/**
 * OAuth 2.0 PKCE flow implementation.
 * Opens a dedicated BrowserWindow, intercepts the redirect, exchanges code for tokens.
 */
import { BrowserWindow, ipcMain } from 'electron'
import { randomBytes, createHash } from 'crypto'
import { AUTH_CHANNELS } from '../../shared/ipc-channels'
import type { OAuthFlowRequest, OAuthFlowResponse } from '../../shared/types/ipc'
import type { CredentialStore } from './credential-store'

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

export function registerOAuthHandler(store: CredentialStore): void {
  ipcMain.handle(
    AUTH_CHANNELS.START_OAUTH_FLOW,
    async (_event, req: OAuthFlowRequest): Promise<OAuthFlowResponse> => {
      return startOAuthFlow(req, store)
    },
  )
}

async function startOAuthFlow(
  req: OAuthFlowRequest,
  store: CredentialStore,
): Promise<OAuthFlowResponse> {
  const { verifier, challenge } = generatePKCE()
  const redirectUri = req.redirectUri ?? 'http://localhost:0/callback'

  const authUrl = new URL(req.authEndpoint)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', req.clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', req.scopes.join(' '))
  authUrl.searchParams.set('code_challenge', challenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('state', base64url(randomBytes(16)))

  return new Promise<OAuthFlowResponse>((resolve) => {
    const win = new BrowserWindow({
      width: 600,
      height: 700,
      show: true,
      webPreferences: {
        sandbox: true,
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    const timeout = setTimeout(
      () => {
        if (!win.isDestroyed()) win.close()
        resolve({ success: false, error: 'OAuth flow timed out' })
      },
      5 * 60 * 1000,
    )

    win.webContents.on('will-redirect', (_ev, url) => {
      if (!url.startsWith(redirectUri)) return

      clearTimeout(timeout)
      win.close()

      const redirectUrl = new URL(url)
      const code = redirectUrl.searchParams.get('code')
      if (!code) {
        resolve({ success: false, error: 'No authorization code in redirect' })
        return
      }

      void exchangeCodeForTokens(req, code, verifier, redirectUri, store).then(resolve)
    })

    win.on('closed', () => {
      clearTimeout(timeout)
      resolve({ success: false, error: 'OAuth window closed by user' })
    })

    void win.loadURL(authUrl.toString())
  })
}

async function exchangeCodeForTokens(
  req: OAuthFlowRequest,
  code: string,
  verifier: string,
  redirectUri: string,
  store: CredentialStore,
): Promise<OAuthFlowResponse> {
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: req.clientId,
      code_verifier: verifier,
    })

    const response = await fetch(req.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!response.ok) {
      return { success: false, error: `Token exchange failed: ${response.status}` }
    }

    const data = (await response.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
    }

    const expiresAt = data.expires_in ? Date.now() + data.expires_in * 1000 : undefined

    const connectionId = store.setCredentials(req.baseUrl, {
      type: 'oauth2',
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    })

    return { success: true, connectionId }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

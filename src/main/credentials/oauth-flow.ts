// src/main/credentials/oauth-flow.ts
// T048 — OAuth 2.0 PKCE authorization-code flow.
// Opens a sandboxed BrowserWindow, intercepts the redirect, exchanges the code
// for tokens, and stores them in credentialStore.

import { createHash, randomBytes } from 'node:crypto';
import { BrowserWindow } from 'electron';

import type { OAuthFlowRequest, OAuthFlowResponse } from '../preload-types';
import type { CredentialStore } from './credential-store';

// ─── PKCE helpers ─────────────────────────────────────────────────────────────

function generateCodeVerifier(): string {
  // RFC 7636: 43–128 URL-safe characters
  return randomBytes(64).toString('base64url').slice(0, 96);
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

// ─── Token exchange ───────────────────────────────────────────────────────────

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

async function exchangeCodeForToken(
  tokenEndpoint: string,
  code: string,
  codeVerifier: string,
  clientId: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<TokenResponse>;
}

// ─── OAuthFlow ────────────────────────────────────────────────────────────────

export class OAuthFlow {
  constructor(private readonly credentialStore: CredentialStore) {}

  async startFlow(params: OAuthFlowRequest): Promise<OAuthFlowResponse> {
    const {
      baseUrl,
      clientId,
      authEndpoint,
      tokenEndpoint,
      scopes,
      redirectUri = 'http://localhost:9898/callback',
    } = params;

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const authUrl = new URL(authEndpoint);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', randomBytes(16).toString('hex'));

    return new Promise<OAuthFlowResponse>((resolve) => {
      const win = new BrowserWindow({
        width: 800,
        height: 600,
        show: true,
        webPreferences: {
          sandbox: true,
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      let settled = false;

      const settle = (result: OAuthFlowResponse): void => {
        if (settled) return;
        settled = true;
        if (!win.isDestroyed()) win.close();
        resolve(result);
      };

      // Intercept navigation to the redirect URI
      win.webContents.on('will-redirect', (_event, url) => {
        if (!url.startsWith(redirectUri)) return;

        const parsed = new URL(url);
        const code = parsed.searchParams.get('code');
        const error = parsed.searchParams.get('error');

        if (error) {
          settle({ success: false, error: `OAuth error: ${error}` });
          return;
        }

        if (!code) {
          settle({ success: false, error: 'No authorization code in redirect' });
          return;
        }

        void exchangeCodeForToken(tokenEndpoint, code, codeVerifier, clientId, redirectUri)
          .then((tokens) => {
            const expiresAt = tokens.expires_in
              ? Date.now() + tokens.expires_in * 1_000
              : undefined;

            this.credentialStore.set(baseUrl, {
              type: 'oauth2',
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              expiresAt,
            });

            const ref = this.credentialStore.get(baseUrl);
            settle({
              success: true,
              connectionId: ref?.connectionId,
            });
          })
          .catch((err: unknown) => {
            settle({
              success: false,
              error: err instanceof Error ? err.message : String(err),
            });
          });
      });

      win.on('closed', () => {
        settle({ success: false, error: 'OAuth window closed by user' });
      });

      void win.loadURL(authUrl.toString());
    });
  }
}

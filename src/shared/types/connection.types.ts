export type AuthMethod =
  | { type: 'none' }
  | { type: 'apiKey'; headerName: string; keyRef: string }
  | { type: 'bearer'; tokenRef: string }
  | {
      type: 'oauth2';
      clientId: string;
      authEndpoint: string;
      tokenEndpoint: string;
      scopes: string[];
      tokenRef: string;
      refreshTokenRef: string;
    };

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'degraded'
  | 'expired'
  | 'unreachable';

export interface APIConnection {
  id: string;
  baseUrl: string;
  authMethod: AuthMethod;
  status: ConnectionStatus;
  lastVerifiedAt: string | null;
  responseTimeMs: number | null;
  tabIds: string[];
}

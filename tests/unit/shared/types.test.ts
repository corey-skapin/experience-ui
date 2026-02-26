import { describe, it, expect } from 'vitest';
import type {
  APISpec,
  NormalizedSpec,
  NormalizedEndpoint,
  NormalizedOperation,
  NormalizedModel,
  SecurityScheme,
  SpecSource,
  SpecMetadata,
  ValidationError,
  GeneratedInterface,
  SandboxState,
  InterfaceVersion,
  AuthMethod,
  ConnectionStatus,
  CLIState,
} from '@shared/types';

describe('Shared Types - Core', () => {
  describe('SpecSource discriminated union', () => {
    it('accepts file source', () => {
      const source: SpecSource = { type: 'file', fileName: 'api.json', filePath: '/tmp/api.json' };
      expect(source.type).toBe('file');
    });

    it('accepts url source', () => {
      const source: SpecSource = { type: 'url', url: 'https://example.com/api.json' };
      expect(source.type).toBe('url');
    });

    it('accepts text source', () => {
      const source: SpecSource = { type: 'text' };
      expect(source.type).toBe('text');
    });
  });

  describe('ValidationError', () => {
    it('has correct shape', () => {
      const error: ValidationError = {
        path: '/info/title',
        message: 'Required field missing',
        severity: 'error',
      };
      expect(error.severity).toBe('error');
      expect(error.path).toBeDefined();
      expect(error.message).toBeDefined();
    });

    it('accepts warning severity', () => {
      const error: ValidationError = {
        path: '/info/description',
        message: 'Description recommended',
        severity: 'warning',
      };
      expect(error.severity).toBe('warning');
    });
  });

  describe('NormalizedModel', () => {
    it('supports all type variants', () => {
      const types: NormalizedModel['type'][] = [
        'object', 'array', 'string', 'number', 'integer', 'boolean', 'null', 'enum', 'union',
      ];
      types.forEach((type) => {
        const model: NormalizedModel = { name: 'Test', type };
        expect(model.type).toBe(type);
      });
    });
  });

  describe('AuthMethod discriminated union', () => {
    it('accepts none', () => {
      const auth: AuthMethod = { type: 'none' };
      expect(auth.type).toBe('none');
    });

    it('accepts apiKey', () => {
      const auth: AuthMethod = { type: 'apiKey', headerName: 'X-API-Key', keyRef: 'my-key' };
      expect(auth.type).toBe('apiKey');
    });

    it('accepts bearer', () => {
      const auth: AuthMethod = { type: 'bearer', tokenRef: 'my-token' };
      expect(auth.type).toBe('bearer');
    });

    it('accepts oauth2', () => {
      const auth: AuthMethod = {
        type: 'oauth2',
        clientId: 'client-id',
        authEndpoint: 'https://auth.example.com/authorize',
        tokenEndpoint: 'https://auth.example.com/token',
        scopes: ['read', 'write'],
        tokenRef: 'access-token',
        refreshTokenRef: 'refresh-token',
      };
      expect(auth.type).toBe('oauth2');
    });
  });

  describe('SandboxState discriminated union', () => {
    it('accepts idle', () => {
      const state: SandboxState = { status: 'idle' };
      expect(state.status).toBe('idle');
    });

    it('accepts loading with progress', () => {
      const state: SandboxState = { status: 'loading', progress: 50 };
      expect(state.status).toBe('loading');
      if (state.status === 'loading') {
        expect(state.progress).toBe(50);
      }
    });

    it('accepts active with iframeRef', () => {
      const state: SandboxState = { status: 'active', iframeRef: 'iframe-1' };
      expect(state.status).toBe('active');
    });

    it('accepts error with details', () => {
      const state: SandboxState = {
        status: 'error',
        error: 'Render failed',
        lastSafeVersionId: 'v1',
      };
      expect(state.status).toBe('error');
    });
  });

  describe('CLIState', () => {
    it('has correct shape', () => {
      const cliState: CLIState = {
        status: 'stopped',
        pid: null,
        lastCrashAt: null,
        restartCount: 0,
        pendingRequests: 0,
        errorMessage: null,
      };
      expect(cliState.status).toBe('stopped');
    });

    it('accepts all status values', () => {
      const statuses: CLIState['status'][] = [
        'stopped', 'starting', 'running', 'crashed', 'restarting',
      ];
      statuses.forEach((status) => {
        const state: CLIState = {
          status,
          pid: null,
          lastCrashAt: null,
          restartCount: 0,
          pendingRequests: 0,
          errorMessage: null,
        };
        expect(state.status).toBe(status);
      });
    });
  });

  describe('ConnectionStatus', () => {
    it('includes all required statuses', () => {
      const statuses: ConnectionStatus[] = [
        'disconnected', 'connecting', 'connected', 'degraded', 'expired', 'unreachable',
      ];
      statuses.forEach((status) => {
        expect(typeof status).toBe('string');
      });
    });
  });

  it('NormalizedEndpoint has correct method types', () => {
    const methods: NormalizedEndpoint['method'][] = [
      'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS',
    ];
    expect(methods).toHaveLength(7);
  });

  it('NormalizedSpec has correct shape', () => {
    const spec: NormalizedSpec = {
      format: 'openapi3',
      metadata: { title: 'Test API', version: '1.0.0' },
      models: [],
    };
    expect(spec.format).toBe('openapi3');
  });

  it('APISpec has correct validationStatus values', () => {
    const statuses: APISpec['validationStatus'][] = ['valid', 'invalid', 'warnings'];
    expect(statuses).toHaveLength(3);
  });

  it('NormalizedOperation has correct type values', () => {
    const op: NormalizedOperation = {
      name: 'getUser',
      type: 'query',
      args: [],
      returnType: { name: 'User', type: 'object' },
    };
    expect(op.type).toBe('query');
  });

  it('SpecMetadata has required and optional fields', () => {
    const meta: SpecMetadata = { title: 'API', version: '1.0.0' };
    expect(meta.title).toBe('API');
    expect(meta.description).toBeUndefined();
  });

  it('SecurityScheme has correct type', () => {
    const scheme: SecurityScheme = {
      name: 'apiKey',
      type: 'apiKey',
      in: 'header',
    };
    expect(scheme.type).toBe('apiKey');
  });

  it('InterfaceVersion has correct changeType values', () => {
    const changeTypes: InterfaceVersion['changeType'][] = [
      'generation', 'customization', 'rollback',
    ];
    expect(changeTypes).toHaveLength(3);
  });

  it('GeneratedInterface has correct shape', () => {
    const gi: GeneratedInterface = {
      id: 'gi-1',
      tabId: 'tab-1',
      apiSpecId: 'spec-1',
      currentVersionId: 'v1',
      versions: [],
      sandboxState: { status: 'idle' },
      createdAt: new Date().toISOString(),
    };
    expect(gi.id).toBe('gi-1');
  });
});

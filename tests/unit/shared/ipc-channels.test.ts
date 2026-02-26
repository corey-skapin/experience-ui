import { describe, it, expect } from 'vitest';
import {
  IPC_CLI_SEND_MESSAGE,
  IPC_CLI_GET_STATUS,
  IPC_CLI_RESTART,
  IPC_CLI_STATUS_CHANGED,
  IPC_CLI_STREAM_RESPONSE,
  IPC_AUTH_CONFIGURE,
  IPC_AUTH_TEST_CONNECTION,
  IPC_AUTH_GET_CONNECTION_STATUS,
  IPC_AUTH_START_OAUTH_FLOW,
  IPC_AUTH_CLEAR_CREDENTIALS,
  IPC_AUTH_TOKEN_EXPIRED,
  IPC_AUTH_TOKEN_REFRESHED,
  IPC_AUTH_CONNECTION_STATUS_CHANGED,
  IPC_PROXY_API_REQUEST,
  IPC_VERSIONS_SAVE_SNAPSHOT,
  IPC_VERSIONS_LIST,
  IPC_VERSIONS_LOAD_CODE,
  IPC_VERSIONS_GET_DIFF,
  IPC_PLUGINS_INSTALL,
  IPC_PLUGINS_UNINSTALL,
  IPC_PLUGINS_LIST,
  IPC_PLUGINS_STATUS_CHANGED,
  IPC_APP_COMPILE_CODE,
  IPC_APP_VALIDATE_CODE,
} from '@shared/ipc-channels';

describe('IPC Channel Constants', () => {
  describe('CLI channels', () => {
    it('IPC_CLI_SEND_MESSAGE has correct value', () => {
      expect(IPC_CLI_SEND_MESSAGE).toBe('cli:send-message');
    });

    it('IPC_CLI_GET_STATUS has correct value', () => {
      expect(IPC_CLI_GET_STATUS).toBe('cli:get-status');
    });

    it('IPC_CLI_RESTART has correct value', () => {
      expect(IPC_CLI_RESTART).toBe('cli:restart');
    });

    it('IPC_CLI_STATUS_CHANGED has correct value', () => {
      expect(IPC_CLI_STATUS_CHANGED).toBe('cli:status-changed');
    });

    it('IPC_CLI_STREAM_RESPONSE has correct value', () => {
      expect(IPC_CLI_STREAM_RESPONSE).toBe('cli:stream-response');
    });
  });

  describe('Auth channels', () => {
    it('IPC_AUTH_CONFIGURE has correct value', () => {
      expect(IPC_AUTH_CONFIGURE).toBe('auth:configure');
    });

    it('IPC_AUTH_TEST_CONNECTION has correct value', () => {
      expect(IPC_AUTH_TEST_CONNECTION).toBe('auth:test-connection');
    });

    it('IPC_AUTH_GET_CONNECTION_STATUS has correct value', () => {
      expect(IPC_AUTH_GET_CONNECTION_STATUS).toBe('auth:get-connection-status');
    });

    it('IPC_AUTH_START_OAUTH_FLOW has correct value', () => {
      expect(IPC_AUTH_START_OAUTH_FLOW).toBe('auth:start-oauth-flow');
    });

    it('IPC_AUTH_CLEAR_CREDENTIALS has correct value', () => {
      expect(IPC_AUTH_CLEAR_CREDENTIALS).toBe('auth:clear-credentials');
    });

    it('IPC_AUTH_TOKEN_EXPIRED has correct value', () => {
      expect(IPC_AUTH_TOKEN_EXPIRED).toBe('auth:token-expired');
    });

    it('IPC_AUTH_TOKEN_REFRESHED has correct value', () => {
      expect(IPC_AUTH_TOKEN_REFRESHED).toBe('auth:token-refreshed');
    });

    it('IPC_AUTH_CONNECTION_STATUS_CHANGED has correct value', () => {
      expect(IPC_AUTH_CONNECTION_STATUS_CHANGED).toBe('auth:connection-status-changed');
    });
  });

  describe('Proxy channels', () => {
    it('IPC_PROXY_API_REQUEST has correct value', () => {
      expect(IPC_PROXY_API_REQUEST).toBe('proxy:api-request');
    });
  });

  describe('Versions channels', () => {
    it('IPC_VERSIONS_SAVE_SNAPSHOT has correct value', () => {
      expect(IPC_VERSIONS_SAVE_SNAPSHOT).toBe('versions:save-snapshot');
    });

    it('IPC_VERSIONS_LIST has correct value', () => {
      expect(IPC_VERSIONS_LIST).toBe('versions:list');
    });

    it('IPC_VERSIONS_LOAD_CODE has correct value', () => {
      expect(IPC_VERSIONS_LOAD_CODE).toBe('versions:load-code');
    });

    it('IPC_VERSIONS_GET_DIFF has correct value', () => {
      expect(IPC_VERSIONS_GET_DIFF).toBe('versions:get-diff');
    });
  });

  describe('Plugins channels', () => {
    it('IPC_PLUGINS_INSTALL has correct value', () => {
      expect(IPC_PLUGINS_INSTALL).toBe('plugins:install');
    });

    it('IPC_PLUGINS_UNINSTALL has correct value', () => {
      expect(IPC_PLUGINS_UNINSTALL).toBe('plugins:uninstall');
    });

    it('IPC_PLUGINS_LIST has correct value', () => {
      expect(IPC_PLUGINS_LIST).toBe('plugins:list');
    });

    it('IPC_PLUGINS_STATUS_CHANGED has correct value', () => {
      expect(IPC_PLUGINS_STATUS_CHANGED).toBe('plugins:status-changed');
    });
  });

  describe('App channels', () => {
    it('IPC_APP_COMPILE_CODE has correct value', () => {
      expect(IPC_APP_COMPILE_CODE).toBe('app:compile-code');
    });

    it('IPC_APP_VALIDATE_CODE has correct value', () => {
      expect(IPC_APP_VALIDATE_CODE).toBe('app:validate-code');
    });
  });

  describe('Channel naming conventions', () => {
    const allChannels = [
      IPC_CLI_SEND_MESSAGE,
      IPC_CLI_GET_STATUS,
      IPC_CLI_RESTART,
      IPC_CLI_STATUS_CHANGED,
      IPC_CLI_STREAM_RESPONSE,
      IPC_AUTH_CONFIGURE,
      IPC_AUTH_TEST_CONNECTION,
      IPC_AUTH_GET_CONNECTION_STATUS,
      IPC_AUTH_START_OAUTH_FLOW,
      IPC_AUTH_CLEAR_CREDENTIALS,
      IPC_AUTH_TOKEN_EXPIRED,
      IPC_AUTH_TOKEN_REFRESHED,
      IPC_AUTH_CONNECTION_STATUS_CHANGED,
      IPC_PROXY_API_REQUEST,
      IPC_VERSIONS_SAVE_SNAPSHOT,
      IPC_VERSIONS_LIST,
      IPC_VERSIONS_LOAD_CODE,
      IPC_VERSIONS_GET_DIFF,
      IPC_PLUGINS_INSTALL,
      IPC_PLUGINS_UNINSTALL,
      IPC_PLUGINS_LIST,
      IPC_PLUGINS_STATUS_CHANGED,
      IPC_APP_COMPILE_CODE,
      IPC_APP_VALIDATE_CODE,
    ];

    it('all channels follow domain:action naming pattern', () => {
      allChannels.forEach((channel) => {
        expect(channel).toMatch(/^[a-z]+:[a-z-]+$/);
      });
    });

    it('all channels are unique', () => {
      const unique = new Set(allChannels);
      expect(unique.size).toBe(allChannels.length);
    });

    it('all channels are strings', () => {
      allChannels.forEach((channel) => {
        expect(typeof channel).toBe('string');
      });
    });

    it('total channel count is 24', () => {
      expect(allChannels).toHaveLength(24);
    });
  });
});

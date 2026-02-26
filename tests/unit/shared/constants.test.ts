import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CHAT_PANEL_WIDTH,
  MAX_CHAT_PANEL_WIDTH,
  MIN_CHAT_PANEL_WIDTH,
  DEFAULT_CONTENT_PANEL_WIDTH,
  MAX_RESTART_RETRIES,
  CLI_REQUEST_TIMEOUT_MS,
  CLI_GENERATE_TIMEOUT_MS,
  CLI_CUSTOMIZE_TIMEOUT_MS,
  CLI_CHAT_TIMEOUT_MS,
  CLI_INITIALIZE_TIMEOUT_MS,
  CLI_MAX_QUEUE_DEPTH,
  PROXY_REQUEST_TIMEOUT_MS,
  NETWORK_REQUEST_TIMEOUT_MS,
  HEALTH_CHECK_INTERVAL_MS,
  TOKEN_REFRESH_BUFFER_MS,
  MAX_SPEC_SIZE_BYTES,
  SANDBOX_CSP_TEMPLATE,
  DISALLOWED_CODE_PATTERNS,
  HOST_ALLOWED_MESSAGE_TYPES,
  SANDBOX_ALLOWED_MESSAGE_TYPES,
  VERSION_DIFF_LRU_CACHE_SIZE,
  SUPPORTED_SPEC_FORMATS,
  UNSUPPORTED_SPEC_FORMATS,
} from '@shared/constants';

describe('Application Constants', () => {
  describe('Panel layout constants', () => {
    it('DEFAULT_CHAT_PANEL_WIDTH is 30', () => {
      expect(DEFAULT_CHAT_PANEL_WIDTH).toBe(30);
    });

    it('MAX_CHAT_PANEL_WIDTH is 85', () => {
      expect(MAX_CHAT_PANEL_WIDTH).toBe(85);
    });

    it('MIN_CHAT_PANEL_WIDTH is 15', () => {
      expect(MIN_CHAT_PANEL_WIDTH).toBe(15);
    });

    it('DEFAULT_CONTENT_PANEL_WIDTH is 70', () => {
      expect(DEFAULT_CONTENT_PANEL_WIDTH).toBe(70);
    });

    it('chat + content panel widths sum to 100', () => {
      expect(DEFAULT_CHAT_PANEL_WIDTH + DEFAULT_CONTENT_PANEL_WIDTH).toBe(100);
    });

    it('min chat panel width is less than default', () => {
      expect(MIN_CHAT_PANEL_WIDTH).toBeLessThan(DEFAULT_CHAT_PANEL_WIDTH);
    });

    it('max chat panel width is greater than default', () => {
      expect(MAX_CHAT_PANEL_WIDTH).toBeGreaterThan(DEFAULT_CHAT_PANEL_WIDTH);
    });
  });

  describe('CLI subprocess constants', () => {
    it('MAX_RESTART_RETRIES is 5', () => {
      expect(MAX_RESTART_RETRIES).toBe(5);
    });

    it('CLI_REQUEST_TIMEOUT_MS is 30000', () => {
      expect(CLI_REQUEST_TIMEOUT_MS).toBe(30_000);
    });

    it('CLI_GENERATE_TIMEOUT_MS is 60000', () => {
      expect(CLI_GENERATE_TIMEOUT_MS).toBe(60_000);
    });

    it('CLI_CUSTOMIZE_TIMEOUT_MS is 30000', () => {
      expect(CLI_CUSTOMIZE_TIMEOUT_MS).toBe(30_000);
    });

    it('CLI_CHAT_TIMEOUT_MS is 15000', () => {
      expect(CLI_CHAT_TIMEOUT_MS).toBe(15_000);
    });

    it('CLI_INITIALIZE_TIMEOUT_MS is 10000', () => {
      expect(CLI_INITIALIZE_TIMEOUT_MS).toBe(10_000);
    });

    it('CLI_MAX_QUEUE_DEPTH is 100', () => {
      expect(CLI_MAX_QUEUE_DEPTH).toBe(100);
    });
  });

  describe('Network proxy constants', () => {
    it('PROXY_REQUEST_TIMEOUT_MS is 30000', () => {
      expect(PROXY_REQUEST_TIMEOUT_MS).toBe(30_000);
    });

    it('NETWORK_REQUEST_TIMEOUT_MS is 10000', () => {
      expect(NETWORK_REQUEST_TIMEOUT_MS).toBe(10_000);
    });
  });

  describe('Health check constants', () => {
    it('HEALTH_CHECK_INTERVAL_MS is 5 minutes', () => {
      expect(HEALTH_CHECK_INTERVAL_MS).toBe(5 * 60 * 1000);
    });

    it('TOKEN_REFRESH_BUFFER_MS is 1 minute', () => {
      expect(TOKEN_REFRESH_BUFFER_MS).toBe(60_000);
    });
  });

  describe('API spec limits', () => {
    it('MAX_SPEC_SIZE_BYTES is 50MB', () => {
      expect(MAX_SPEC_SIZE_BYTES).toBe(50 * 1024 * 1024);
    });
  });

  describe('SANDBOX_CSP_TEMPLATE', () => {
    it('is a string', () => {
      expect(typeof SANDBOX_CSP_TEMPLATE).toBe('string');
    });

    it('contains nonce placeholder', () => {
      expect(SANDBOX_CSP_TEMPLATE).toContain('{NONCE}');
    });

    it('includes default-src none', () => {
      expect(SANDBOX_CSP_TEMPLATE).toContain("default-src 'none'");
    });

    it('includes script-src with nonce', () => {
      expect(SANDBOX_CSP_TEMPLATE).toContain("script-src 'nonce-{NONCE}'");
    });

    it('includes frame-ancestors none', () => {
      expect(SANDBOX_CSP_TEMPLATE).toContain("frame-ancestors 'none'");
    });
  });

  describe('DISALLOWED_CODE_PATTERNS', () => {
    it('is a readonly array', () => {
      expect(Array.isArray(DISALLOWED_CODE_PATTERNS)).toBe(true);
    });

    it('contains eval pattern', () => {
      const evalPattern = DISALLOWED_CODE_PATTERNS.find((p) => p.pattern === 'eval');
      expect(evalPattern).toBeDefined();
      expect(evalPattern?.severity).toBe('error');
    });

    it('contains document.cookie pattern', () => {
      const cookiePattern = DISALLOWED_CODE_PATTERNS.find((p) => p.pattern === 'document.cookie');
      expect(cookiePattern).toBeDefined();
      expect(cookiePattern?.severity).toBe('error');
    });

    it('contains window.parent pattern', () => {
      const parentPattern = DISALLOWED_CODE_PATTERNS.find((p) => p.pattern === 'window.parent');
      expect(parentPattern).toBeDefined();
      expect(parentPattern?.severity).toBe('error');
    });

    it('contains localStorage pattern with warning severity', () => {
      const localStoragePattern = DISALLOWED_CODE_PATTERNS.find(
        (p) => p.pattern === 'localStorage',
      );
      expect(localStoragePattern).toBeDefined();
      expect(localStoragePattern?.severity).toBe('warning');
    });

    it('each pattern has required fields', () => {
      DISALLOWED_CODE_PATTERNS.forEach((p) => {
        expect(p.pattern).toBeDefined();
        expect(p.regex).toBeInstanceOf(RegExp);
        expect(['error', 'warning']).toContain(p.severity);
        expect(p.description).toBeDefined();
      });
    });

    it('eval regex matches eval()', () => {
      const evalPattern = DISALLOWED_CODE_PATTERNS.find((p) => p.pattern === 'eval');
      const regex = new RegExp(evalPattern!.regex.source, evalPattern!.regex.flags);
      expect(regex.test('eval("code")')).toBe(true);
    });
  });

  describe('Message type allowlists', () => {
    it('HOST_ALLOWED_MESSAGE_TYPES contains READY', () => {
      expect(HOST_ALLOWED_MESSAGE_TYPES).toContain('READY');
    });

    it('HOST_ALLOWED_MESSAGE_TYPES contains NETWORK_REQUEST', () => {
      expect(HOST_ALLOWED_MESSAGE_TYPES).toContain('NETWORK_REQUEST');
    });

    it('SANDBOX_ALLOWED_MESSAGE_TYPES contains INIT', () => {
      expect(SANDBOX_ALLOWED_MESSAGE_TYPES).toContain('INIT');
    });

    it('SANDBOX_ALLOWED_MESSAGE_TYPES contains RENDER_DATA', () => {
      expect(SANDBOX_ALLOWED_MESSAGE_TYPES).toContain('RENDER_DATA');
    });

    it('HOST_ALLOWED_MESSAGE_TYPES has 6 entries', () => {
      expect(HOST_ALLOWED_MESSAGE_TYPES).toHaveLength(6);
    });

    it('SANDBOX_ALLOWED_MESSAGE_TYPES has 6 entries', () => {
      expect(SANDBOX_ALLOWED_MESSAGE_TYPES).toHaveLength(6);
    });
  });

  describe('Version history constants', () => {
    it('VERSION_DIFF_LRU_CACHE_SIZE is 20', () => {
      expect(VERSION_DIFF_LRU_CACHE_SIZE).toBe(20);
    });
  });

  describe('Spec format constants', () => {
    it('SUPPORTED_SPEC_FORMATS contains openapi3, swagger2, graphql', () => {
      expect(SUPPORTED_SPEC_FORMATS).toContain('openapi3');
      expect(SUPPORTED_SPEC_FORMATS).toContain('swagger2');
      expect(SUPPORTED_SPEC_FORMATS).toContain('graphql');
    });

    it('UNSUPPORTED_SPEC_FORMATS contains raml, wsdl, asyncapi', () => {
      expect(UNSUPPORTED_SPEC_FORMATS).toContain('raml');
      expect(UNSUPPORTED_SPEC_FORMATS).toContain('wsdl');
      expect(UNSUPPORTED_SPEC_FORMATS).toContain('asyncapi');
    });
  });
});

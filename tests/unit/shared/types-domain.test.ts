import { describe, it, expect } from 'vitest';
import type {
  Tab,
  ChatMessage,
  MessageAttachment,
  CustomizationRequest,
  ConsoleEntry,
  ConsoleRequest,
  ConsoleResponse,
  APIConnection,
  Plugin,
  ApplicationState,
} from '@shared/types';

describe('Shared Types - Domain Models', () => {
  describe('Tab', () => {
    it('has correct shape with nullable fields', () => {
      const tab: Tab = {
        id: 'tab-1',
        title: 'My API',
        displayOrder: 0,
        isActive: true,
        apiSpec: null,
        generatedInterface: null,
        connectionId: null,
        chatHistory: [],
        customizationQueue: [],
        createdAt: new Date().toISOString(),
      };
      expect(tab.id).toBe('tab-1');
      expect(tab.apiSpec).toBeNull();
    });
  });

  describe('ChatMessage', () => {
    it('has correct role and status values', () => {
      const msg: ChatMessage = {
        id: 'msg-1',
        tabId: 'tab-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date().toISOString(),
        status: 'sent',
        relatedVersionId: null,
      };
      expect(msg.role).toBe('user');
      expect(msg.status).toBe('sent');
    });

    it('accepts all role values', () => {
      const roles: ChatMessage['role'][] = ['user', 'assistant', 'system'];
      expect(roles).toHaveLength(3);
    });

    it('accepts all status values', () => {
      const statuses: ChatMessage['status'][] = ['sent', 'pending', 'queued', 'error'];
      expect(statuses).toHaveLength(4);
    });
  });

  describe('MessageAttachment', () => {
    it('has correct type values', () => {
      const attachment: MessageAttachment = {
        type: 'spec-file',
        name: 'api.json',
        content: '{}',
        mimeType: 'application/json',
      };
      expect(attachment.type).toBe('spec-file');
    });

    it('accepts all attachment types', () => {
      const types: MessageAttachment['type'][] = ['spec-file', 'image', 'code-snippet'];
      expect(types).toHaveLength(3);
    });
  });

  describe('CustomizationRequest', () => {
    it('has correct status values', () => {
      const request: CustomizationRequest = {
        id: 'req-1',
        tabId: 'tab-1',
        prompt: 'Add a dark mode toggle',
        status: 'queued',
        chatMessageId: 'msg-1',
        resultVersionId: null,
        errorMessage: null,
        queuedAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
      };
      expect(request.status).toBe('queued');
    });

    it('accepts all status values', () => {
      const statuses: CustomizationRequest['status'][] = [
        'queued', 'in-progress', 'completed', 'failed',
      ];
      expect(statuses).toHaveLength(4);
    });
  });

  describe('ConsoleEntry', () => {
    it('has correct structure', () => {
      const request: ConsoleRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: { 'Content-Type': 'application/json' },
      };
      const entry: ConsoleEntry = {
        id: 'entry-1',
        tabId: 'tab-1',
        timestamp: new Date().toISOString(),
        request,
        response: null,
        elapsedMs: null,
        status: 'pending',
      };
      expect(entry.status).toBe('pending');
    });

    it('accepts completed status with response', () => {
      const response: ConsoleResponse = {
        statusCode: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: '{"data": []}',
        bodySize: 12,
      };
      expect(response.statusCode).toBe(200);
    });
  });

  describe('APIConnection', () => {
    it('has correct shape', () => {
      const conn: APIConnection = {
        id: 'conn-1',
        baseUrl: 'https://api.example.com',
        authMethod: { type: 'none' },
        status: 'disconnected',
        lastVerifiedAt: null,
        responseTimeMs: null,
        tabIds: [],
      };
      expect(conn.id).toBe('conn-1');
    });
  });

  describe('Plugin', () => {
    it('has correct type values', () => {
      const types: Plugin['type'][] = ['mcp-server', 'transformer', 'integration'];
      expect(types).toHaveLength(3);
    });

    it('has correct status values', () => {
      const statuses: Plugin['status'][] = ['installed', 'installing', 'error', 'uninstalling'];
      expect(statuses).toHaveLength(4);
    });
  });

  describe('ApplicationState', () => {
    it('has correct theme type', () => {
      const themes: ApplicationState['theme'][] = ['light', 'dark'];
      expect(themes).toHaveLength(2);
    });
  });
});

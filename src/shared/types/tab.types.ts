import type { APISpec } from './api-spec.types';
import type { GeneratedInterface } from './interface.types';

export interface MessageAttachment {
  type: 'spec-file' | 'image' | 'code-snippet';
  name: string;
  content: string;
  mimeType: string;
}

export interface ChatMessage {
  id: string;
  tabId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  status: 'sent' | 'pending' | 'queued' | 'error';
  attachments?: MessageAttachment[];
  relatedVersionId: string | null;
}

export interface CustomizationRequest {
  id: string;
  tabId: string;
  prompt: string;
  status: 'queued' | 'in-progress' | 'completed' | 'failed';
  chatMessageId: string;
  resultVersionId: string | null;
  errorMessage: string | null;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface Tab {
  id: string;
  title: string;
  displayOrder: number;
  isActive: boolean;
  apiSpec: APISpec | null;
  generatedInterface: GeneratedInterface | null;
  connectionId: string | null;
  chatHistory: ChatMessage[];
  customizationQueue: CustomizationRequest[];
  createdAt: string;
}

import { SANDBOX_ALLOWED_MESSAGE_TYPES } from '../shared/constants';
import type { SandboxAllowedMessageType } from '../shared/constants';

type MessageHandler = (data: Record<string, unknown>) => void;

export interface NetworkRequestPayload {
  requestId: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface BridgeOptions {
  postMessage: (message: Record<string, unknown>) => void;
}

export interface SandboxBridge {
  handleMessage(event: MessageEvent): void;
  on(type: SandboxAllowedMessageType, handler: MessageHandler): void;
  getNonce(): string | null;
  sendNetworkRequest(payload: NetworkRequestPayload): void;
}

export function createBridge(options: BridgeOptions): SandboxBridge {
  let currentNonce: string | null = null;
  const handlers = new Map<SandboxAllowedMessageType, MessageHandler[]>();

  function isAllowedType(type: unknown): type is SandboxAllowedMessageType {
    return (
      typeof type === 'string' &&
      (SANDBOX_ALLOWED_MESSAGE_TYPES as ReadonlyArray<string>).includes(type)
    );
  }

  function handleMessage(event: MessageEvent): void {
    const data = event.data as Record<string, unknown>;
    if (typeof data !== 'object' || data === null) return;

    const type = data['type'];
    const nonce = data['nonce'];

    // Handle INIT specially — it establishes the nonce
    if (type === 'INIT') {
      currentNonce = typeof nonce === 'string' ? nonce : null;
      options.postMessage({ type: 'READY', nonce: currentNonce });
      return;
    }

    // Only process SANDBOX_ALLOWED_MESSAGE_TYPES
    if (!isAllowedType(type)) return;

    // Require nonce to be set (INIT received) and match
    if (currentNonce === null || nonce !== currentNonce) return;

    const typeHandlers = handlers.get(type);
    if (typeHandlers) {
      typeHandlers.forEach((h) => h(data));
    }
  }

  function on(type: SandboxAllowedMessageType, handler: MessageHandler): void {
    const existing = handlers.get(type) ?? [];
    handlers.set(type, [...existing, handler]);
  }

  function getNonce(): string | null {
    return currentNonce;
  }

  function sendNetworkRequest(payload: NetworkRequestPayload): void {
    options.postMessage({
      type: 'NETWORK_REQUEST',
      nonce: currentNonce,
      ...payload,
    });
  }

  return { handleMessage, on, getNonce, sendNetworkRequest };
}

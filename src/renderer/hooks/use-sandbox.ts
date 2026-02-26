import { useState, useCallback, useRef, useEffect } from 'react';
import type { SandboxAllowedMessageType } from '../../shared/constants';

interface SandboxMessage {
  type: string;
  nonce: string;
  [key: string]: unknown;
}

type MessageHandler = (data: SandboxMessage) => void;

interface UseSandboxReturn {
  sendToSandbox: (message: Record<string, unknown>) => void;
  onSandboxMessage: (type: SandboxAllowedMessageType, handler: MessageHandler) => () => void;
  nonce: string | null;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

export function useSandbox(): UseSandboxReturn {
  const [nonce, setNonce] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const handlersRef = useRef<Map<string, MessageHandler[]>>(new Map());

  const generateNonce = useCallback((): string => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }, []);

  useEffect(() => {
    const newNonce = generateNonce();
    setNonce(newNonce);
  }, [generateNonce]);

  useEffect(() => {
    function handleWindowMessage(event: MessageEvent): void {
      const data = event.data as SandboxMessage;
      if (!data || typeof data.type !== 'string') return;
      if (data.nonce !== nonce) return;

      if (data.type === 'READY') {
        setIsLoading(false);
      }

      if (data.type === 'ERROR') {
        setIsError(true);
        setErrorMessage((data['payload'] as { message?: string })?.message ?? 'Sandbox error');
      }

      const handlers = handlersRef.current.get(data.type) ?? [];
      handlers.forEach((h) => h(data));
    }

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [nonce]);

  const sendToSandbox = useCallback(
    (message: Record<string, unknown>): void => {
      iframeRef.current?.contentWindow?.postMessage({ ...message, nonce }, '*');
    },
    [nonce],
  );

  const onSandboxMessage = useCallback(
    (type: SandboxAllowedMessageType, handler: MessageHandler): (() => void) => {
      const existing = handlersRef.current.get(type) ?? [];
      handlersRef.current.set(type, [...existing, handler]);
      return () => {
        const current = handlersRef.current.get(type) ?? [];
        handlersRef.current.set(
          type,
          current.filter((h) => h !== handler),
        );
      };
    },
    [],
  );

  return { sendToSandbox, onSandboxMessage, nonce, isLoading, isError, errorMessage, iframeRef };
}

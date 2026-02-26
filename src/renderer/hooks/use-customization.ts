// src/renderer/hooks/use-customization.ts
// Helper hook for the customization pipeline (T063).
// Encapsulates queue management, CLI calls, and clarification state.

import { useCallback, useState } from 'react';

import type { CustomizeResult } from './use-cli';
import { customizationQueue } from '../services/customization-queue';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClarificationState {
  question: string;
  options: string[];
  onSelect: (option: string) => void;
}

interface CustomizeFn {
  (params: {
    tabId: string;
    prompt: string;
    currentCode: string;
    specContext: string;
    chatHistory: Array<{ role: string; content: string }>;
    onChunk?: (chunk: string, done: boolean) => void;
  }): Promise<CustomizeResult>;
}

interface UseCustomizationReturn {
  isCustomizing: boolean;
  queueDepth: number;
  clarification: ClarificationState | null;
  runCustomization(
    tabId: string,
    prompt: string,
    currentCode: string,
    specContext: string,
    chatHistory: Array<{ role: string; content: string }>,
    customize: CustomizeFn,
    onSuccess: (newCode: string) => void,
    onError: (msg: string) => void,
  ): Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCustomization(): UseCustomizationReturn {
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [queueDepth, setQueueDepth] = useState(0);
  const [clarification, setClarification] = useState<ClarificationState | null>(null);

  const runCustomization = useCallback(
    async (
      tabId: string,
      prompt: string,
      currentCode: string,
      specContext: string,
      chatHistory: Array<{ role: string; content: string }>,
      customize: CustomizeFn,
      onSuccess: (newCode: string) => void,
      onError: (msg: string) => void,
    ): Promise<void> => {
      let requestId: string;
      try {
        requestId = customizationQueue.enqueue(tabId, prompt, currentCode);
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
        return;
      }

      setQueueDepth(customizationQueue.getQueue(tabId).filter((r) => r.status === 'queued').length);

      // Wait for our turn (sequential constraint)
      while (customizationQueue.getNext(tabId)?.id !== requestId) {
        await new Promise<void>((res) => setTimeout(res, 50));
      }

      customizationQueue.markInProgress(requestId);
      setIsCustomizing(true);
      setQueueDepth(customizationQueue.getQueue(tabId).filter((r) => r.status === 'queued').length);

      const doCustomize = async (effectivePrompt: string): Promise<void> => {
        let awaitingUserInput = false;
        try {
          const result = await customize({
            tabId,
            prompt: effectivePrompt,
            currentCode,
            specContext,
            chatHistory,
          });

          if (result.clarificationNeeded && result.question) {
            awaitingUserInput = true;
            setClarification({
              question: result.question,
              options: result.options ?? [],
              onSelect: (option) => {
                setClarification(null);
                setIsCustomizing(true);
                void doCustomize(`${effectivePrompt}\nUser selected: ${option}`);
              },
            });
            return;
          }

          if (result.code) {
            customizationQueue.complete(requestId, result.code);
            onSuccess(result.code);
          } else {
            customizationQueue.fail(requestId, 'No code returned');
            onError('Customization returned no code');
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          customizationQueue.fail(requestId, msg);
          onError(msg);
        } finally {
          setIsCustomizing(false);
          setQueueDepth(0);
          if (!awaitingUserInput) setClarification(null);
        }
      };

      await doCustomize(prompt);
    },
    [],
  );

  return { isCustomizing, queueDepth, clarification, runCustomization };
}

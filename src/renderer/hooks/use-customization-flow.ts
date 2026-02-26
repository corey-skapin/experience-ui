/**
 * useCustomizationFlow hook.
 * Wires the full customization pipeline:
 *   chat input → queue request → CLI customize → compile → validate
 *   → update sandbox → update chat with confirmation.
 * Handles clarification responses (FR-012) and failure recovery.
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { useTabStore } from '../stores/tab-store'
import { useCli } from './use-cli'
import { customizationQueue } from '../services/customization-queue'
import type { CustomizationRequest } from '../../shared/types'
import type { CustomizationQueueResult } from '../services/customization-queue'
import type { PendingClarification } from '../components/chat/ChatPanel'

// ─── Types ────────────────────────────────────────────────────────────────

interface LastProcessParams {
  tabId: string
  originalPrompt: string
}

export interface UseCustomizationFlowReturn {
  pendingClarification: PendingClarification | null
  handleCustomizationMessage: (prompt: string) => Promise<void>
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useCustomizationFlow(compiledCode: string | null): UseCustomizationFlowReturn {
  const { customize } = useCli()
  const [pendingClarification, setPendingClarification] = useState<PendingClarification | null>(
    null,
  )

  // Refs for latest values — avoids stale closures in async callbacks
  const compiledCodeRef = useRef(compiledCode)
  const customizeRef = useRef(customize)
  const lastProcessParamsRef = useRef<LastProcessParams | null>(null)

  useEffect(() => {
    compiledCodeRef.current = compiledCode
  }, [compiledCode])

  useEffect(() => {
    customizeRef.current = customize
  }, [customize])

  // ── Processor factory ────────────────────────────────────────────────

  const buildProcessor = useCallback(
    () =>
      async (request: CustomizationRequest): Promise<CustomizationQueueResult> => {
        const store = useTabStore.getState()
        store.updateCustomization(request.id, {
          status: 'in-progress',
          startedAt: Date.now(),
        })

        const currentCode = compiledCodeRef.current ?? ''
        const specContext = store.tab.apiSpec?.normalizedSpec ?? null
        const chatHistory = store.tab.chatHistory

        const result = await customizeRef.current(
          request.tabId,
          request.prompt,
          currentCode,
          specContext,
          chatHistory,
        )

        if (!result.success) {
          store.updateCustomization(request.id, {
            status: 'failed',
            errorMessage: result.error,
            completedAt: Date.now(),
          })
          store.addChatMessage('assistant', `❌ Customization failed: ${result.error}`)
          return { success: false, error: result.error }
        }

        if (result.clarificationNeeded) {
          // Save context so the caller can re-submit after user responds
          lastProcessParamsRef.current = {
            tabId: request.tabId,
            originalPrompt: request.prompt,
          }
          store.updateCustomization(request.id, {
            status: 'completed',
            completedAt: Date.now(),
          })
          return {
            success: true,
            clarificationNeeded: true,
            question: result.question,
            options: result.options,
          }
        }

        // ── Compile + validate ──────────────────────────────────────────
        const bridge = window.experienceUI
        if (bridge?.app?.compileCode) {
          const compileResult = await bridge.app.compileCode({
            sourceCode: result.code,
            format: 'iife',
            target: 'es2020',
            minify: false,
          })
          if (compileResult.success && bridge.app.validateCode) {
            await bridge.app.validateCode({ code: result.code }).catch(() => null)
          }
        }

        // ── Update store ────────────────────────────────────────────────
        store.updateCustomization(request.id, {
          status: 'completed',
          completedAt: Date.now(),
        })

        const assumptionsLine = result.assumptions?.length
          ? `\n_Assumptions_: ${result.assumptions.join('; ')}`
          : ''
        store.addChatMessage('assistant', `✅ ${result.description}${assumptionsLine}`)

        return { success: true, code: result.code }
      },
    [],
  )

  // ── Public entrypoint ────────────────────────────────────────────────

  const handleCustomizationMessage = useCallback(
    async (prompt: string): Promise<void> => {
      const store = useTabStore.getState()
      const chatMsgId = store.addChatMessage('user', prompt)

      const request: CustomizationRequest = {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tabId: store.tab.id,
        prompt,
        status: 'queued',
        chatMessageId: chatMsgId,
        resultVersionId: null,
        errorMessage: null,
        queuedAt: Date.now(),
        startedAt: null,
        completedAt: null,
      }

      store.enqueueCustomization(request)
      const queueResult = await customizationQueue.enqueue(request, buildProcessor())

      // Handle clarification: show options to user, re-send on selection
      if (queueResult.success && queueResult.clarificationNeeded) {
        const capturedPrompt = prompt
        const handleSelect = (option: string): void => {
          setPendingClarification(null)
          void handleCustomizationMessage(`${capturedPrompt}\nUser clarification: ${option}`)
        }
        setPendingClarification({
          question: queueResult.question ?? '',
          options: queueResult.options ?? [],
          onSelect: handleSelect,
        })
      }
    },
    [buildProcessor],
  )

  return { pendingClarification, handleCustomizationMessage }
}

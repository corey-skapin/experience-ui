/**
 * useCli hook.
 * Abstracts CLI IPC calls: sendMessage, getStatus, restart, customize.
 * Handles streaming responses via cli:stream-response listener.
 * Exposes loading and error states.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  CLIStatusResponse,
  CLISendMessageResponse,
  CLIStreamResponseEvent,
} from '../../shared/types/ipc'
import type { NormalizedSpec, ChatMessage } from '../../shared/types'

// ─── Types ────────────────────────────────────────────────────────────────

export interface SendMessageOptions {
  context?: {
    tabId: string
    activeSpecId?: string
    activeVersionId?: string
  }
  onChunk?: (chunk: string, requestId: string) => void
}

export interface CLIHookState {
  status: CLIStatusResponse['status']
  pid: number | null
  restartCount: number
  pendingRequests: number
  isLoading: boolean
  error: string | null
}

// ─── Customize result types ───────────────────────────────────────────────

interface CustomizeSuccess {
  success: true
  clarificationNeeded: false
  code: string
  description: string
  assumptions: string[]
  requestId: string
}

interface CustomizeClarification {
  success: true
  clarificationNeeded: true
  question: string
  options: string[]
  requestId: string
}

interface CustomizeFailure {
  success: false
  error: string
  requestId: string
}

export type CustomizeResult = CustomizeSuccess | CustomizeClarification | CustomizeFailure

export interface UseCliReturn extends CLIHookState {
  sendMessage: (message: string, options?: SendMessageOptions) => Promise<CLISendMessageResponse>
  getStatus: () => Promise<CLIStatusResponse>
  restart: () => Promise<{ success: boolean; error?: string }>
  customize: (
    tabId: string,
    prompt: string,
    currentCode: string,
    specContext: NormalizedSpec | null,
    chatHistory: ChatMessage[],
    options?: { onChunk?: (chunk: string, requestId: string) => void },
  ) => Promise<CustomizeResult>
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useCli(): UseCliReturn {
  const [state, setState] = useState<CLIHookState>({
    status: 'stopped',
    pid: null,
    restartCount: 0,
    pendingRequests: 0,
    isLoading: false,
    error: null,
  })

  const chunkListenersRef = useRef<Map<string, (chunk: string) => void>>(new Map())

  // Subscribe to status-changed push notifications
  useEffect(() => {
    const bridge = window.experienceUI
    if (!bridge?.cli?.onStatusChanged) return

    const unsubscribe = bridge.cli.onStatusChanged((event: CLIStatusResponse) => {
      setState((prev) => ({
        ...prev,
        status: event.status,
        pid: event.pid,
        restartCount: event.restartCount,
        pendingRequests: event.pendingRequests,
      }))
    })

    // Load initial status
    void bridge.cli.getStatus().then((status: CLIStatusResponse) => {
      setState((prev) => ({
        ...prev,
        status: status.status,
        pid: status.pid,
        restartCount: status.restartCount,
        pendingRequests: status.pendingRequests,
      }))
    })

    return unsubscribe
  }, [])

  // Subscribe to streaming responses
  useEffect(() => {
    const bridge = window.experienceUI
    if (!bridge?.cli?.onStreamResponse) return

    const unsubscribe = bridge.cli.onStreamResponse((event: CLIStreamResponseEvent) => {
      const listener = chunkListenersRef.current.get(event.requestId)
      if (listener) {
        listener(event.chunk)
        if (event.done) {
          chunkListenersRef.current.delete(event.requestId)
        }
      }
    })

    return unsubscribe
  }, [])

  const sendMessage = useCallback(
    async (message: string, options: SendMessageOptions = {}): Promise<CLISendMessageResponse> => {
      const bridge = window.experienceUI
      if (!bridge?.cli?.sendMessage) {
        throw new Error('CLI bridge not available')
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      try {
        const response = await bridge.cli.sendMessage({
          message,
          context: options.context,
        })

        if (options.onChunk && response.requestId) {
          const onChunkFn = options.onChunk
          chunkListenersRef.current.set(response.requestId, (chunk) => {
            onChunkFn(chunk, response.requestId)
          })
        }

        if (!response.success) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: response.error ?? 'Unknown error',
          }))
        } else {
          setState((prev) => ({ ...prev, isLoading: false }))
        }

        return response
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        setState((prev) => ({ ...prev, isLoading: false, error: errMsg }))
        throw err
      }
    },
    [],
  )

  const getStatus = useCallback(async (): Promise<CLIStatusResponse> => {
    const bridge = window.experienceUI
    if (!bridge?.cli?.getStatus) throw new Error('CLI bridge not available')
    return bridge.cli.getStatus()
  }, [])

  const restart = useCallback(async () => {
    const bridge = window.experienceUI
    if (!bridge?.cli?.restart) throw new Error('CLI bridge not available')
    setState((prev) => ({ ...prev, error: null }))
    return bridge.cli.restart()
  }, [])

  const customize = useCallback(
    async (
      tabId: string,
      prompt: string,
      currentCode: string,
      specContext: NormalizedSpec | null,
      chatHistory: ChatMessage[],
      options: { onChunk?: (chunk: string, requestId: string) => void } = {},
    ): Promise<CustomizeResult> => {
      const cliRequest = {
        jsonrpc: '2.0',
        method: 'customize',
        params: {
          currentCode,
          prompt,
          spec: specContext,
          history: chatHistory.map((m) => ({ role: m.role, content: m.content })),
        },
      }

      const response = await sendMessage(JSON.stringify(cliRequest), {
        context: { tabId },
        onChunk: options.onChunk,
      })

      if (!response.success || !response.response) {
        return {
          success: false,
          error: response.error ?? 'Customize request failed with no response',
          requestId: response.requestId,
        }
      }

      try {
        const result = JSON.parse(response.response) as {
          code?: string | null
          description?: string
          assumptions?: string[]
          clarificationNeeded?: boolean
          question?: string
          options?: string[]
        }

        if (result.clarificationNeeded) {
          return {
            success: true,
            clarificationNeeded: true,
            question: result.question ?? '',
            options: result.options ?? [],
            requestId: response.requestId,
          }
        }

        return {
          success: true,
          clarificationNeeded: false,
          code: result.code ?? '',
          description: result.description ?? '',
          assumptions: result.assumptions ?? [],
          requestId: response.requestId,
        }
      } catch {
        return {
          success: false,
          error: 'Invalid JSON response from CLI',
          requestId: response.requestId,
        }
      }
    },
    [sendMessage],
  )

  return { ...state, sendMessage, getStatus, restart, customize }
}

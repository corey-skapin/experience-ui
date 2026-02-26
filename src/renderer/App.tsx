/**
 * Top-level App shell component.
 * Implements split-pane layout (30% chat / 70% content) using react-resizable-panels.
 * Wires the end-to-end flow: spec ingestion → parse → generate → compile → sandbox render,
 * and the customization pipeline: chat → queue → CLI customize → sandbox update.
 */
import { useEffect, useState, useCallback, type ReactElement } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useAppStore } from './stores/app-store'
import { useTabStore } from './stores/tab-store'
import { subscribeCLIStatusUpdates } from './stores/cli-store'
import { ChatPanel } from './components/chat/ChatPanel'
import { SandboxHost } from './components/sandbox/SandboxHost'
import { ProgressBar } from './components/common/ProgressBar'
import { parseSpec } from './services/spec-parser'
import { generateInterface } from './services/code-generator'
import { useCustomizationFlow } from './hooks/use-customization-flow'
import { LAYOUT } from '../shared/constants'
import type { APISpec, MessageAttachment } from '../shared/types'

interface UploadedFile {
  name: string
  content: string
  mimeType: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function getFileType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'json') return 'json'
  if (ext === 'yaml' || ext === 'yml') return 'yaml'
  if (ext === 'graphql' || ext === 'gql') return 'graphql'
  return ext
}

// ─── Component ────────────────────────────────────────────────────────────

export default function App(): ReactElement {
  const theme = useAppStore((s) => s.theme)
  const {
    tab,
    addChatMessage,
    updateChatMessage,
    setApiSpec,
    setTabStatus,
    setGeneratedInterface,
  } = useTabStore()

  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationStage, setGenerationStage] = useState<string | undefined>()
  const [compiledCode, setCompiledCode] = useState<string | null>(null)

  const { pendingClarification, handleCustomizationMessage } = useCustomizationFlow(compiledCode)

  // Apply theme class to document root
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Subscribe to CLI status notifications
  useEffect(() => {
    return subscribeCLIStatusUpdates()
  }, [])

  // ── Spec ingestion pipeline ────────────────────────────────────────────

  const handleSpecContent = useCallback(
    async (content: string, fileType: string, sourceName?: string) => {
      const msgId = addChatMessage(
        'system',
        `Parsing API spec${sourceName ? `: ${sourceName}` : ''}...`,
        { status: 'pending' },
      )

      setTabStatus('spec-loaded')
      setGenerationProgress(10)
      setGenerationStage('Parsing specification...')

      const parseResult = await parseSpec(content, fileType)

      if (!parseResult.success) {
        updateChatMessage(msgId, {
          content: `❌ **Parse error**: ${parseResult.error.message}`,
          status: 'error',
        })
        setTabStatus('error')
        setGenerationProgress(0)
        return
      }

      const spec = parseResult.data

      // Build APISpec
      const apiSpec: APISpec = {
        id: `spec-${Date.now()}`,
        format: spec.format,
        source: { type: 'text' },
        rawContent: content,
        normalizedSpec: spec,
        validationStatus: 'valid',
        metadata: spec.metadata,
        parsedAt: Date.now(),
      }
      setApiSpec(apiSpec)

      updateChatMessage(msgId, {
        content: `✅ Parsed **${spec.metadata.title}** (${spec.format}). Found ${spec.endpoints?.length ?? 0} endpoint${spec.endpoints?.length === 1 ? '' : 's'}.`,
        status: 'sent',
      })

      // ── Code generation ─────────────────────────────────────────────────

      setIsGenerating(true)
      setGenerationProgress(30)
      setGenerationStage('Generating interface...')
      setTabStatus('generating')

      const genMsgId = addChatMessage('assistant', '⚙️ Generating interface...', {
        status: 'pending',
      })

      const genResult = await generateInterface(spec, { theme }, (progress) => {
        setGenerationStage(progress.message)
        if (progress.stage === 'generating') setGenerationProgress(50)
        else if (progress.stage === 'validating') setGenerationProgress(75)
        else if (progress.stage === 'compiling') setGenerationProgress(90)
      })

      setIsGenerating(false)
      setGenerationProgress(0)

      if (!genResult.success) {
        updateChatMessage(genMsgId, {
          content: `❌ Generation failed (${genResult.stage}): ${genResult.error}`,
          status: 'error',
        })
        setTabStatus('error')
        return
      }

      setCompiledCode(genResult.compiledCode)

      const iface = {
        id: `iface-${Date.now()}`,
        tabId: tab.id,
        apiSpecId: apiSpec.id,
        currentVersionId: 'v1',
        versions: [],
        sandboxState: { status: 'loading' as const, progress: 0 },
        compiledBundle: genResult.compiledCode,
        theme,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setGeneratedInterface(iface)
      setTabStatus('interface-ready')

      updateChatMessage(genMsgId, {
        content: `✅ Interface generated! ${genResult.description}`,
        status: 'sent',
      })
    },
    [
      addChatMessage,
      updateChatMessage,
      setApiSpec,
      setTabStatus,
      setGeneratedInterface,
      tab.id,
      theme,
    ],
  )

  // ── Message send handler ───────────────────────────────────────────────

  const handleSendMessage = useCallback(
    async (content: string, file?: UploadedFile) => {
      if (file) {
        const attachment: MessageAttachment = {
          type: 'spec-file',
          name: file.name,
          content: file.content,
          mimeType: file.mimeType,
        }
        addChatMessage('user', content || `Uploaded: ${file.name}`, { attachments: [attachment] })
        await handleSpecContent(file.content, getFileType(file.name), file.name)
        return
      }

      const trimmed = content.trim()
      if (!trimmed) return

      // URL detection
      if (/^https?:\/\//.test(trimmed)) {
        addChatMessage('user', trimmed)
        const msgId = addChatMessage('system', `Fetching spec from ${trimmed}...`, {
          status: 'pending',
        })
        try {
          const res = await fetch(trimmed)
          const text = await res.text()
          updateChatMessage(msgId, { content: `Fetched spec from URL`, status: 'sent' })
          await handleSpecContent(text, trimmed.endsWith('.graphql') ? 'graphql' : 'json', trimmed)
        } catch (err) {
          updateChatMessage(msgId, {
            content: `❌ Failed to fetch: ${err instanceof Error ? err.message : String(err)}`,
            status: 'error',
          })
        }
        return
      }

      // Try to detect if it's a spec (JSON/YAML content)
      const looksLikeSpec =
        trimmed.startsWith('{') ||
        trimmed.startsWith('---') ||
        trimmed.includes('openapi') ||
        trimmed.includes('swagger') ||
        trimmed.includes('type Query')
      if (looksLikeSpec) {
        addChatMessage('user', 'Pasted spec content')
        await handleSpecContent(trimmed, 'json')
        return
      }

      // If an interface is already generated, treat as a customization request
      if (tab.status === 'interface-ready' || tab.generatedInterface) {
        await handleCustomizationMessage(trimmed)
        return
      }

      // Generic chat message
      addChatMessage('user', trimmed)
      addChatMessage(
        'assistant',
        'I can help you generate and customize API interfaces. Please provide an API spec via file upload, URL, or paste the spec content directly.',
        { status: 'sent' },
      )
    },
    [
      addChatMessage,
      updateChatMessage,
      handleSpecContent,
      handleCustomizationMessage,
      tab.status,
      tab.generatedInterface,
    ],
  )

  return (
    <div className="app-root h-screen overflow-hidden" data-theme={theme}>
      {/* Generation progress bar */}
      {isGenerating && generationProgress > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <ProgressBar value={generationProgress} />
        </div>
      )}

      <PanelGroup direction="horizontal" className="h-full">
        {/* Chat panel */}
        <Panel
          defaultSize={LAYOUT.DEFAULT_CHAT_PANEL_RATIO}
          minSize={LAYOUT.MIN_CHAT_PANEL_WIDTH_PERCENT}
          maxSize={LAYOUT.MAX_CHAT_PANEL_WIDTH_PERCENT}
          className="flex flex-col"
        >
          <ChatPanel
            messages={tab.chatHistory}
            onSendMessage={handleSendMessage}
            isGenerating={isGenerating}
            generationProgress={generationProgress}
            generationStage={generationStage}
            queueDepth={tab.customizationQueue.filter((r) => r.status === 'queued').length}
            pendingClarification={pendingClarification}
          />
        </Panel>

        {/* Resize handle */}
        <PanelResizeHandle className="w-1 bg-[var(--color-border)] hover:bg-[var(--color-accent)] transition-colors cursor-col-resize" />

        {/* Content / sandbox panel */}
        <Panel className="flex flex-col">
          <SandboxHost
            bundledCode={compiledCode}
            theme={theme}
            className="flex-1"
            onRenderComplete={(count) => {
              addChatMessage(
                'system',
                `Interface rendered (${count} component${count === 1 ? '' : 's'})`,
              )
            }}
            onError={(message, isFatal) => {
              addChatMessage('system', `⚠️ Sandbox error: ${message}${isFatal ? ' (fatal)' : ''}`)
              if (isFatal) setTabStatus('error')
            }}
          />
        </Panel>
      </PanelGroup>
    </div>
  )
}

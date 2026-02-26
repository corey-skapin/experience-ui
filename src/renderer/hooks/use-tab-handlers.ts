// src/renderer/hooks/use-tab-handlers.ts
// T083 — Extracted handler logic for the active tab in App.tsx.
// Keeps App.tsx under 300 lines by encapsulating spec-load and customization callbacks.

import { useCallback, useState } from 'react';

import type { ChatMessage, Tab } from '../../shared/types';
import { useTabStore } from '../stores/tab-store';
import { detectFormat, parseSpec } from '../services/spec-parser/spec-parser';
import { generateInterface } from '../services/code-generator';
import { useCli } from './use-cli';
import { useCustomization } from './use-customization';
import { useVersions } from './use-versions';

// ─── Return Type ──────────────────────────────────────────────────────────────

export interface UseTabHandlersReturn {
  compiledCode: string | null;
  rawCode: string | null;
  progress: number;
  progressLabel: string;
  sandboxError: string | null;
  isProcessing: boolean;
  showVersions: boolean;
  setShowVersions: (v: boolean | ((prev: boolean) => boolean)) => void;
  setSandboxError: (e: string | null) => void;
  cli: ReturnType<typeof useCli>;
  customization: ReturnType<typeof useCustomization>;
  versions: ReturnType<typeof useVersions>;
  handleSend(text: string, attachment?: File): Promise<void>;
  handleRollback(versionId: string): Promise<void>;
  applyCode(newRawCode: string): Promise<boolean>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTabHandlers(tab: Tab | undefined): UseTabHandlersReturn {
  const { loadSpec, startGenerating, finishGenerating, addChatMessage } = useTabStore.getState();

  const [compiledCode, setCompiledCode] = useState<string | null>(null);
  const [rawCode, setRawCode] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  const tabId = tab?.id ?? '';
  const cli = useCli();
  const customization = useCustomization();
  const versions = useVersions(tabId, tabId);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const appendMessage = useCallback(
    (role: ChatMessage['role'], content: string, status: ChatMessage['status'] = 'sent') => {
      if (!tab) return '';
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        tabId: tab.id,
        role,
        content,
        timestamp: new Date().toISOString(),
        status,
        relatedVersionId: null,
      };
      addChatMessage(tab.id, msg);
      return msg.id;
    },
    [tab, addChatMessage],
  );

  // ── applyCode ─────────────────────────────────────────────────────────────

  const applyCode = useCallback(
    async (newRawCode: string): Promise<boolean> => {
      const compileResult = await window.experienceUI.app.compileCode({
        sourceCode: newRawCode,
        format: 'iife',
        target: 'es2020',
        minify: false,
      });
      if (!compileResult.success) {
        appendMessage('system', `Compile error: ${compileResult.errors?.[0]?.message ?? 'Unknown'}`);
        return false;
      }
      const validateResult = await window.experienceUI.app.validateCode({
        code: compileResult.compiledCode ?? '',
      });
      if (!validateResult.valid) {
        appendMessage('system', 'Validation failed: code contains disallowed patterns.');
        return false;
      }
      setRawCode(newRawCode);
      setCompiledCode(compileResult.compiledCode ?? null);
      return true;
    },
    [appendMessage],
  );

  // ── handleCustomize ────────────────────────────────────────────────────────

  const handleCustomize = useCallback(
    async (text: string) => {
      if (!tab) return;
      appendMessage('user', text);
      const chatHistory = tab.chatHistory.map((m) => ({ role: m.role, content: m.content }));
      const specContext = JSON.stringify(tab.apiSpec?.normalizedSpec ?? {});
      await customization.runCustomization(
        tab.id, text, rawCode ?? '', specContext, chatHistory, cli.customize,
        async (newCode) => {
          const applied = await applyCode(newCode);
          if (applied) {
            appendMessage('assistant', 'Customization applied successfully.');
            await versions.saveSnapshot(newCode, text.slice(0, 80), 'customization').catch(() => undefined);
          }
        },
        (errMsg) => appendMessage('system', `Customization error: ${errMsg}`),
      );
    },
    [tab, rawCode, cli.customize, customization, appendMessage, applyCode, versions],
  );

  // ── handleLoad ────────────────────────────────────────────────────────────

  const handleLoad = useCallback(
    async (text: string, attachment?: File) => {
      if (!tab) return;
      setIsProcessing(true);
      setSandboxError(null);
      appendMessage('user', text.trim() || (attachment ? `Attached: ${attachment.name}` : ''));
      try {
        let rawContent: string;
        if (attachment) {
          rawContent = await attachment.text();
        } else if (text.startsWith('http://') || text.startsWith('https://')) {
          let parsedUrl: URL;
          try { parsedUrl = new URL(text); }
          catch (err) { appendMessage('system', `Error: Invalid URL — ${err instanceof Error ? err.message : 'please provide a valid http(s) URL.'}`); return; }
          if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            appendMessage('system', 'Error: Only http:// and https:// URLs are supported.'); return;
          }
          setProgressLabel('Fetching spec…'); setProgress(10);
          const res = await fetch(text);
          rawContent = await res.text();
        } else {
          rawContent = text;
        }
        setProgressLabel('Parsing spec…'); setProgress(25);
        const format = detectFormat(rawContent);
        const parseResult = await parseSpec(rawContent, format);
        if (!parseResult.success || !parseResult.spec) {
          appendMessage('system', `Error: ${parseResult.validationErrors[0]?.message ?? 'Failed to parse the API spec.'}`); return;
        }
        loadSpec(tab.id, {
          id: crypto.randomUUID(), format: parseResult.spec.format,
          source: attachment ? { type: 'file', fileName: attachment.name, filePath: '' }
            : text.startsWith('http') ? { type: 'url', url: text } : { type: 'text' },
          rawContent, normalizedSpec: parseResult.spec,
          validationStatus: parseResult.validationErrors.length === 0 ? 'valid'
            : parseResult.validationErrors.some((e) => e.severity === 'error') ? 'invalid' : 'warnings',
          validationErrors: parseResult.validationErrors,
          metadata: parseResult.spec.metadata, parsedAt: new Date().toISOString(),
        });
        appendMessage('system', `Loaded: ${parseResult.spec.metadata.title}`);
        setProgressLabel('Generating interface…'); setProgress(50);
        startGenerating(tab.id);
        const genResult = await generateInterface(parseResult.spec);
        if (!genResult.success) { appendMessage('system', `Generation failed: ${genResult.error}`); return; }
        setProgress(90); setRawCode(genResult.rawCode); setCompiledCode(genResult.compiledCode);
        finishGenerating(tab.id); setProgress(100);
        appendMessage('assistant', 'Interface generated successfully. Preview is ready.');
        await versions.saveSnapshot(genResult.rawCode, `Generated from ${parseResult.spec.metadata.title}`, 'generation').catch(() => undefined);
      } catch (err) {
        appendMessage('system', `Error: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsProcessing(false); setProgressLabel(''); setProgress(0);
      }
    },
    [tab, appendMessage, loadSpec, startGenerating, finishGenerating, versions],
  );

  // ── handleRollback ────────────────────────────────────────────────────────

  const handleRollback = useCallback(
    async (versionId: string) => {
      try {
        const { code } = await versions.rollback(versionId);
        const applied = await applyCode(code);
        if (applied) appendMessage('assistant', 'Rolled back to previous version.');
      } catch (err) {
        appendMessage('system', `Rollback failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [versions, applyCode, appendMessage],
  );

  // ── handleSend ────────────────────────────────────────────────────────────

  const handleSend = useCallback(
    async (text: string, attachment?: File) => {
      if (isProcessing || customization.isCustomizing) return;
      if (tab?.apiSpec && !attachment) { await handleCustomize(text); }
      else { await handleLoad(text, attachment); }
    },
    [isProcessing, customization.isCustomizing, tab, handleCustomize, handleLoad],
  );

  return {
    compiledCode, rawCode, progress, progressLabel, sandboxError, isProcessing,
    showVersions, setShowVersions, setSandboxError,
    cli, customization, versions,
    handleSend, handleRollback, applyCode,
  };
}

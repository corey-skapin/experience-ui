// src/main/cli/cli-manager.ts
// T022 — CLI process lifecycle manager.
// Spawns the Copilot CLI subprocess, manages stdin/stdout JSON-RPC communication,
// handles crash detection, exponential backoff restarts, request timeouts, and
// request queuing with backpressure support.

import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

import {
  CLI_REQUEST_TIMEOUT_MS,
  CLI_RESTART_BACKOFF_MS,
  MAX_CLI_RESTART_RETRIES,
} from '../../shared/constants';
import type { CLIState } from '../../shared/types';
import {
  isResponse,
  isStreamChunk,
  parseMessage,
  serializeRequest,
  type CLIStreamChunk,
} from './cli-protocol';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CLIManagerOptions {
  /** Absolute path to the Copilot CLI binary. */
  cliPath: string;
  /** Optional arguments to pass to the CLI process. */
  cliArgs?: string[];
}

interface PendingRequest {
  resolve: (value: string) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  /** Accumulated streaming chunks for this request. */
  chunks: string[];
}

export interface StreamChunkEvent {
  requestId: number;
  chunk: string;
  done: boolean;
}

// ─── CLIManager ───────────────────────────────────────────────────────────────

/**
 * Manages the Copilot CLI child process lifecycle.
 *
 * Emits:
 * - `'state-changed'` (state: CLIState) — whenever process state changes
 * - `'stream-chunk'` (event: StreamChunkEvent) — for each stream/chunk notification
 */
export class CLIManager extends EventEmitter {
  private readonly cliPath: string;
  private readonly cliArgs: string[];

  private proc: ChildProcess | null = null;
  private state: CLIState;

  private nextId = 1;
  /** Map of request ID → pending request bookkeeping. */
  private pending = new Map<number, PendingRequest>();
  /** Queue of write callbacks waiting for stdin drain. */
  private writeQueue: Array<() => void> = [];
  private isBackpressured = false;
  /** Incomplete line buffer for stdout parsing. */
  private lineBuffer = '';

  constructor(options: CLIManagerOptions) {
    super();
    this.cliPath = options.cliPath;
    this.cliArgs = options.cliArgs ?? [];
    this.state = {
      status: 'stopped',
      pid: null,
      lastCrashAt: null,
      restartCount: 0,
      pendingRequests: 0,
      errorMessage: null,
    };
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  getState(): CLIState {
    return { ...this.state };
  }

  /** Start the CLI process (no-op if already running or starting). */
  start(): void {
    if (this.state.status === 'running' || this.state.status === 'starting') return;
    this.spawnProcess();
  }

  /** Send a JSON-RPC request and return the serialized result. */
  send(method: string, params?: Record<string, unknown>): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (this.state.status !== 'running') {
        reject(new Error(`CLI is not running (status: ${this.state.status})`));
        return;
      }

      const id = this.nextId++;
      const line = serializeRequest(id, method, params);

      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          this.updatePendingCount();
          reject(new Error(`Request ${id} timed out after ${CLI_REQUEST_TIMEOUT_MS}ms`));
        }
      }, CLI_REQUEST_TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, timer, chunks: [] });
      this.updatePendingCount();

      const doWrite = (): void => {
        const drained = this.proc?.stdin?.write(line) ?? true;
        if (drained === false) {
          this.isBackpressured = true;
        }
      };

      if (this.isBackpressured) {
        this.writeQueue.push(doWrite);
      } else {
        doWrite();
      }
    });
  }

  /** Gracefully stop the CLI process and reject all pending requests. */
  stop(): void {
    if (this.state.status === 'stopped') return;
    this.proc?.stdin?.end();
    this.proc?.kill();
    this.proc = null;
    this.rejectAll(new Error('CLI stopped'));
    this.setState({ status: 'stopped', pid: null, errorMessage: null });
  }

  /** Force stop and restart, resetting the restart counter. */
  restart(): void {
    this.stop();
    this.setState({ restartCount: 0 });
    this.spawnProcess();
  }

  // ─── Process Lifecycle ───────────────────────────────────────────────────────

  private spawnProcess(): void {
    this.setState({ status: 'starting', errorMessage: null });

    let proc: ChildProcess;
    try {
      proc = spawn(this.cliPath, this.cliArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setState({ status: 'crashed', errorMessage: msg });
      return;
    }

    this.proc = proc;
    this.lineBuffer = '';
    this.isBackpressured = false;

    this.setState({ status: 'running', pid: proc.pid ?? null });

    proc.stdout?.setEncoding('utf8');
    proc.stdout?.on('data', (data: string) => this.onStdoutData(data));

    proc.stdin?.on('drain', () => {
      this.isBackpressured = false;
      this.flushWriteQueue();
    });

    proc.on('exit', (code, signal) => this.onProcessExit(code, signal));
    proc.on('error', (err) => {
      this.setState({ status: 'crashed', errorMessage: err.message });
      this.rejectAll(new Error(`CLI process error: ${err.message}`));
    });
  }

  // ─── Stdout Parsing ──────────────────────────────────────────────────────────

  private onStdoutData(data: string): void {
    this.lineBuffer += data;
    let idx: number;
    while ((idx = this.lineBuffer.indexOf('\n')) !== -1) {
      const line = this.lineBuffer.slice(0, idx).trim();
      this.lineBuffer = this.lineBuffer.slice(idx + 1);
      if (line.length > 0) {
        this.dispatchMessage(line);
      }
    }
  }

  private dispatchMessage(line: string): void {
    let msg;
    try {
      msg = parseMessage(line);
    } catch {
      return; // Silently discard malformed lines
    }

    if (isStreamChunk(msg)) {
      this.handleStreamChunk(msg);
    } else if (isResponse(msg)) {
      const response = msg; // capture before narrowing
      const entry = this.pending.get(response.id);
      if (!entry) return;

      clearTimeout(entry.timer);
      this.pending.delete(response.id);
      this.updatePendingCount();

      if (response.error !== undefined) {
        const e = response.error;
        const text = `[${e.code}] ${e.message}`;
        entry.reject(new Error(text));
      } else {
        entry.resolve(JSON.stringify(response.result));
      }
    }
    // Ignore unrecognized notifications
  }

  private handleStreamChunk(chunk: CLIStreamChunk): void {
    const entry = this.pending.get(chunk.params.requestId);
    if (entry) {
      entry.chunks.push(chunk.params.chunk);
    }
    const event: StreamChunkEvent = {
      requestId: chunk.params.requestId,
      chunk: chunk.params.chunk,
      done: chunk.params.done,
    };
    this.emit('stream-chunk', event);
  }

  // ─── Crash + Restart ─────────────────────────────────────────────────────────

  private onProcessExit(code: number | null, signal: string | null): void {
    if (this.state.status !== 'running' && this.state.status !== 'starting') return;

    this.setState({
      status: 'crashed',
      lastCrashAt: new Date().toISOString(),
      errorMessage: `Exited with code=${code ?? 'null'} signal=${signal ?? 'none'}`,
    });
    this.rejectAll(new Error('CLI process exited unexpectedly'));
    this.scheduleRestart();
  }

  private scheduleRestart(): void {
    if (this.state.restartCount >= MAX_CLI_RESTART_RETRIES) {
      this.setState({ status: 'stopped', errorMessage: 'Max restart retries reached' });
      return;
    }

    const idx = Math.min(this.state.restartCount, CLI_RESTART_BACKOFF_MS.length - 1);
    const delay = CLI_RESTART_BACKOFF_MS[idx];
    const nextCount = this.state.restartCount + 1;

    this.setState({ status: 'restarting', restartCount: nextCount });

    setTimeout(() => {
      if (this.state.status === 'restarting') {
        this.spawnProcess();
      }
    }, delay);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private setState(update: Partial<CLIState>): void {
    this.state = { ...this.state, ...update };
    this.emit('state-changed', this.getState());
  }

  private updatePendingCount(): void {
    this.setState({ pendingRequests: this.pending.size });
  }

  private rejectAll(error: Error): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    this.pending.clear();
    this.writeQueue = [];
    this.setState({ pendingRequests: 0 });
  }

  private flushWriteQueue(): void {
    while (!this.isBackpressured && this.writeQueue.length > 0) {
      const doWrite = this.writeQueue.shift();
      doWrite?.();
    }
  }
}

import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { MAX_RESTART_RETRIES, CLI_REQUEST_TIMEOUT_MS } from '../../shared/constants';
import type { CLIState } from '../../shared/types';
import {
  encodeRequest,
  decodeMessage,
  type CLIRequest,
  type CLIResponse,
  type CLIStreamChunk,
  type CLINotification,
} from './cli-protocol';

interface PendingRequest {
  resolve: (value: CLIResponse) => void;
  reject: (reason: Error) => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

const RESTART_DELAYS_MS = [5_000, 10_000, 30_000];
const ALLOWED_ENV_KEYS = ['PATH', 'HOME', 'USERPROFILE', 'APPDATA', 'TEMP', 'TMP'];
const CLI_EXECUTABLE = process.env['COPILOT_CLI_PATH'] ?? 'copilot-cli';

export class CLIManager extends EventEmitter {
  private child: ChildProcess | null = null;
  private state: CLIState = {
    status: 'stopped',
    pid: null,
    lastCrashAt: null,
    restartCount: 0,
    pendingRequests: 0,
    errorMessage: null,
  };
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private lineBuffer = '';

  getStatus(): CLIState {
    return { ...this.state };
  }

  async spawn(): Promise<void> {
    this.setState({ status: 'starting', errorMessage: null });
    const env = this.buildEnv();
    this.child = spawn(CLI_EXECUTABLE, ['--stdio'], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.state = { ...this.state, pid: this.child.pid ?? null };
    this.attachHandlers();
    this.setState({ status: 'running' });
  }

  async sendRequest(method: string, params?: Record<string, unknown>): Promise<CLIResponse> {
    if (this.state.status !== 'running' || !this.child?.stdin) {
      throw new Error(`CLI is not running (status: ${this.state.status})`);
    }
    const id = this.nextId++;
    const request: CLIRequest = { jsonrpc: '2.0', id, method, params };
    const encoded = encodeRequest(request);

    return new Promise<CLIResponse>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pending.delete(id);
        this.updatePendingCount();
        reject(new Error(`Request ${id} (${method}) timed out after ${CLI_REQUEST_TIMEOUT_MS}ms`));
      }, CLI_REQUEST_TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, timeoutHandle });
      this.updatePendingCount();

      const canWrite = this.child!.stdin!.write(encoded);
      if (!canWrite) {
        this.child!.stdin!.once('drain', () => {
          /* resume after drain */
        });
      }
    });
  }

  async restart(): Promise<void> {
    this.killChild();
    this.setState({ status: 'restarting' });
    const delay =
      RESTART_DELAYS_MS[Math.min(this.state.restartCount, RESTART_DELAYS_MS.length - 1)];
    await new Promise<void>((r) => setTimeout(r, delay));
    this.state = { ...this.state, restartCount: this.state.restartCount + 1 };
    await this.spawn();
  }

  private attachHandlers(): void {
    if (!this.child) return;

    this.child.stdout?.on('data', (chunk: Buffer) => this.handleData(chunk.toString('utf-8')));
    this.child.stderr?.on('data', (chunk: Buffer) => {
      this.emit('stderr', chunk.toString('utf-8'));
    });
    this.child.on('exit', (code) => this.handleExit(code));
    this.child.on('error', (err) => this.handleError(err));
  }

  private handleData(data: string): void {
    this.lineBuffer += data;
    const lines = this.lineBuffer.split('\n');
    this.lineBuffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = decodeMessage(line);
        this.dispatchMessage(msg);
      } catch {
        // malformed line — ignore
      }
    }
  }

  private dispatchMessage(msg: CLIResponse | CLIStreamChunk | CLINotification): void {
    if ('id' in msg) {
      const response = msg as CLIResponse;
      const pending = this.pending.get(response.id);
      if (pending) {
        clearTimeout(pending.timeoutHandle);
        this.pending.delete(response.id);
        this.updatePendingCount();
        pending.resolve(response);
      }
    } else {
      const notification = msg as CLIStreamChunk | CLINotification;
      this.emit('notification', notification);
    }
  }

  private handleExit(code: number | null): void {
    const crashed = code !== 0 && code !== null;
    this.setState({
      status: crashed ? 'crashed' : 'stopped',
      pid: null,
      lastCrashAt: crashed ? new Date().toISOString() : this.state.lastCrashAt,
      errorMessage: crashed ? `CLI exited with code ${code}` : null,
    });
    this.rejectAllPending(new Error(`CLI process exited with code ${code}`));

    if (crashed && this.state.restartCount < MAX_RESTART_RETRIES) {
      void this.restart();
    }
  }

  private handleError(err: Error): void {
    this.setState({ status: 'crashed', errorMessage: err.message });
    this.rejectAllPending(err);
  }

  private rejectAllPending(err: Error): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeoutHandle);
      pending.reject(err);
      this.pending.delete(id);
    }
    this.updatePendingCount();
  }

  private killChild(): void {
    if (this.child) {
      this.child.removeAllListeners();
      this.child.kill();
      this.child = null;
    }
  }

  private setState(partial: Partial<CLIState>): void {
    this.state = { ...this.state, ...partial };
    this.emit('statusChanged', this.getStatus());
  }

  private updatePendingCount(): void {
    this.state = { ...this.state, pendingRequests: this.pending.size };
  }

  private buildEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    for (const key of ALLOWED_ENV_KEYS) {
      const val = process.env[key];
      if (val !== undefined) env[key] = val;
    }
    return env;
  }
}

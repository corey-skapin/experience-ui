/**
 * CLI manager — spawns and manages the Copilot CLI subprocess.
 * Implements exponential backoff restart, request queuing,
 * backpressure handling, and a state machine.
 *
 * State machine: stopped → starting → running → crashed → restarting
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { EventEmitter } from 'events'
import { CLI } from '../../shared/constants'
import {
  encodeRequest,
  decodeMessage,
  isResponse,
  isError,
  isStreamChunk,
  isNotification,
  StreamBuffer,
  type CLIMessage,
  type CLIStreamChunk,
  type CLINotification,
} from './cli-protocol'

// ─── Types ────────────────────────────────────────────────────────────────

export type CLIStatus = 'stopped' | 'starting' | 'running' | 'crashed' | 'restarting'

export interface CLIManagerState {
  status: CLIStatus
  pid: number | null
  restartCount: number
  pendingRequests: number
  uptime: number | null
}

interface PendingRequest {
  id: number
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
  timer: ReturnType<typeof setTimeout>
  onChunk?: (chunk: string, done: boolean) => void
}

interface QueuedRequest {
  method: string
  params?: Record<string, unknown>
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
  onChunk?: (chunk: string, done: boolean) => void
  timeout: number
}

export interface SendOptions {
  timeout?: number
  onChunk?: (chunk: string, done: boolean) => void
}

// ─── CLI Manager ──────────────────────────────────────────────────────────

export class CLIManager extends EventEmitter {
  private process: ChildProcessWithoutNullStreams | null = null
  private status: CLIStatus = 'stopped'
  private pid: number | null = null
  private restartCount = 0
  private startedAt: number | null = null
  private nextId = 1
  private readonly pending = new Map<number, PendingRequest>()
  private readonly queue: QueuedRequest[] = []
  private readonly buffer = new StreamBuffer()
  private lineBuffer = ''
  private backpressured = false
  private restartTimer: ReturnType<typeof setTimeout> | null = null
  private readonly cliPath: string

  constructor(cliPath: string) {
    super()
    this.cliPath = cliPath
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  getState(): CLIManagerState {
    return {
      status: this.status,
      pid: this.pid,
      restartCount: this.restartCount,
      pendingRequests: this.pending.size,
      uptime: this.startedAt ? Date.now() - this.startedAt : null,
    }
  }

  start(): void {
    if (this.status !== 'stopped') return
    this.spawn()
  }

  stop(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
    if (this.process) {
      this.process.kill()
      this.process = null
    }
    this.rejectAllPending(new Error('CLI stopped'))
    this.setStatus('stopped')
  }

  async restart(): Promise<void> {
    this.stop()
    this.restartCount = 0
    this.spawn()
  }

  send(
    method: string,
    params?: Record<string, unknown>,
    options: SendOptions = {},
  ): Promise<unknown> {
    const timeout = options.timeout ?? CLI.REQUEST_TIMEOUT_MS

    return new Promise<unknown>((resolve, reject) => {
      if (this.status === 'running' && !this.backpressured) {
        this.sendImmediate(method, params, resolve, reject, options.onChunk, timeout)
      } else if (this.status === 'starting' || this.status === 'running') {
        if (this.queue.length >= 100) {
          reject(new Error('Request queue full'))
          return
        }
        this.queue.push({ method, params, resolve, reject, onChunk: options.onChunk, timeout })
      } else {
        reject(new Error(`CLI is not running (status: ${this.status})`))
      }
    })
  }

  // ─── Private spawn/restart logic ────────────────────────────────────────

  private spawn(): void {
    this.setStatus('starting')
    this.lineBuffer = ''
    this.backpressured = false

    const env: Record<string, string> = {}
    for (const key of CLI.ENV_WHITELIST) {
      const val = process.env[key]
      if (val !== undefined) env[key] = val
    }

    try {
      const proc = spawn(this.cliPath, [], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      }) as ChildProcessWithoutNullStreams

      this.process = proc
      this.pid = proc.pid ?? null

      proc.stdout.on('data', (chunk: Buffer) => this.onData(chunk.toString('utf8')))
      proc.stderr.on('data', (chunk: Buffer) => this.emit('stderr', chunk.toString('utf8')))
      proc.on('exit', (code, signal) => this.onExit(code, signal))
      proc.on('error', (err) => this.onProcessError(err))

      proc.stdin.on('drain', () => {
        this.backpressured = false
        this.drainQueue()
      })

      // Wait for first message (initialize)
      this.setStatus('running')
      this.startedAt = Date.now()
      this.drainQueue()
    } catch (err) {
      this.onProcessError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  private onData(text: string): void {
    this.lineBuffer += text
    const lines = this.lineBuffer.split('\n')
    this.lineBuffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      const msg = decodeMessage(line)
      if (msg) this.handleMessage(msg)
    }
  }

  private handleMessage(msg: CLIMessage): void {
    if (isStreamChunk(msg)) {
      this.handleStreamChunk(msg)
      return
    }

    if (isNotification(msg)) {
      this.emit('notification', msg as CLINotification)
      return
    }

    if (isResponse(msg) || isError(msg)) {
      const id = (msg as { id: number }).id
      const pending = this.pending.get(id)
      if (!pending) return

      clearTimeout(pending.timer)
      this.pending.delete(id)

      if (isError(msg)) {
        pending.reject(msg.error)
      } else {
        pending.resolve(msg.result)
      }
    }
  }

  private handleStreamChunk(msg: CLIStreamChunk): void {
    const { requestId, chunk, done } = msg.params
    const pending = this.pending.get(requestId)
    if (!pending) return

    pending.onChunk?.(chunk, done)

    if (done) {
      this.buffer.clear(requestId)
    }
  }

  private onExit(code: number | null, signal: string | null): void {
    this.process = null
    this.pid = null
    this.startedAt = null

    const pendingCount = this.pending.size
    this.rejectAllPending(new Error(`CLI exited (code=${code ?? signal})`))
    this.setStatus('crashed')

    this.emit('crash', { code, signal, pendingCount })
    this.scheduleRestart()
  }

  private onProcessError(err: Error): void {
    this.process = null
    this.pid = null
    this.rejectAllPending(err)
    this.setStatus('crashed')
    this.emit('error', err)
    this.scheduleRestart()
  }

  private scheduleRestart(): void {
    if (this.restartCount >= CLI.MAX_RESTART_RETRIES) {
      this.setStatus('stopped')
      this.emit('maxRestarts')
      return
    }

    const backoffMs =
      CLI.RESTART_BACKOFF_MS[Math.min(this.restartCount, CLI.RESTART_BACKOFF_MS.length - 1)]
    this.restartCount++
    this.setStatus('restarting')

    this.restartTimer = setTimeout(() => {
      this.restartTimer = null
      this.spawn()
    }, backoffMs)
  }

  // ─── Request management ──────────────────────────────────────────────────

  private sendImmediate(
    method: string,
    params: Record<string, unknown> | undefined,
    resolve: (value: unknown) => void,
    reject: (reason: unknown) => void,
    onChunk: ((chunk: string, done: boolean) => void) | undefined,
    timeout: number,
  ): void {
    const id = this.nextId++
    const encoded = encodeRequest(id, method, params)

    const timer = setTimeout(() => {
      this.pending.delete(id)
      reject(new Error(`Request ${id} (${method}) timed out after ${timeout}ms`))
    }, timeout)

    this.pending.set(id, { id, resolve, reject, timer, onChunk })

    const canContinue = this.process?.stdin.write(encoded) ?? false
    if (!canContinue) {
      this.backpressured = true
    }
  }

  private drainQueue(): void {
    while (this.queue.length > 0 && this.status === 'running' && !this.backpressured) {
      const item = this.queue.shift()
      if (!item) break
      this.sendImmediate(
        item.method,
        item.params,
        item.resolve,
        item.reject,
        item.onChunk,
        item.timeout,
      )
    }
  }

  private rejectAllPending(err: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(err)
    }
    this.pending.clear()
  }

  private setStatus(status: CLIStatus): void {
    this.status = status
    this.emit('statusChanged', this.getState())
  }
}

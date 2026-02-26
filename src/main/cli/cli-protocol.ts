export interface CLIRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface CLIResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface CLIStreamChunk {
  jsonrpc: '2.0';
  method: 'stream/chunk';
  params: {
    requestId: number;
    chunk: string;
    done: boolean;
    index: number;
  };
}

export interface CLINotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

export const ERROR_CODE_NAMES: Record<number, string> = {
  [-32700]: 'Parse Error',
  [-32600]: 'Invalid Request',
  [-32601]: 'Method Not Found',
  [-32602]: 'Invalid Params',
  [-32603]: 'Internal Error',
  [-32000]: 'Generation Failed',
  [-32001]: 'Customization Failed',
  [-32002]: 'Spec Invalid',
  [-32003]: 'Context Too Large',
  [-32004]: 'Rate Limited',
};

export function encodeRequest(request: CLIRequest): string {
  return JSON.stringify(request) + '\n';
}

export function decodeMessage(line: string): CLIResponse | CLIStreamChunk | CLINotification {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new Error(`Failed to parse JSON: ${line}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Message must be a non-null object');
  }

  const msg = parsed as Record<string, unknown>;

  if (msg['jsonrpc'] !== '2.0') {
    throw new Error(`Expected jsonrpc 2.0, got: ${String(msg['jsonrpc'])}`);
  }

  return msg as unknown as CLIResponse | CLIStreamChunk | CLINotification;
}

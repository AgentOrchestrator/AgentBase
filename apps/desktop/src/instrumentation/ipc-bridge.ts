import { BrowserWindow, ipcMain } from 'electron';

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

/**
 * Bridge for MCP server to communicate with renderer process.
 * Provides async request/response pattern over Electron IPC.
 */
export class IpcBridge {
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestCounter = 0;
  private disposed = false;
  private readonly responseChannel = 'mcp-bridge-response';
  private readonly requestChannel = 'mcp-bridge-request';

  constructor(private defaultTimeout = 30000) {
    this.setupResponseHandler();
  }

  private setupResponseHandler(): void {
    ipcMain.on(
      this.responseChannel,
      (
        _event,
        { requestId, result, error }: { requestId: string; result?: unknown; error?: string }
      ) => {
        const pending = this.pendingRequests.get(requestId);
        if (!pending) {
          console.warn('[IpcBridge] Response for unknown request:', requestId);
          return;
        }

        clearTimeout(pending.timeout);
        this.pendingRequests.delete(requestId);

        if (error) {
          pending.reject(new Error(error));
        } else {
          pending.resolve(result);
        }
      }
    );
  }

  /**
   * Send a request to the renderer and wait for response.
   */
  async invoke<T = unknown>(channel: string, payload?: unknown, timeout?: number): Promise<T> {
    if (this.disposed) {
      throw new Error('IpcBridge has been disposed');
    }

    const window = this.getMainWindow();
    if (!window) {
      throw new Error('No active window for IPC communication');
    }

    const requestId = `mcp-${++this.requestCounter}-${Date.now()}`;
    const effectiveTimeout = timeout ?? this.defaultTimeout;

    return new Promise<T>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`IPC request timed out after ${effectiveTimeout}ms: ${channel}`));
      }, effectiveTimeout);

      this.pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout: timeoutHandle,
      });

      window.webContents.send(this.requestChannel, {
        requestId,
        channel,
        payload,
      });
    });
  }

  /**
   * Send a one-way message to renderer (no response expected).
   */
  send(channel: string, payload?: unknown): void {
    if (this.disposed) {
      return;
    }

    const window = this.getMainWindow();
    if (!window) {
      console.warn('[IpcBridge] No active window for send:', channel);
      return;
    }

    window.webContents.send(channel, payload);
  }

  private getMainWindow(): BrowserWindow | null {
    const windows = BrowserWindow.getAllWindows();
    return windows[0] ?? null;
  }

  dispose(): void {
    this.disposed = true;
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('IpcBridge disposed'));
      this.pendingRequests.delete(requestId);
    }
    ipcMain.removeAllListeners(this.responseChannel);
  }
}

// Global singleton
let ipcBridgeInstance: IpcBridge | null = null;

export function getIpcBridge(): IpcBridge {
  if (!ipcBridgeInstance) {
    ipcBridgeInstance = new IpcBridge();
  }
  return ipcBridgeInstance;
}

export function disposeIpcBridge(): void {
  if (ipcBridgeInstance) {
    ipcBridgeInstance.dispose();
    ipcBridgeInstance = null;
  }
}

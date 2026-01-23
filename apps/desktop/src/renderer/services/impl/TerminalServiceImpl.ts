/**
 * TerminalServiceImpl
 *
 * Implementation of ITerminalService that wraps Electron IPC.
 * Manages terminal process lifecycle and I/O.
 */

import type { ITerminalService } from '../../context/node-services';

/**
 * Terminal service implementation using Electron IPC
 */
export class TerminalServiceImpl implements ITerminalService {
  readonly nodeId: string;
  readonly terminalId: string;

  private dataListeners: Set<(data: string) => void> = new Set();
  private exitListeners: Set<(code: number, signal?: number) => void> = new Set();
  private isCreated = false;
  private ipcDataHandler: ((data: { terminalId: string; data: string }) => void) | null = null;
  private ipcExitHandler:
    | ((data: { terminalId: string; code: number; signal?: number }) => void)
    | null = null;

  constructor(nodeId: string, terminalId: string) {
    this.nodeId = nodeId;
    this.terminalId = terminalId;
  }

  /**
   * Initialize the service - set up IPC listeners
   */
  async initialize(): Promise<void> {
    if (!window.electronAPI) {
      console.warn('[TerminalService] electronAPI not available');
      return;
    }

    // Set up IPC data listener
    this.ipcDataHandler = ({ terminalId, data }) => {
      if (terminalId === this.terminalId) {
        this.notifyDataListeners(data);
      }
    };
    window.electronAPI.onTerminalData(this.ipcDataHandler);

    // Set up IPC exit listener
    this.ipcExitHandler = ({ terminalId, code, signal }) => {
      if (terminalId === this.terminalId) {
        this.isCreated = false;
        this.notifyExitListeners(code, signal);
      }
    };
    window.electronAPI.onTerminalExit(this.ipcExitHandler);
  }

  /**
   * Create the terminal process
   * @param workspacePath - Optional workspace path for hook env injection
   */
  async create(workspacePath?: string): Promise<void> {
    if (this.isCreated) {
      return;
    }

    if (!window.electronAPI) {
      throw new Error('electronAPI not available');
    }

    // Pass workspacePath to enable agent hooks env var injection
    window.electronAPI.createTerminal(this.terminalId, workspacePath);
    this.isCreated = true;
  }

  /**
   * Destroy the terminal process
   */
  async destroy(): Promise<void> {
    if (!this.isCreated) {
      return;
    }

    if (window.electronAPI) {
      window.electronAPI.destroyTerminal(this.terminalId);
    }
    this.isCreated = false;
  }

  /**
   * Restart the terminal (destroy + create)
   * @param workspacePath - Optional workspace path for hook env injection
   */
  async restart(workspacePath?: string): Promise<void> {
    await this.destroy();
    // Small delay to allow cleanup
    await new Promise((resolve) => setTimeout(resolve, 100));
    await this.create(workspacePath);
  }

  // ===========================================================================
  // Public I/O Methods (explicit intent)
  // ===========================================================================

  /**
   * Send user keystroke input to terminal.
   * Use this for forwarding xterm.js onData events (individual keystrokes).
   */
  sendUserInput(data: string): void {
    this.writeToTerminal(data, 'sendUserInput');
  }

  /**
   * Execute a shell command in the terminal.
   * Appends newline if not present to execute the command.
   */
  executeCommand(command: string): void {
    const commandWithNewline = command.endsWith('\n') ? command : `${command}\n`;
    this.writeToTerminal(commandWithNewline, 'executeCommand');
  }

  /**
   * Send a terminal control sequence.
   * Use this for escape sequences like terminal reset (\x1bc).
   */
  sendControlSequence(sequence: string): void {
    this.writeToTerminal(sequence, 'sendControlSequence');
  }

  // ===========================================================================
  // Private Write Implementation
  // ===========================================================================

  /**
   * Internal method to write data to terminal stdin.
   * All public I/O methods delegate to this for consistent logging and validation.
   */
  private writeToTerminal(data: string, source: string): void {
    if (!this.isCreated) {
      console.warn(`[TerminalService] Cannot ${source} - terminal not created`, {
        terminalId: this.terminalId,
        data: data.substring(0, 100),
      });
      return;
    }

    // Log what's being written to the terminal for debugging
    console.log(`[TerminalService] ${source}()`, {
      terminalId: this.terminalId,
      dataLength: data.length,
      data: data.length > 200 ? `${data.substring(0, 200)}...` : data,
    });

    if (window.electronAPI) {
      window.electronAPI.sendTerminalInput(this.terminalId, data);
    }
  }

  /**
   * Resize terminal dimensions
   */
  resize(cols: number, rows: number): void {
    if (!this.isCreated) {
      return;
    }

    if (window.electronAPI) {
      window.electronAPI.sendTerminalResize(this.terminalId, cols, rows);
    }
  }

  /**
   * Subscribe to terminal output
   */
  onData(callback: (data: string) => void): () => void {
    this.dataListeners.add(callback);
    return () => {
      this.dataListeners.delete(callback);
    };
  }

  /**
   * Subscribe to terminal exit events
   */
  onExit(callback: (code: number, signal?: number) => void): () => void {
    this.exitListeners.add(callback);
    return () => {
      this.exitListeners.delete(callback);
    };
  }

  /**
   * Check if terminal process is running
   */
  isRunning(): boolean {
    return this.isCreated;
  }

  /**
   * Get terminal buffer for restoration after view switch
   */
  async getBuffer(): Promise<string | null> {
    if (!window.terminalSessionAPI) {
      return null;
    }

    try {
      const buffer = await window.terminalSessionAPI.getTerminalBuffer(this.terminalId);
      return buffer && buffer.length > 0 ? buffer : null;
    } catch (error) {
      console.warn('[TerminalService] Failed to get terminal buffer:', error);
      return null;
    }
  }

  /**
   * Dispose the service - cleanup resources
   */
  async dispose(): Promise<void> {
    // Destroy terminal if running
    await this.destroy();

    // Clear listeners
    this.dataListeners.clear();
    this.exitListeners.clear();

    // Note: We can't remove specific IPC listeners in the current API
    // The handlers will check terminalId before processing
    this.ipcDataHandler = null;
    this.ipcExitHandler = null;
  }

  private notifyDataListeners(data: string): void {
    for (const listener of this.dataListeners) {
      try {
        listener(data);
      } catch (err) {
        console.error('[TerminalService] Error in data listener:', err);
      }
    }
  }

  private notifyExitListeners(code: number, signal?: number): void {
    for (const listener of this.exitListeners) {
      try {
        listener(code, signal);
      } catch (err) {
        console.error('[TerminalService] Error in exit listener:', err);
      }
    }
  }
}

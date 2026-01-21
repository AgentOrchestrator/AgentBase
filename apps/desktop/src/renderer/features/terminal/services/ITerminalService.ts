/**
 * Terminal Service Interface
 *
 * Defines the contract for terminal process lifecycle management.
 * Implementations wrap Electron IPC for terminal operations.
 */

/**
 * Base interface all node services implement.
 * Provides lifecycle management for mount/unmount.
 */
export interface INodeService {
  /** Node ID this service belongs to */
  readonly nodeId: string;

  /** Initialize the service (called on mount) */
  initialize(): Promise<void>;

  /** Dispose the service (called on unmount) */
  dispose(): Promise<void>;
}

/**
 * Terminal service - manages terminal process lifecycle.
 * Wraps Electron IPC for terminal operations.
 */
export interface ITerminalService extends INodeService {
  /** Terminal process identifier */
  readonly terminalId: string;

  // Lifecycle
  /** Create the terminal process */
  create(): Promise<void>;
  /** Destroy the terminal process */
  destroy(): Promise<void>;
  /** Restart the terminal (destroy + create) */
  restart(): Promise<void>;

  // I/O
  /**
   * Send user keystroke input to terminal.
   * Use this for forwarding xterm.js onData events (individual keystrokes).
   * @param data - Raw keystroke data from xterm.js
   */
  sendUserInput(data: string): void;

  /**
   * Execute a shell command in the terminal.
   * Appends newline if not present to execute the command.
   * Use this for programmatic command execution (e.g., starting Claude CLI).
   * @param command - The command to execute
   */
  executeCommand(command: string): void;

  /**
   * Send a terminal control sequence.
   * Use this for escape sequences like terminal reset (\x1bc).
   * @param sequence - The control sequence to send
   */
  sendControlSequence(sequence: string): void;

  /** Resize terminal dimensions */
  resize(cols: number, rows: number): void;

  // Subscriptions
  /** Subscribe to terminal output */
  onData(callback: (data: string) => void): () => void;
  /** Subscribe to terminal exit events */
  onExit(callback: (code: number, signal?: number) => void): () => void;

  // State
  /** Check if terminal process is running */
  isRunning(): boolean;

  // Buffer
  /** Get terminal buffer for restoration after view switch */
  getBuffer(): Promise<string | null>;
}

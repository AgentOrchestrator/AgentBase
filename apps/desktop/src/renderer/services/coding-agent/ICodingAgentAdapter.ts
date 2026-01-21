/**
 * Coding Agent Adapter Interface
 *
 * Defines the contract for renderer-side adapters that communicate with
 * coding agents via main process IPC. Uses Result types for explicit error handling.
 */

import type { AgentType } from '../../../../types/coding-agent-status';
import type { AgentAdapterEventType, AgentEventHandler } from './events';
import type { AgentError, Result } from './result';
import type {
  CodingAgentSessionContent,
  ContinueOptions,
  ForkOptions,
  GenerateRequest,
  GenerateResponse,
  MessageFilterOptions,
  SessionFilterOptions,
  SessionIdentifier,
  SessionInfo,
  SessionSummary,
  StreamCallback,
  StructuredStreamCallback,
} from './types';

/**
 * Coding Agent Adapter Interface
 *
 * Defines the contract for adapters that proxy to main-side agent implementations.
 * All methods that can fail return Result<T, AgentError> for explicit error handling.
 */
export interface ICodingAgentAdapter {
  /**
   * Agent type this adapter handles
   */
  readonly agentType: AgentType;

  // ============================================
  // Lifecycle
  // ============================================

  /**
   * Initialize the adapter
   */
  initialize(): Promise<Result<void, AgentError>>;

  /**
   * Check if the agent is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Dispose the adapter and cleanup resources
   */
  dispose(): Promise<void>;

  /**
   * Cancel all running operations
   */
  cancelAll(): Promise<void>;

  // ============================================
  // Generation
  // ============================================

  /**
   * Generate a response (non-streaming)
   */
  generate(request: GenerateRequest): Promise<Result<GenerateResponse, AgentError>>;

  /**
   * Generate a response with streaming.
   * Returns the final complete response while emitting chunks via callback.
   */
  generateStreaming(
    request: GenerateRequest,
    onChunk: StreamCallback
  ): Promise<Result<GenerateResponse, AgentError>>;

  /**
   * Generate a response with structured streaming (content blocks).
   * Streams thinking, tool_use, and text blocks as they arrive.
   * Returns the final complete response while emitting structured chunks via callback.
   */
  generateStreamingStructured?(
    request: GenerateRequest,
    onChunk: StructuredStreamCallback
  ): Promise<Result<GenerateResponse, AgentError>>;

  // ============================================
  // Session Continuation
  // ============================================

  /**
   * Continue an existing session (non-streaming)
   */
  continueSession(
    identifier: SessionIdentifier,
    prompt: string,
    options?: ContinueOptions
  ): Promise<Result<GenerateResponse, AgentError>>;

  /**
   * Continue an existing session with streaming.
   * Returns the final complete response while emitting chunks via callback.
   */
  continueSessionStreaming(
    identifier: SessionIdentifier,
    prompt: string,
    onChunk: StreamCallback,
    options?: ContinueOptions
  ): Promise<Result<GenerateResponse, AgentError>>;

  // ============================================
  // Session Management
  // ============================================

  /**
   * Get session content with optional message filtering
   */
  getSession(
    sessionId: string,
    filter?: MessageFilterOptions
  ): Promise<Result<CodingAgentSessionContent | null, AgentError>>;

  /**
   * Check if a session file exists on disk
   */
  sessionFileExists(sessionId: string, workspacePath: string): Promise<boolean>;

  // ============================================
  // Optional Capabilities
  // ============================================

  /**
   * Fork a session (creates a new session from an existing one)
   */
  forkSession?(options: ForkOptions): Promise<Result<SessionInfo, AgentError>>;

  /**
   * List session summaries
   */
  listSessionSummaries?(
    filter?: SessionFilterOptions
  ): Promise<Result<SessionSummary[], AgentError>>;

  /**
   * Get the latest session for a workspace
   */
  getLatestSession?(workspacePath: string): Promise<Result<SessionInfo | null, AgentError>>;

  // ============================================
  // CLI REPL Session Commands
  // ============================================

  /**
   * Build command to start a new CLI REPL session with a specific session ID.
   * Used when creating a new agent node.
   * @param workspacePath - Directory to run the CLI in
   * @param sessionId - UUID for the new session
   * @returns Shell command string including newline
   */
  buildStartSessionCommand?(workspacePath: string, sessionId: string): string;

  /**
   * Build command to resume an existing CLI REPL session.
   * Used when restoring a node from canvas or after page refresh.
   * @param workspacePath - Directory to run the CLI in
   * @param sessionId - UUID of the session to resume
   * @returns Shell command string including newline
   */
  buildResumeSessionCommand?(workspacePath: string, sessionId: string): string;

  /**
   * Get the command to gracefully exit the CLI REPL.
   * This is vendor-specific (e.g., "/exit" for Claude Code, "exit" for others).
   * @returns Exit command string including newline
   */
  getExitCommand(): string;

  // ============================================
  // Events
  // ============================================

  /**
   * Subscribe to typed events
   * @returns Unsubscribe function
   */
  onEvent<T extends AgentAdapterEventType>(type: T, handler: AgentEventHandler<T>): () => void;
}

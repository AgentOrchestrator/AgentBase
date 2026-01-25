/**
 * Coding Agent Adapter Interface
 *
 * Defines the contract for renderer-side adapters that communicate with
 * coding agents via main process IPC. Mirrors main-side ClaudeCodeAgent
 * capabilities with Result types for explicit error handling.
 */

import type {
  MessageFilterOptions as SharedMessageFilterOptions,
  StreamingBlockType,
  StreamingChunk,
  StreamingContentBlock,
} from '@agent-orchestrator/shared';
import type { AgentType } from '../../../../types/coding-agent-status';

// ============================================
// Result Type (matches main-side contract)
// ============================================

/**
 * Error codes for agent operations
 */
export enum AgentErrorCode {
  AGENT_NOT_INITIALIZED = 'AGENT_NOT_INITIALIZED',
  AGENT_NOT_AVAILABLE = 'AGENT_NOT_AVAILABLE',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_INVALID = 'SESSION_INVALID',
  GENERATION_FAILED = 'GENERATION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CAPABILITY_NOT_SUPPORTED = 'CAPABILITY_NOT_SUPPORTED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Agent error type
 */
export interface AgentError {
  code: AgentErrorCode;
  message: string;
  cause?: unknown;
}

/**
 * Result type for explicit error handling
 */
export type Result<T, E> = { success: true; data: T } | { success: false; error: E };

/**
 * Helper to create success result
 */
export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Helper to create error result
 */
export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Helper to create agent error
 */
export function agentError(code: AgentErrorCode, message: string, cause?: unknown): AgentError {
  return { code, message, cause };
}

// ============================================
// Request/Response Types
// ============================================

/**
 * Request for generating a response
 */
export interface GenerateRequest {
  prompt: string;
  workingDirectory: string;
  sessionId: string;
  systemPrompt?: string;
  agentId?: string;
}

/**
 * Response from generation
 */
export interface GenerateResponse {
  content: string;
  sessionId: string;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Callback for streaming chunks (plain text)
 */
export type StreamCallback = (chunk: string) => void;

/**
 * Callback for structured streaming chunks (content blocks)
 */
export type StructuredStreamCallback = (chunk: StreamingChunk) => void;

// Re-export streaming types for consumers
export type { StreamingChunk, StreamingBlockType, StreamingContentBlock };

/**
 * Session identifier types
 */
export type SessionIdentifier =
  | { type: 'id'; value: string }
  | { type: 'name'; value: string }
  | { type: 'latest' };

/**
 * Session information
 */
export interface SessionInfo {
  id: string;
  name?: string;
  agentType: AgentType;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  parentSessionId?: string;
}

/**
 * Session summary for listing
 */
export interface SessionSummary {
  id: string;
  agentType: AgentType;
  createdAt: string;
  updatedAt: string;
  timestamp: string;
  projectPath?: string;
  projectName?: string;
  messageCount: number;
  firstUserMessage?: string;
  lastAssistantMessage?: string;
  toolCallCount?: number;
  hasThinking?: boolean;
}

/**
 * Session content with messages
 */
export interface CodingAgentSessionContent {
  id: string;
  agentType: AgentType;
  createdAt: string;
  updatedAt: string;
  projectPath?: string;
  messageCount: number;
  metadata?: Record<string, unknown>;
  messages: CodingAgentMessage[];
}

/**
 * Message in a session
 */
export interface CodingAgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  messageType?: string;
  toolCalls?: unknown[];
  thinking?: string;
}

/**
 * Filter options for messages
 * Re-exported from shared package to avoid type drift
 */
export type MessageFilterOptions = SharedMessageFilterOptions;

/**
 * Filter options for sessions
 */
export interface SessionFilterOptions {
  projectPath?: string;
  projectName?: string;
  sinceTimestamp?: number;
  lookbackDays?: number;
  hasThinking?: boolean;
  minToolCallCount?: number;
}

/**
 * Options for continuing a session
 */
export interface ContinueOptions {
  workingDirectory?: string;
  agentId?: string;
}

/**
 * Options for forking a session
 */
export interface ForkOptions {
  /** Session ID to fork from (required) */
  sessionId: string;
  /** Human-readable name for the new session */
  newSessionName?: string;
  /** Workspace path for the new session */
  workspacePath?: string;
  /** Filter options for partial context fork */
  filterOptions?: { targetMessageId?: string };
  /** Whether to create a new git worktree */
  createWorktree?: boolean;
}

// ============================================
// Typed Event System
// ============================================

/**
 * Event types for agent adapter
 */
export type AgentAdapterEventType =
  | 'permission:request'
  | 'permission:response'
  | 'session:start'
  | 'session:end'
  | 'status:change';

/**
 * Payload for permission request events
 */
export interface PermissionRequestPayload {
  toolName: string;
  command?: string;
  filePath?: string;
  workingDirectory?: string;
  reason?: string;
  toolInput?: Record<string, unknown>;
  toolUseId?: string;
}

/**
 * Payload for permission response events
 */
export interface PermissionResponsePayload {
  action: 'allow' | 'deny' | 'modify';
  message?: string;
  modifiedPayload?: Record<string, unknown>;
}

/**
 * Payload for session events
 */
export interface SessionPayload {
  sessionId: string;
  workspacePath?: string;
}

/**
 * Payload for status change events
 */
export interface StatusPayload {
  status: 'idle' | 'running' | 'completed' | 'error';
  errorMessage?: string;
}

/**
 * Discriminated union of all adapter events
 */
export type AgentAdapterEvent =
  | {
      type: 'permission:request';
      payload: PermissionRequestPayload;
      agentId?: string;
      sessionId?: string;
    }
  | {
      type: 'permission:response';
      payload: PermissionResponsePayload;
      agentId?: string;
      sessionId?: string;
    }
  | { type: 'session:start'; payload: SessionPayload; agentId?: string }
  | { type: 'session:end'; payload: SessionPayload; agentId?: string }
  | { type: 'status:change'; payload: StatusPayload; agentId?: string; sessionId?: string };

/**
 * Handler type for specific event types
 */
export type AgentEventHandler<T extends AgentAdapterEventType> = (
  event: Extract<AgentAdapterEvent, { type: T }>
) => void;

// ============================================
// Adapter Interface
// ============================================

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
   * Generate a response with streaming
   * Returns the final complete response while emitting chunks via callback
   */
  generateStreaming(
    request: GenerateRequest,
    onChunk: StreamCallback
  ): Promise<Result<GenerateResponse, AgentError>>;

  /**
   * Generate a response with structured streaming (content blocks)
   * Streams thinking, tool_use, and text blocks as they arrive
   * Returns the final complete response while emitting structured chunks via callback
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
   * Continue an existing session with streaming
   * Returns the final complete response while emitting chunks via callback
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

/**
 * Coding Agent Types
 *
 * Consolidated type definitions for the coding agent service.
 * This file merges all types from the previous multi-file structure:
 * - agent.types.ts (agent capabilities, config)
 * - session.types.ts (sessions, identifiers, filters)
 * - message.types.ts (messages, streaming, generation)
 * - result.types.ts (Result, AgentError)
 * - ipc.types.ts (IPC API)
 */

import type { AgentActionResponse, AgentEvent, AgentType } from '@agent-orchestrator/shared';

// ============================================
// Agent Types
// ============================================

/**
 * Re-export AgentType from shared package
 */
export type { AgentType };

/**
 * Alias for backwards compatibility
 * Supported coding agent types: 'claude_code' | 'codex' | 'cursor' | 'vscode' | 'windsurf' | 'factory' | 'other'
 */
export type CodingAgentType = AgentType;

/**
 * Agent capabilities for runtime capability checking
 */
export interface AgentCapabilities {
  /** All agents must support basic generation */
  canGenerate: boolean;
  /** Can resume/continue previous sessions */
  canResumeSession: boolean;
  /** Can fork existing sessions */
  canForkSession: boolean;
  /** Can list available sessions */
  canListSessions: boolean;
  /** Supports streaming output */
  supportsStreaming: boolean;
}

/**
 * Configuration for creating an agent instance
 */
export interface AgentConfig {
  /** The type of coding agent */
  type: CodingAgentType;
  /** Custom path to CLI executable (uses system PATH if not provided) */
  executablePath?: string;
  /** Default timeout in milliseconds */
  timeout?: number;
  /** Additional environment variables */
  environment?: Record<string, string>;
}

/**
 * Default configuration values
 */
export const DEFAULT_AGENT_CONFIG = {
  timeout: 120_000, // 2 minutes
} as const;

// ============================================
// Session Types
// ============================================

// Re-export session change type from shared
export type { SessionChange } from '@agent-orchestrator/shared';

// Import CodingAgentMessage and MessageType for use in interfaces below
import type {
  CodingAgentMessage,
  JsonlFilterOptions,
  MessageType,
} from '@agent-orchestrator/shared';

/**
 * Filter options for messages within a session
 */
export interface MessageFilterOptions {
  /** Filter by message types */
  messageTypes?: MessageType[];
  /** Filter by roles */
  roles?: Array<'user' | 'assistant' | 'system'>;
  /** Only include messages with tool calls */
  hasToolCalls?: boolean;
  /** Full-text search in content */
  searchText?: string;
  /**
   * Workspace path to scope session lookup.
   * When provided, prioritizes searching in this workspace's project directory first.
   */
  workspacePath?: string;
}

/**
 * Filter options for listing sessions
 */
export interface SessionFilterOptions {
  /** Only sessions with thinking blocks */
  hasThinking?: boolean;
  /** Sessions with at least N tool calls */
  minToolCallCount?: number;
  /** Filter by project name */
  projectName?: string;
  /** Filter by project path */
  projectPath?: string;
  /** Only sessions modified since this timestamp */
  sinceTimestamp?: number;
  /** Only sessions within this lookback period (in days) */
  lookbackDays?: number;
}

/**
 * Options for forking a session
 */
export interface ForkOptions {
  /** Session ID to fork from (required) */
  sessionId: string;
  /** Human-readable name for the new session */
  newSessionName?: string;
  /** Workspace path for the new session (defaults to current workspace) */
  workspacePath?: string;
  /**
   * Source workspace path where the session was created.
   * Required for correct session lookup when the same session ID exists
   * in multiple project folders (from previous forks).
   */
  sourceWorkspacePath?: string;
  /** Filter options for partial context fork (include messages up to a specific point) */
  filterOptions?: JsonlFilterOptions;
  /**
   * Whether to create a new git worktree for the fork.
   * - true: Fork Handle Button behavior - creates isolated worktree
   * - false: Text Selection Fork behavior - stays in same workspace
   */
  createWorktree?: boolean;
}

/**
 * Session identifier - supports ID, name, or "latest" lookup
 */
export type SessionIdentifier =
  | { type: 'id'; value: string }
  | { type: 'name'; value: string }
  | { type: 'latest' };

/**
 * Session metadata (without full message history)
 */
export interface SessionInfo {
  id: string;
  name?: string;
  agentType: CodingAgentType;
  createdAt: string;
  updatedAt: string;
  projectPath?: string;
  messageCount: number;
  /** For forked sessions, the parent session ID */
  parentSessionId?: string;
}

/**
 * Full session content including messages for coding agents.
 * Uses CodingAgentMessage (with rich content blocks) rather than ChatMessage.
 */
export interface CodingAgentSessionContent extends SessionInfo {
  messages: CodingAgentMessage[];
  /** Session metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Alias for CodingAgentSessionContent for backward compatibility.
 * Prefer using CodingAgentSessionContent for clarity.
 */
export type SessionContent = CodingAgentSessionContent;

/**
 * Session summary for efficient listing (without full messages)
 * Extends SessionInfo with preview and statistics fields
 */
export interface SessionSummary extends SessionInfo {
  /** ISO timestamp of last activity (for sorting) */
  timestamp: string;
  /** Project name (extracted from path) */
  projectName?: string;
  /** First user message (for preview) */
  firstUserMessage?: string;
  /** Last assistant message (for preview) */
  lastAssistantMessage?: string;
  /** Number of tool calls in session */
  toolCallCount: number;
  /** Whether session has thinking blocks */
  hasThinking: boolean;
}

/**
 * Options for continuing a session
 */
export interface ContinueOptions {
  /** Agent node identifier for scoping hook events */
  agentId?: string;
  workingDirectory?: string;
  timeout?: number;
}

// ============================================
// Message Types
// ============================================

// Import StreamingChunk for use in StructuredStreamCallback definition
import type { StreamingChunk as _StreamingChunk } from '@agent-orchestrator/shared';

// Re-export rich message types from shared package
export type {
  AgentContentBlock,
  AgentRedactedThinkingBlock,
  AgentServerToolUseBlock,
  AgentTextBlock,
  AgentThinkingBlock,
  AgentToolUseBlock,
  AgentWebSearchResultBlock,
  AgentWebSearchToolResultBlock,
  AgentWebSearchToolResultContent,
  AgentWebSearchToolResultError,
  AgentWebSearchToolResultErrorCode,
  CodingAgentMessage,
  ErrorInfo,
  McpInfo,
  MessageType,
  StreamingBlockType,
  StreamingChunk,
  StreamingContentBlock,
  ThinkingInfo,
  ToolCategory,
  ToolInfo,
} from '@agent-orchestrator/shared';

/**
 * Request to generate a response
 */
export interface GenerateRequest {
  /** The prompt to send to the agent */
  prompt: string;
  /** Agent node identifier for scoping hook events */
  agentId?: string;
  /** Working directory for the agent (affects file access) */
  workingDirectory?: string;
  /** Custom system prompt to prepend */
  systemPrompt?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Session ID for stateful agents */
  sessionId?: string;
}

/**
 * Response from a generation request
 */
export interface GenerateResponse {
  /** The generated content */
  content: string;
  /** Session ID (for stateful agents) */
  sessionId: string;
  /** Unique message ID */
  messageId: string;
  /** When the response was generated */
  timestamp: string;
  /** Token usage if available */
  tokensUsed?: number;
}

/**
 * Callback for streaming output chunks (plain text)
 */
export type StreamCallback = (chunk: string) => void;

/**
 * Callback for structured streaming chunks (with content block types)
 */
export type StructuredStreamCallback = (chunk: _StreamingChunk) => void;

// ============================================
// Result Types
// ============================================

/**
 * Result type for explicit error handling
 * Avoids throwing exceptions, making error paths explicit in the type system
 */
export type Result<T, E = AgentError> = { success: true; data: T } | { success: false; error: E };

/**
 * Structured error for coding agent operations
 */
export interface AgentError {
  code: AgentErrorCode;
  message: string;
  details?: Record<string, unknown>;
  cause?: Error;
}

/**
 * Enumerated error codes for programmatic error handling
 */
export enum AgentErrorCode {
  // Process errors
  PROCESS_SPAWN_FAILED = 'PROCESS_SPAWN_FAILED',
  PROCESS_TIMEOUT = 'PROCESS_TIMEOUT',
  PROCESS_KILLED = 'PROCESS_KILLED',
  PROCESS_OUTPUT_PARSE_ERROR = 'PROCESS_OUTPUT_PARSE_ERROR',

  // Session errors
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_INVALID = 'SESSION_INVALID',

  // Capability errors
  CAPABILITY_NOT_SUPPORTED = 'CAPABILITY_NOT_SUPPORTED',

  // Agent errors
  AGENT_NOT_AVAILABLE = 'AGENT_NOT_AVAILABLE',
  AGENT_BUSY = 'AGENT_BUSY',
  AGENT_NOT_INITIALIZED = 'AGENT_NOT_INITIALIZED',

  // General
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Helper to create a success result
 */
export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Helper to create an error result
 */
export function err<E = AgentError>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Helper to create an AgentError
 */
export function agentError(
  code: AgentErrorCode,
  message: string,
  details?: Record<string, unknown>,
  cause?: Error
): AgentError {
  return { code, message, details, cause };
}

// ============================================
// IPC API Types
// ============================================

export interface CodingAgentAPI {
  /** Generate a one-off response */
  generate: (agentType: CodingAgentType, request: GenerateRequest) => Promise<GenerateResponse>;

  /** Generate a response with streaming */
  generateStreaming: (
    agentType: CodingAgentType,
    request: GenerateRequest,
    onChunk: StreamCallback
  ) => Promise<GenerateResponse>;

  /** Generate a response with structured streaming (content blocks) */
  generateStreamingStructured: (
    agentType: CodingAgentType,
    request: GenerateRequest,
    onChunk: StructuredStreamCallback
  ) => Promise<GenerateResponse>;

  /** Continue an existing session */
  continueSession: (
    agentType: CodingAgentType,
    identifier: SessionIdentifier,
    prompt: string,
    options?: ContinueOptions
  ) => Promise<GenerateResponse>;

  /** Continue an existing session with streaming */
  continueSessionStreaming: (
    agentType: CodingAgentType,
    identifier: SessionIdentifier,
    prompt: string,
    onChunk: StreamCallback,
    options?: ContinueOptions
  ) => Promise<GenerateResponse>;

  /** Fork an existing session */
  forkSession: (
    agentType: CodingAgentType,
    options: ForkOptions
  ) => Promise<Result<SessionInfo, AgentError>>;

  /** Get list of available agent types */
  getAvailableAgents: () => Promise<CodingAgentType[]>;

  /** Get capabilities for a specific agent type */
  getCapabilities: (agentType: CodingAgentType) => Promise<AgentCapabilities>;

  /** Check if a specific agent is available */
  isAgentAvailable: (agentType: CodingAgentType) => Promise<boolean>;

  /** Get the latest session for a workspace path */
  getLatestSession: (
    agentType: CodingAgentType,
    workspacePath: string
  ) => Promise<{ id: string; updatedAt: string } | null>;

  /** Check if a session file exists on disk */
  sessionFileExists: (
    agentType: CodingAgentType,
    sessionId: string,
    workspacePath: string
  ) => Promise<boolean>;

  /** List session summaries (without full messages) */
  listSessionSummaries: (
    agentType: CodingAgentType,
    filter?: SessionFilterOptions
  ) => Promise<SessionSummary[]>;

  /** Get full session content */
  getSession: (
    agentType: CodingAgentType,
    sessionId: string,
    filter?: MessageFilterOptions
  ) => Promise<CodingAgentSessionContent | null>;

  /** Subscribe to stream chunks */
  onStreamChunk: (callback: (data: { requestId: string; chunk: string }) => void) => () => void;

  /** Subscribe to structured stream chunks (content blocks) */
  onStreamChunkStructured: (
    callback: (data: { requestId: string; chunk: _StreamingChunk }) => void
  ) => () => void;

  /** Subscribe to agent hook events */
  onAgentEvent: (callback: (event: AgentEvent) => void) => () => void;

  /** Respond to pending agent actions (permissions/questions) */
  respondToAction: (response: AgentActionResponse) => Promise<void>;

  /** Set the current agent ID for CLI REPL mode */
  setCurrentAgentId: (agentType: CodingAgentType, agentId: string | null) => Promise<void>;
}

// Re-export types needed for IPC
export type { AgentActionResponse, AgentEvent } from '@agent-orchestrator/shared';

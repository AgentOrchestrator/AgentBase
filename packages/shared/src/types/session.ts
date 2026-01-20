/**
 * Session Type Definitions
 *
 * Types for managing coding agent sessions, including continue and fork operations.
 */

import type { CodingAgentMessage } from '../types.js';
import type { AgentType } from './coding-agent.js';

// =============================================================================
// Session Identifier
// =============================================================================

/**
 * Session identifier - supports ID, name, or "latest" lookup
 */
export type SessionIdentifier =
  | { type: 'id'; value: string }
  | { type: 'name'; value: string }
  | { type: 'latest' };

// =============================================================================
// Session Info
// =============================================================================

/**
 * Session metadata (without full message history)
 */
export interface SessionInfo {
  /** Unique session identifier */
  id: string;
  /** Optional human-readable session name */
  name?: string;
  /** Type of agent that created this session */
  agentType: AgentType;
  /** ISO timestamp when created */
  createdAt: string;
  /** ISO timestamp when last updated */
  updatedAt: string;
  /** Project/workspace path */
  projectPath?: string;
  /** Number of messages in session */
  messageCount: number;
  /** For forked sessions, the parent session ID */
  parentSessionId?: string;
}

// =============================================================================
// Session Content
// =============================================================================

/**
 * Full session content including messages for coding agents.
 * Uses CodingAgentMessage (with rich content blocks) rather than ChatMessage.
 */
export interface CodingAgentSessionContent extends SessionInfo {
  /** Full message array */
  messages: CodingAgentMessage[];
  /** Session metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Session Summary
// =============================================================================

/**
 * Session summary for efficient listing (without full messages)
 * Extends SessionInfo with preview and statistics fields
 */
export interface SessionSummaryExtended extends SessionInfo {
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

// =============================================================================
// Session Filter
// =============================================================================

/**
 * Filter options for listing sessions
 */
export interface SessionFilter {
  /** Filter by project path */
  projectPath?: string;
  /** Only sessions after this date */
  afterDate?: Date;
  /** Only sessions before this date */
  beforeDate?: Date;
  /** Maximum number of results */
  limit?: number;
}

// =============================================================================
// Continue/Fork Options
// =============================================================================

/**
 * Options for continuing a session
 */
export interface ContinueOptions {
  /** Agent node identifier for scoping hook events */
  agentId?: string;
  /** Working directory for the session */
  workingDirectory?: string;
  /** Operation timeout in milliseconds */
  timeout?: number;
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
 * Options for checking whether a session can be forked
 */
export interface SessionForkCheckOptions {
  /** Workspace/project path used to locate session storage */
  workspacePath?: string;
}

/**
 * Result of checking whether a session can be forked
 */
export interface SessionForkability {
  /** Whether the session is eligible for forking */
  forkable: boolean;
  /** Optional reason when forking is not allowed */
  reason?: string;
}

// =============================================================================
// JSONL Filter Options (for forking with partial context)
// =============================================================================

/**
 * Options for filtering JSONL content when forking
 * Allows users to include only messages up to a specific point
 */
export interface JsonlFilterOptions {
  /**
   * Filter by message ID (uuid field)
   * Includes all messages up to and including this ID
   */
  targetMessageId?: string;

  /**
   * Filter by timestamp (ISO string or Date)
   * Includes all messages up to and including this timestamp
   */
  targetTimestamp?: string | Date;
}

/**
 * Result of a JSONL filtering operation
 */
export interface JsonlFilterResult {
  /** The filtered lines as a string (ready to write to file) */
  content: string;
  /** Number of lines included */
  includedCount: number;
  /** Number of lines filtered out */
  filteredCount: number;
  /** Whether the target was found (for messageId filtering) */
  targetFound: boolean;
}

/**
 * Message metadata for UI display when selecting filter point
 */
export interface JsonlMessageMetadata {
  /** Message identifier (uuid or messageId) */
  id: string;
  /** ISO timestamp when the message was created */
  timestamp?: string;
  /** Message type (user, assistant, summary, etc.) */
  type?: string;
  /** Preview of message content (truncated) */
  preview?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Helper to create a session identifier by ID
 */
export function sessionById(id: string): SessionIdentifier {
  return { type: 'id', value: id };
}

/**
 * Helper to create a session identifier by name
 */
export function sessionByName(name: string): SessionIdentifier {
  return { type: 'name', value: name };
}

/**
 * Helper to get the latest session
 */
export function latestSession(): SessionIdentifier {
  return { type: 'latest' };
}

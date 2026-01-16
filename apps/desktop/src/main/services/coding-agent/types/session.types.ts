import type { CodingAgentType } from './agent.types';
import type { CodingAgentMessage } from './message.types';

// Re-export types from shared (source of truth)
export type {
  MessageFilterOptions,
  SessionFilterOptions,
  SessionChange,
  ForkOptions,
} from '@agent-orchestrator/shared';

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
 *
 * Note: This is distinct from the shared SessionContent which uses ChatMessage.
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
 * Filter options for listing sessions
 */
export interface SessionFilter {
  projectPath?: string;
  afterDate?: Date;
  beforeDate?: Date;
  limit?: number;
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

/**
 * Coding Agent Types
 *
 * Request/response types for agent generation and session management.
 * These types define the data contracts between renderer and main process.
 */

import type {
  MessageFilterOptions as SharedMessageFilterOptions,
  StreamingBlockType,
  StreamingChunk,
  StreamingContentBlock,
} from '@agent-orchestrator/shared';
import type { AgentType } from '../../../../types/coding-agent-status';

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

// ============================================
// Callback Types
// ============================================

/**
 * Callback for streaming chunks (plain text)
 */
export type StreamCallback = (chunk: string) => void;

/**
 * Callback for structured streaming chunks (content blocks)
 */
export type StructuredStreamCallback = (chunk: StreamingChunk) => void;

// Re-export streaming types for consumers
export type { StreamingBlockType, StreamingChunk, StreamingContentBlock };

// ============================================
// Session Types
// ============================================

/**
 * Session identifier types.
 * Supports lookup by ID, name, or getting the latest session.
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

// ============================================
// Filter Options
// ============================================

/**
 * Filter options for messages.
 * Re-exported from shared package to avoid type drift.
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

// ============================================
// Operation Options
// ============================================

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

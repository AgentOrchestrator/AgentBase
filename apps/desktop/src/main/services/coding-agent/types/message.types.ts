/**
 * Message types for coding agent sessions
 *
 * Re-exports rich type information from shared package and extends
 * with desktop-specific fields.
 */

// Re-export rich message types from shared package
export type {
  MessageType,
  ToolCategory,
  ToolInfo,
  ThinkingInfo,
  McpInfo,
  ErrorInfo,
} from '@agent-orchestrator/shared';

import type {
  MessageType,
  ToolInfo,
  ThinkingInfo,
  McpInfo,
  ErrorInfo,
} from '@agent-orchestrator/shared';

/**
 * Chat message in a session
 * Extended with rich type information for tool calls, thinking, etc.
 */
export interface ChatMessage {
  // =========================================================================
  // Core fields (existing)
  // =========================================================================

  /** Unique message ID */
  id: string;
  /** Message role */
  role: 'user' | 'assistant' | 'system';
  /** Message content (display text) */
  content: string;
  /** ISO timestamp */
  timestamp: string;
  /** Generic metadata */
  metadata?: Record<string, unknown>;

  // =========================================================================
  // Rich type information (NEW)
  // =========================================================================

  /** Rich message type for filtering and display */
  messageType?: MessageType;

  /** Tool-specific information (when messageType is tool_call or tool_result) */
  tool?: ToolInfo;

  /** Thinking/reasoning content (when messageType is thinking/reasoning) */
  thinking?: ThinkingInfo;

  /** MCP-specific information (when messageType is mcp_tool) */
  mcp?: McpInfo;

  /** Error information (when messageType is error) */
  error?: ErrorInfo;

  /** Agent-specific metadata preserved from raw data */
  agentMetadata?: Record<string, unknown>;
}

/**
 * Request to generate a response
 */
export interface GenerateRequest {
  /** The prompt to send to the agent */
  prompt: string;
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
  sessionId?: string;
  /** Unique message ID */
  messageId: string;
  /** When the response was generated */
  timestamp: string;
  /** Token usage if available */
  tokensUsed?: number;
}

/**
 * Callback for streaming output chunks
 */
export type StreamCallback = (chunk: string) => void;

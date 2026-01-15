/**
 * Message types for coding agent sessions
 *
 * Re-exports rich type information from shared package.
 */

// Re-export rich message types from shared package
export type {
  MessageType,
  ToolCategory,
  ToolInfo,
  ThinkingInfo,
  McpInfo,
  ErrorInfo,
  AgentContentBlock,
  AgentTextBlock,
  AgentThinkingBlock,
  AgentRedactedThinkingBlock,
  AgentToolUseBlock,
  AgentServerToolUseBlock,
  AgentWebSearchToolResultBlock,
  AgentWebSearchToolResultContent,
  AgentWebSearchResultBlock,
  AgentWebSearchToolResultError,
  AgentWebSearchToolResultErrorCode,
  CodingAgentMessage,
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

// Shared types that can be used across the monorepo
// Add common interfaces, types, and constants here

import type {
  AgentType,
  ErrorInfo,
  McpInfo,
  MessageType,
  ThinkingInfo,
  ToolInfo,
} from './loaders/types.js';

export type BaseConfig = {};

/**
 * Git repository information
 * Used to display branch, status, and sync state in the UI
 */
export interface GitInfo {
  /** Current branch name */
  branch: string;
  /** Remote name (e.g., 'origin') */
  remote?: string;
  /** Working directory status */
  status: 'clean' | 'dirty' | 'unknown';
  /** Commits ahead of remote */
  ahead: number;
  /** Commits behind remote */
  behind: number;
}

// =============================================================================
// Shared Chat Types
// =============================================================================

export type ChatRole = 'user' | 'assistant' | 'system';

/**
 * Message format for LLM requests
 */
export interface LlmChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** For tool result messages */
  toolCallId?: string;
  /** For tool result messages */
  toolName?: string;
}

// =============================================================================
// Agent Content Blocks (vendor-agnostic rich content)
// =============================================================================

export interface AgentTextBlock {
  type: 'text';
  text: string;
  citations?: unknown[] | null;
}

export interface AgentThinkingBlock {
  type: 'thinking';
  thinking: string;
  signature?: string;
}

export interface AgentRedactedThinkingBlock {
  type: 'redacted_thinking';
  data: string;
}

export interface AgentToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AgentServerToolUseBlock {
  type: 'server_tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type AgentWebSearchToolResultErrorCode =
  | 'invalid_tool_input'
  | 'unavailable'
  | 'max_uses_exceeded'
  | 'too_many_requests'
  | 'query_too_long';

export interface AgentWebSearchToolResultError {
  type: 'web_search_tool_result_error';
  errorCode: AgentWebSearchToolResultErrorCode;
}

export interface AgentWebSearchResultBlock {
  type: 'web_search_result';
  encryptedContent: string;
  pageAge: string | null;
  title: string;
  url: string;
}

export type AgentWebSearchToolResultContent =
  | AgentWebSearchToolResultError
  | AgentWebSearchResultBlock[];

export interface AgentWebSearchToolResultBlock {
  type: 'web_search_tool_result';
  toolUseId: string;
  content: AgentWebSearchToolResultContent;
}

export type AgentContentBlock =
  | AgentTextBlock
  | AgentThinkingBlock
  | AgentRedactedThinkingBlock
  | AgentToolUseBlock
  | AgentServerToolUseBlock
  | AgentWebSearchToolResultBlock;

// =============================================================================
// Streaming Content Blocks (for real-time structured streaming)
// =============================================================================

/**
 * Block types that can be streamed
 */
export type StreamingBlockType = 'text' | 'thinking' | 'tool_use';

/**
 * Represents an in-progress content block during streaming
 */
export interface StreamingContentBlock {
  /** Block index from the API (used to track which block deltas belong to) */
  index: number;
  /** Type of content block */
  type: StreamingBlockType;
  /** Accumulated text content (for text blocks) */
  text?: string;
  /** Accumulated thinking content (for thinking blocks) */
  thinking?: string;
  /** Tool use ID (for tool_use blocks) */
  id?: string;
  /** Tool name (for tool_use blocks) */
  name?: string;
  /** Accumulated JSON string for tool input (for tool_use blocks) */
  input?: string;
  /** Whether this block has been completed */
  isComplete: boolean;
}

/**
 * A streaming chunk event from the SDK
 */
export interface StreamingChunk {
  /** Event type */
  type: 'block_start' | 'block_delta' | 'block_stop';
  /** Block index this chunk applies to */
  index: number;
  /** Block type (only for block_start) */
  blockType?: StreamingBlockType;
  /** Block metadata (only for block_start) */
  block?: {
    type: StreamingBlockType;
    id?: string;
    name?: string;
  };
  /** Delta content (only for block_delta) */
  delta?: {
    text?: string;
    thinking?: string;
    inputJson?: string;
  };
}

/**
 * Message format for coding agent sessions
 */
export interface CodingAgentMessage {
  /** Unique message ID */
  id: string;
  /** Message role */
  role: ChatRole;
  /** Message content (display text) */
  content: string;
  /** Structured content blocks for rich rendering */
  contentBlocks?: AgentContentBlock[];
  /** ISO timestamp */
  timestamp: string;
  /** Generic metadata */
  metadata?: Record<string, unknown>;

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
 * Mentioned user information in chat UIs
 */
export interface MentionedUser {
  id: string;
  email: string;
  display_name: string | null;
  mentionText: string;
  avatar_url?: string | null;
  x_github_name?: string | null;
  x_github_avatar_url?: string | null;
}

/**
 * Message format for web chat UIs
 */
export interface WebChatMessage {
  role: ChatRole;
  content: string;
  timestamp: string;
  mentionedUsers?: MentionedUser[];
}

// =============================================================================
// Agent Action Types (UI-driven actions)
// =============================================================================

export type AgentActionType = 'clarifying_question' | 'tool_approval';

export interface ClarifyingQuestionOption {
  label: string;
  description?: string;
}

export interface ClarifyingQuestion {
  header?: string;
  question: string;
  options?: ClarifyingQuestionOption[];
  multiSelect?: boolean;
}

export interface AgentActionBase {
  id: string;
  type: AgentActionType;
  agentId?: string;
  agentType?: AgentType;
  sessionId?: string;
  workspacePath?: string;
  toolUseId?: string;
  createdAt: string;
}

export interface ClarifyingQuestionAction extends AgentActionBase {
  type: 'clarifying_question';
  questions: ClarifyingQuestion[];
}

export interface ToolApprovalAction extends AgentActionBase {
  type: 'tool_approval';
  toolName: string;
  command?: string;
  filePath?: string;
  workingDirectory?: string;
  reason?: string;
  input?: Record<string, unknown>;
}

export type AgentAction = ClarifyingQuestionAction | ToolApprovalAction;

export type AgentActionResponse =
  | {
      actionId: string;
      type: 'clarifying_question';
      answers: Record<string, string>;
    }
  | {
      actionId: string;
      type: 'tool_approval';
      decision: 'allow' | 'deny';
      message?: string;
    };

// Shared types that can be used across the monorepo
// Add common interfaces, types, and constants here

import type {
  MessageType,
  ToolInfo,
  ThinkingInfo,
  McpInfo,
  ErrorInfo,
  AgentType,
} from './loaders/types.js';

export interface BaseConfig {
  // Add shared configuration types
}

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

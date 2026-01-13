/**
 * Shared type definitions for chat history loaders
 * Used by daemon, desktop, and any other consumer of chat histories
 */

// =============================================================================
// Message Types (Rich type information for all agents)
// =============================================================================

/**
 * Unified message type covering all agent-specific message categories
 * Grouped by semantic meaning rather than agent-specific naming
 */
export type MessageType =
  // Core conversation types
  | 'user' // User input message
  | 'assistant' // AI response message
  // Tool/Action types
  | 'tool_call' // Tool invocation (Bash, Read, Write, Edit, etc.)
  | 'tool_result' // Result from tool execution
  | 'mcp_tool' // MCP (Model Context Protocol) tool call
  // Reasoning types
  | 'thinking' // Internal reasoning/chain-of-thought (Claude extended thinking)
  | 'reasoning' // Codex reasoning blocks
  // System types
  | 'system' // System prompts or context
  | 'summary' // Session summary
  | 'metadata' // Session metadata (start, end, config)
  // Error types
  | 'error'; // Error messages

/**
 * Categorization of tool types for filtering and display
 */
export type ToolCategory =
  | 'file_read' // Read, cat, head, tail
  | 'file_write' // Write, Edit, touch
  | 'file_search' // Glob, Grep, find
  | 'shell' // Bash, terminal commands
  | 'web' // WebFetch, WebSearch
  | 'code_intel' // LSP operations
  | 'mcp' // MCP tool calls
  | 'custom' // Agent-specific custom tools
  | 'unknown';

/**
 * Tool invocation information
 */
export interface ToolInfo {
  /** Tool name (e.g., "Bash", "Read", "Write", "Edit") */
  name: string;
  /** Tool category for filtering */
  category: ToolCategory;
  /** Tool input parameters */
  input?: Record<string, unknown>;
  /** Tool output (for tool_result) */
  output?: string;
  /** Execution status */
  status?: 'pending' | 'success' | 'error';
  /** Execution time in milliseconds */
  duration?: number;
  /** File path for file operations */
  filePath?: string;
  /** Line range for file operations */
  lineRange?: { start: number; end: number };
}

/**
 * Thinking/reasoning block information
 */
export interface ThinkingInfo {
  /** The thinking content */
  content: string;
  /** Whether content was redacted (Claude may redact some thinking) */
  isRedacted?: boolean;
  /** Thinking budget used (tokens) */
  thinkingBudget?: number;
}

/**
 * MCP tool information
 */
export interface McpInfo {
  /** MCP server name */
  serverName: string;
  /** Tool name within the server */
  toolName: string;
  /** Tool input parameters */
  input?: unknown;
  /** Tool output */
  output?: unknown;
}

/**
 * Error information for error messages
 */
export interface ErrorInfo {
  /** Error code */
  code?: string;
  /** Error message */
  message: string;
  /** Stack trace */
  stack?: string;
  /** Whether error is recoverable */
  recoverable?: boolean;
}

// =============================================================================
// Agent Types
// =============================================================================

/**
 * Agent/IDE type that created the session
 */
export type AgentType =
  | 'claude_code'
  | 'codex'
  | 'cursor'
  | 'vscode'
  | 'windsurf'
  | 'factory'
  | 'other';

/**
 * Source identifier for more granular tracking
 */
export type SessionSource =
  | 'claude_code'
  | 'cursor-composer'
  | 'cursor-copilot'
  | 'vscode-chat'
  | 'vscode-inline-chat'
  | 'codex'
  | 'factory'
  | string;

/**
 * Standard message format across all loaders
 * Extended with rich type information while maintaining backward compatibility
 */
export interface ChatMessage {
  // =========================================================================
  // Core fields (backward compatible)
  // =========================================================================

  /** Rendered display content of the message */
  display: string;
  /** Any pasted/attached content (files, images, etc.) */
  pastedContents: Record<string, unknown>;
  /** Message role */
  role?: 'user' | 'assistant' | 'system';
  /** ISO timestamp of the message */
  timestamp?: string;

  // =========================================================================
  // Rich type information (NEW - optional for backward compatibility)
  // =========================================================================

  /** Unique message identifier within the session */
  id?: string;

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

  /** Agent-specific metadata that doesn't fit standard fields */
  agentMetadata?: Record<string, unknown>;
}

/**
 * Standard metadata for all sessions
 * All loaders should populate these fields when available
 */
export interface SessionMetadata {
  /**
   * Full path to the project (file:// URI or absolute path)
   * Used for reference and debugging
   */
  projectPath?: string;

  /**
   * Clean project name extracted from projectPath
   * REQUIRED for automatic project linking
   * Example: "agent-orchestrator", "my-app", etc.
   */
  projectName?: string;

  /**
   * User-defined conversation name (e.g., Cursor Composer feature)
   * Optional, takes precedence over projectName for display
   */
  conversationName?: string;

  /**
   * Workspace/session identifier from the IDE
   * Used for tracking and debugging
   */
  workspaceId?: string;

  /**
   * Source of the session (for tracking)
   */
  source?: SessionSource;

  /**
   * AI-generated summary of the session
   */
  summary?: string;

  /**
   * Additional metadata specific to the loader
   */
  [key: string]: unknown;
}

/**
 * Standard chat history format
 * All loaders must convert their native format to this structure
 */
export interface ChatHistory {
  /** Unique identifier for the session */
  id: string;
  /** ISO timestamp of the session (last activity or creation) */
  timestamp: string;
  /** Array of messages in the session */
  messages: ChatMessage[];
  /** Type of agent/IDE that created this session */
  agent_type: AgentType;
  /** Optional metadata about the session */
  metadata?: SessionMetadata;
}

/**
 * Project information extracted from sessions
 */
export interface ProjectInfo {
  /** Project name (directory name) */
  name: string;
  /** Full path to the project */
  path: string;
  /** Workspace IDs associated with this project */
  workspaceIds: string[];
  /** Number of Cursor Composer sessions */
  composerCount?: number;
  /** Number of Cursor Copilot sessions */
  copilotSessionCount?: number;
  /** Number of Claude Code sessions */
  claudeCodeSessionCount?: number;
  /** Number of VSCode chat sessions */
  vscodeSessionCount?: number;
  /** Number of CodeX sessions */
  codexSessionCount?: number;
  /** Number of Factory sessions */
  factorySessionCount?: number;
  /** ISO timestamp of last activity */
  lastActivity: string;
}

/**
 * Options for reading chat histories
 */
export interface LoaderOptions {
  /** Number of days to look back (default varies by loader) */
  lookbackDays?: number;
  /** Only return sessions modified after this timestamp (Unix ms) */
  sinceTimestamp?: number;
}

// =============================================================================
// Filter Options (NEW)
// =============================================================================

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
}

/**
 * Filter options for listing sessions
 * Extends LoaderOptions with additional filtering capabilities
 */
export interface SessionFilterOptions extends LoaderOptions {
  /** Only sessions with thinking blocks */
  hasThinking?: boolean;
  /** Sessions with at least N tool calls */
  minToolCallCount?: number;
  /** Filter by project name */
  projectName?: string;
  /** Filter by project path */
  projectPath?: string;
}

// =============================================================================
// Session Types (NEW)
// =============================================================================

/**
 * Session summary for efficient listing (without full messages)
 */
export interface SessionSummary {
  /** Session ID */
  id: string;
  /** Agent type that created the session */
  agentType: AgentType;
  /** ISO timestamp of last activity */
  timestamp: string;
  /** Project path */
  projectPath?: string;
  /** Project name */
  projectName?: string;
  /** Total message count */
  messageCount: number;
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
 * Full session content including messages
 */
export interface SessionContent {
  /** Session ID */
  id: string;
  /** Agent type that created the session */
  agentType: AgentType;
  /** ISO timestamp of last activity */
  timestamp: string;
  /** Session metadata */
  metadata?: SessionMetadata;
  /** Full message array */
  messages: ChatMessage[];
  /** Total message count */
  messageCount: number;
}

/**
 * Session change event for watch notifications
 */
export interface SessionChange {
  /** Type of change */
  type: 'created' | 'updated' | 'deleted';
  /** Session ID */
  sessionId: string;
  /** Timestamp of the change (Unix ms) */
  timestamp: number;
  /** Project path if known */
  projectPath?: string;
}

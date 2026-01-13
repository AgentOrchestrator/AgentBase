/**
 * Shared type definitions for chat history loaders
 * Used by daemon, desktop, and any other consumer of chat histories
 */

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
 */
export interface ChatMessage {
  /** Rendered display content of the message */
  display: string;
  /** Any pasted/attached content (files, images, etc.) */
  pastedContents: Record<string, unknown>;
  /** Message role */
  role?: 'user' | 'assistant';
  /** ISO timestamp of the message */
  timestamp?: string;
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

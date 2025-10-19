/**
 * Shared type definitions for session readers
 * This ensures consistency across Claude Code, Cursor, and other readers
 */

/**
 * Agent/IDE type that created the session
 */
export type AgentType = 'claude_code' | 'codex' | 'cursor' | 'windsurf' | 'other';

/**
 * Standard message format across all readers
 */
export interface ChatMessage {
  display: string;
  pastedContents: Record<string, any>;
  role?: 'user' | 'assistant';
  timestamp?: string;
}

/**
 * Standard metadata for all sessions
 * All readers should populate these fields when available
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
   * Example: "agent-orchestrator", "mercura", etc.
   */
  projectName?: string;

  /**
   * User-defined conversation name (Cursor Composer feature)
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
  source?: 'claude_code' | 'cursor-composer' | 'cursor-copilot' | string;

  /**
   * AI-generated summary of the session
   */
  summary?: string;

  /**
   * Additional metadata specific to the reader
   */
  [key: string]: any;
}

/**
 * Standard chat history format
 * All readers must convert their native format to this structure
 */
export interface ChatHistory {
  id: string;
  timestamp: string;
  messages: ChatMessage[];
  agent_type: AgentType;
  metadata?: SessionMetadata;
}

/**
 * Project information extracted from sessions
 */
export interface ProjectInfo {
  name: string;
  path: string;
  workspaceIds: string[];
  composerCount?: number;
  copilotSessionCount?: number;
  claudeCodeSessionCount?: number;
  lastActivity: string;
}

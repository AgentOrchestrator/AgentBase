/**
 * Types for JSONL parsing utilities
 */

import type { ChatMessage } from '../loaders/types.js';
import type { AgentContentBlock, CodingAgentMessage } from '../types.js';

// =============================================================================
// Claude Code JSONL Input Types
// =============================================================================

/**
 * Raw JSONL line structure from Claude Code session files (.jsonl)
 * This represents the unprocessed structure as stored on disk
 */
export interface ClaudeCodeJsonlLine {
  /** Line type: 'user', 'assistant', 'summary', 'file-history-snapshot', etc. */
  type?: string;

  /** Message content (for user/assistant lines) */
  message?: {
    role: string;
    content: unknown;
    /** Model identifier for assistant messages */
    model?: string;
    /** Message ID from the API */
    id?: string;
    /** Message type from API */
    type?: string;
  };

  /** Timestamp (ISO string or Unix ms) */
  timestamp?: string | number;

  /** Session identifier */
  sessionId?: string;

  /** Summary text (for summary lines) */
  summary?: string;

  /** Message UUID */
  uuid?: string;

  /** Parent message UUID for conversation threading */
  parentUuid?: string | null;

  /** Leaf UUID for summary lines */
  leafUuid?: string;

  /** Current working directory */
  cwd?: string;

  /** Project path */
  project?: string;

  /** Git branch name */
  gitBranch?: string;

  /** Claude Code version */
  version?: string;

  /** User type: 'external', etc. */
  userType?: string;

  /** Request ID for assistant messages */
  requestId?: string;

  /** Whether this is a sidechain message */
  isSidechain?: boolean;

  /** Display content (legacy format) */
  display?: string;

  /** Pasted/attached content (legacy format) */
  pastedContents?: Record<string, unknown>;

  /** Thinking metadata */
  thinkingMetadata?: {
    level?: string;
    disabled?: boolean;
    triggers?: unknown[];
  };

  /** Todo items */
  todos?: unknown[];
}

// =============================================================================
// TodoWrite Types
// =============================================================================

/**
 * Raw todo item as stored in JSONL TodoWrite tool_use blocks
 */
export interface RawTodoItem {
  /** Description of the task */
  content: string;
  /** Task status: pending, in_progress, or completed */
  status: 'pending' | 'in_progress' | 'completed';
  /** Optional active/in-progress form of the description */
  activeForm?: string;
}

/**
 * Result from extracting todos from JSONL content
 */
export interface ExtractedTodoList {
  /** The todo items */
  items: RawTodoItem[];
  /** Timestamp of the TodoWrite call */
  timestamp?: string;
}

// =============================================================================
// Parser Options and Results
// =============================================================================

/**
 * Options for parsing JSONL lines
 */
export interface JsonlParseOptions {
  /**
   * Custom ID generator function
   * Default: crypto.randomUUID() if available, fallback to timestamp-based ID
   */
  generateId?: () => string;
}

/**
 * Result from parsing content blocks
 */
export interface ParsedContentBlocks {
  /** Structured content blocks */
  blocks: AgentContentBlock[];
  /** Concatenated display text */
  displayText: string;
}

/**
 * Result from parsing a JSONL line to rich message format
 */
export interface ParsedJsonlLine {
  /** The parsed messages (a single line can produce 0-N messages) */
  messages: CodingAgentMessage[];
  /** Session ID if found in line */
  sessionId?: string;
  /** Summary text if this is a summary line */
  summary?: string;
  /** Message UUID if present */
  uuid?: string;
}

/**
 * Result from parsing a JSONL line to simple chat message format
 */
export interface ParsedChatLine {
  /** The parsed messages */
  messages: ChatMessage[];
  /** Session ID if found in line */
  sessionId?: string;
  /** Summary text if this is a summary line */
  summary?: string;
}

/**
 * Parser utilities for JSONL and other formats
 *
 * Provides reusable parsing logic for Claude Code session files
 * and other structured data formats.
 */

// =============================================================================
// Types
// =============================================================================

export type {
  ClaudeCodeJsonlLine,
  ExtractedTodoList,
  JsonlParseOptions,
  ParsedChatLine,
  ParsedContentBlocks,
  ParsedJsonlLine,
  RawTodoItem,
} from './types.js';

// =============================================================================
// Unified Claude Code Parser (Recommended API)
// =============================================================================

export {
  ClaudeCodeJsonlParser,
  claudeCodeParser,
  type ParsedSession,
  type SessionStats,
} from './claude-code-parser.js';

// =============================================================================
// Low-level Claude Code JSONL Functions
// =============================================================================

export {
  extractDisplayContent,
  parseJsonlLineString,
  parseJsonlLinesToChatMessages,
  parseJsonlLinesToRichMessages,
  parseJsonlToChatMessages,
  parseJsonlToRichMessages,
} from './claude-code-jsonl.js';

// =============================================================================
// Content Block Parser
// =============================================================================

export {
  type ContentBlockParseOptions,
  isWebSearchToolResultErrorCode,
  parseContentBlocks,
  parseWebSearchToolResultContent,
} from './content-blocks.js';

// =============================================================================
// JSONL File Manipulation
// =============================================================================

export { JSONLFile, type JSONLFileReplaceOptions } from './JSONLFile.js';

// =============================================================================
// Utilities
// =============================================================================

export { categorizeToolByName } from './tool-categorizer.js';

// =============================================================================
// Todo Extraction
// =============================================================================

export {
  extractLatestTodoList,
  extractTodosFromJsonlLine,
  toTodoListProgress,
} from './todo-extractor.js';

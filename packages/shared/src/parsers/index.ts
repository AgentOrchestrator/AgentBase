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
  JsonlParseOptions,
  ParsedContentBlocks,
  ParsedJsonlLine,
  ParsedChatLine,
} from './types.js';

// =============================================================================
// Unified Claude Code Parser (Recommended API)
// =============================================================================

export {
  ClaudeCodeJsonlParser,
  claudeCodeParser,
  type SessionStats,
  type ParsedSession,
} from './claude-code-parser.js';

// =============================================================================
// Low-level Claude Code JSONL Functions
// =============================================================================

export {
  parseJsonlLineString,
  parseJsonlToRichMessages,
  parseJsonlToChatMessages,
  parseJsonlLinesToRichMessages,
  parseJsonlLinesToChatMessages,
  extractDisplayContent,
} from './claude-code-jsonl.js';

// =============================================================================
// Content Block Parser
// =============================================================================

export {
  parseContentBlocks,
  parseWebSearchToolResultContent,
  isWebSearchToolResultErrorCode,
  type ContentBlockParseOptions,
} from './content-blocks.js';

// =============================================================================
// JSONL File Manipulation
// =============================================================================

export { JSONLFile, type JSONLFileReplaceOptions } from './JSONLFile.js';

// =============================================================================
// Utilities
// =============================================================================

export { categorizeToolByName } from './tool-categorizer.js';

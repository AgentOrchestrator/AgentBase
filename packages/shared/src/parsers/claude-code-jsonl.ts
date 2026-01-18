/**
 * Claude Code JSONL parser
 *
 * Parses Claude Code session .jsonl files into typed message structures.
 * Provides two output formats:
 * - Rich format (CodingAgentMessage) for desktop app with full content blocks
 * - Simple format (ChatMessage) for daemon with display text only
 */

import type { ChatMessage } from '../loaders/types.js';
import { normalizeTimestamp } from '../loaders/utilities.js';
import type { CodingAgentMessage } from '../types.js';
import { parseContentBlocks } from './content-blocks.js';
import type {
  ClaudeCodeJsonlLine,
  JsonlParseOptions,
  ParsedChatLine,
  ParsedJsonlLine,
} from './types.js';

// =============================================================================
// ID Generation
// =============================================================================

/**
 * Default ID generator
 * Uses crypto.randomUUID if available, falls back to timestamp-based ID
 */
const defaultGenerateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

// =============================================================================
// Low-level Parsing
// =============================================================================

/**
 * Parse a JSONL line string into a ClaudeCodeJsonlLine object
 *
 * @param line - Raw line string from .jsonl file
 * @returns Parsed object or null if parsing fails
 */
export function parseJsonlLineString(line: string): ClaudeCodeJsonlLine | null {
  try {
    const trimmed = line.trim();
    if (!trimmed) return null;
    return JSON.parse(trimmed) as ClaudeCodeJsonlLine;
  } catch {
    return null;
  }
}

// =============================================================================
// Rich Message Parsing (for Desktop App)
// =============================================================================

/**
 * Parse a JSONL line to rich CodingAgentMessage format
 *
 * Used by desktop app for full-featured message display with content blocks.
 *
 * @param data - Parsed JSONL line object
 * @param options - Parse options (optional)
 * @returns Parsed result with messages, sessionId, and summary
 */
export function parseJsonlToRichMessages(
  data: ClaudeCodeJsonlLine,
  options?: JsonlParseOptions
): ParsedJsonlLine {
  const generateId = options?.generateId ?? defaultGenerateId;
  const messages: CodingAgentMessage[] = [];
  const timestamp = normalizeTimestamp(data.timestamp);

  // Handle summary lines
  if (data.type === 'summary' && data.summary) {
    return {
      messages,
      sessionId: data.sessionId,
      summary: data.summary,
      uuid: data.leafUuid,
    };
  }

  // Skip non-message lines
  if (!data.message?.content) {
    return { messages, sessionId: data.sessionId, uuid: data.uuid };
  }

  // Parse user and assistant messages
  if (data.type === 'user' || data.type === 'assistant') {
    const { blocks, displayText } = parseContentBlocks(data.message.content, { generateId });

    if (!displayText && blocks.length === 0) {
      return { messages, sessionId: data.sessionId, uuid: data.uuid };
    }

    messages.push({
      id: data.uuid || generateId(),
      role: data.type,
      content: displayText,
      contentBlocks: blocks.length > 0 ? blocks : undefined,
      timestamp,
      messageType: data.type,
      agentMetadata: {
        rawType: data.type,
        parentUuid: data.parentUuid,
        cwd: data.cwd,
        gitBranch: data.gitBranch,
        version: data.version,
      },
    });
  }

  return { messages, sessionId: data.sessionId, uuid: data.uuid };
}

// =============================================================================
// Simple Message Parsing (for Daemon)
// =============================================================================

/**
 * Parse a JSONL line to simple ChatMessage format
 *
 * Used by daemon for basic message display without content blocks.
 *
 * @param data - Parsed JSONL line object
 * @param options - Parse options (optional)
 * @returns Parsed result with messages, sessionId, and summary
 */
export function parseJsonlToChatMessages(
  data: ClaudeCodeJsonlLine,
  options?: JsonlParseOptions
): ParsedChatLine {
  const generateId = options?.generateId ?? defaultGenerateId;
  const messages: ChatMessage[] = [];
  const timestamp = normalizeTimestamp(data.timestamp);

  // Handle summary lines
  if (data.type === 'summary' && data.summary) {
    return { messages, sessionId: data.sessionId, summary: data.summary };
  }

  // Skip non-message lines
  if (!data.message?.content) {
    return { messages, sessionId: data.sessionId };
  }

  // Parse user and assistant messages
  if (data.type === 'user' || data.type === 'assistant') {
    const displayText = extractDisplayContent(data.message.content);

    if (displayText) {
      messages.push({
        id: data.uuid || generateId(),
        display: displayText,
        pastedContents: data.pastedContents || {},
        role: data.type,
        timestamp,
        messageType: data.type,
        agentMetadata: {
          rawType: data.type,
          cwd: data.cwd,
          gitBranch: data.gitBranch,
        },
      });
    }
  }

  return { messages, sessionId: data.sessionId };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Extract display text from content without creating content blocks
 *
 * Simple extraction that only pulls text content, ignoring tool blocks,
 * thinking blocks, etc.
 *
 * @param content - Raw content from JSONL message
 * @returns Concatenated display text
 */
export function extractDisplayContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    const textParts: string[] = [];
    for (const part of content) {
      if (typeof part === 'string') {
        textParts.push(part);
      } else if (typeof part === 'object' && part !== null) {
        const obj = part as Record<string, unknown>;
        if (obj.type === 'text' && typeof obj.text === 'string') {
          textParts.push(obj.text);
        }
      }
    }
    return textParts.join('\n');
  }

  return '';
}

/**
 * Parse multiple JSONL lines to rich messages
 *
 * Convenience function for parsing an array of lines.
 *
 * @param lines - Array of raw JSONL line strings
 * @param options - Parse options (optional)
 * @returns Array of parsed messages and extracted metadata
 */
export function parseJsonlLinesToRichMessages(
  lines: string[],
  options?: JsonlParseOptions
): {
  messages: CodingAgentMessage[];
  sessionId?: string;
  summary?: string;
} {
  const allMessages: CodingAgentMessage[] = [];
  let sessionId: string | undefined;
  let summary: string | undefined;

  for (const line of lines) {
    const data = parseJsonlLineString(line);
    if (!data) continue;

    const result = parseJsonlToRichMessages(data, options);

    if (result.sessionId) sessionId = result.sessionId;
    if (result.summary) summary = result.summary;

    allMessages.push(...result.messages);
  }

  return { messages: allMessages, sessionId, summary };
}

/**
 * Parse multiple JSONL lines to chat messages
 *
 * Convenience function for parsing an array of lines.
 *
 * @param lines - Array of raw JSONL line strings
 * @param options - Parse options (optional)
 * @returns Array of parsed messages and extracted metadata
 */
export function parseJsonlLinesToChatMessages(
  lines: string[],
  options?: JsonlParseOptions
): {
  messages: ChatMessage[];
  sessionId?: string;
  summary?: string;
} {
  const allMessages: ChatMessage[] = [];
  let sessionId: string | undefined;
  let summary: string | undefined;

  for (const line of lines) {
    const data = parseJsonlLineString(line);
    if (!data) continue;

    const result = parseJsonlToChatMessages(data, options);

    if (result.sessionId) sessionId = result.sessionId;
    if (result.summary) summary = result.summary;

    allMessages.push(...result.messages);
  }

  return { messages: allMessages, sessionId, summary };
}

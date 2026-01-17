/**
 * Unified Claude Code JSONL Parser
 *
 * High-level API for parsing Claude Code session files.
 * Provides methods for both summary extraction and full message parsing.
 */

import type { ChatMessage } from '../loaders/types.js';
import { normalizeTimestamp } from '../loaders/utilities.js';
import type { CodingAgentMessage } from '../types.js';
import { parseContentBlocks } from './content-blocks.js';
import type { ClaudeCodeJsonlLine, JsonlParseOptions } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Session summary statistics extracted from JSONL
 */
export interface SessionStats {
  /** Total message count (user + assistant) */
  messageCount: number;
  /** Number of tool_use blocks */
  toolCallCount: number;
  /** Whether session contains thinking blocks */
  hasThinking: boolean;
  /** First user message content (for preview) */
  firstUserMessage?: string;
  /** Last assistant message content (for preview) */
  lastAssistantMessage?: string;
  /** Last timestamp found in session */
  lastTimestamp?: string;
  /** Session ID if found */
  sessionId?: string;
  /** Summary text if found */
  summary?: string;
}

/**
 * Result from parsing session content
 */
export interface ParsedSession {
  /** All parsed messages */
  messages: CodingAgentMessage[];
  /** Session ID if found */
  sessionId?: string;
  /** Summary text if found */
  summary?: string;
}

// =============================================================================
// Default ID Generator
// =============================================================================

const defaultGenerateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

// =============================================================================
// Claude Code JSONL Parser Class
// =============================================================================

/**
 * Unified parser for Claude Code JSONL session files
 *
 * @example
 * ```typescript
 * const parser = new ClaudeCodeJsonlParser();
 *
 * // Parse file content for stats (lightweight)
 * const stats = parser.parseStats(fileContent);
 *
 * // Parse file content for full messages
 * const { messages } = parser.parseMessages(fileContent);
 *
 * // Stream messages one at a time
 * for (const msg of parser.streamMessages(fileContent)) {
 *   console.log(msg);
 * }
 * ```
 */
export class ClaudeCodeJsonlParser {
  private readonly generateId: () => string;

  constructor(options?: JsonlParseOptions) {
    this.generateId = options?.generateId ?? defaultGenerateId;
  }

  // ===========================================================================
  // Line Parsing
  // ===========================================================================

  /**
   * Parse a single JSONL line string
   */
  parseLine(line: string): ClaudeCodeJsonlLine | null {
    try {
      const trimmed = line.trim();
      if (!trimmed) return null;
      return JSON.parse(trimmed) as ClaudeCodeJsonlLine;
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // Stats Extraction (Lightweight)
  // ===========================================================================

  /**
   * Extract session statistics without full message parsing
   *
   * Use this for session listings where you only need counts and previews.
   */
  parseStats(content: string): SessionStats {
    const lines = content.trim().split('\n');
    const stats: SessionStats = {
      messageCount: 0,
      toolCallCount: 0,
      hasThinking: false,
    };

    for (const line of lines) {
      const data = this.parseLine(line);
      if (!data) continue;

      // Extract session ID and summary
      if (data.sessionId) stats.sessionId = data.sessionId;
      if (data.type === 'summary' && data.summary) stats.summary = data.summary;

      // Track timestamp
      if (data.timestamp) {
        stats.lastTimestamp = normalizeTimestamp(data.timestamp);
      }

      // Process user messages
      if (data.type === 'user' && data.message?.content) {
        stats.messageCount++;
        if (!stats.firstUserMessage) {
          stats.firstUserMessage = this.extractDisplayText(data.message.content);
        }
      }

      // Process assistant messages
      if (data.type === 'assistant' && data.message?.content) {
        stats.messageCount++;
        const display = this.extractDisplayText(data.message.content);
        if (display) stats.lastAssistantMessage = display;

        // Count tool uses and check for thinking
        if (Array.isArray(data.message.content)) {
          for (const part of data.message.content) {
            if (typeof part === 'object' && part !== null) {
              const type = (part as Record<string, unknown>).type;
              if (type === 'tool_use') stats.toolCallCount++;
              if (type === 'thinking') stats.hasThinking = true;
            }
          }
        }
      }
    }

    return stats;
  }

  // ===========================================================================
  // Full Message Parsing
  // ===========================================================================

  /**
   * Parse all messages from session content
   *
   * Use this when you need the full message structures with content blocks.
   */
  parseMessages(content: string): ParsedSession {
    const lines = content.trim().split('\n');
    const messages: CodingAgentMessage[] = [];
    let sessionId: string | undefined;
    let summary: string | undefined;

    for (const line of lines) {
      const data = this.parseLine(line);
      if (!data) continue;

      // Extract metadata
      if (data.sessionId) sessionId = data.sessionId;
      if (data.type === 'summary' && data.summary) summary = data.summary;

      // Parse message content
      const parsedMessages = this.parseJsonlLineToMessages(data);
      messages.push(...parsedMessages);
    }

    return { messages, sessionId, summary };
  }

  /**
   * Generator for streaming messages one at a time
   *
   * Use this for memory-efficient processing of large sessions.
   */
  *streamMessages(content: string): Generator<CodingAgentMessage, void, unknown> {
    const lines = content.trim().split('\n');

    for (const line of lines) {
      const data = this.parseLine(line);
      if (!data) continue;

      const messages = this.parseJsonlLineToMessages(data);
      for (const msg of messages) {
        yield msg;
      }
    }
  }

  // ===========================================================================
  // Simple Chat Message Parsing (for Daemon)
  // ===========================================================================

  /**
   * Parse to simple ChatMessage format
   *
   * Use this for daemon sync where you don't need content blocks.
   */
  parseToChatMessages(content: string): {
    messages: ChatMessage[];
    sessionId?: string;
    summary?: string;
  } {
    const lines = content.trim().split('\n');
    const messages: ChatMessage[] = [];
    let sessionId: string | undefined;
    let summary: string | undefined;

    for (const line of lines) {
      const data = this.parseLine(line);
      if (!data) continue;

      if (data.sessionId) sessionId = data.sessionId;
      if (data.type === 'summary' && data.summary) summary = data.summary;

      if ((data.type === 'user' || data.type === 'assistant') && data.message?.content) {
        // Skip user messages that contain only tool_result content
        if (data.type === 'user' && this.isToolResultOnlyMessage(data.message.content)) {
          continue;
        }

        const displayText = this.extractDisplayText(data.message.content);
        if (displayText) {
          messages.push({
            id: data.uuid || this.generateId(),
            display: displayText,
            pastedContents: data.pastedContents || {},
            role: data.type,
            timestamp: normalizeTimestamp(data.timestamp),
            messageType: data.type,
            agentMetadata: {
              rawType: data.type,
              cwd: data.cwd,
              gitBranch: data.gitBranch,
            },
          });
        }
      }
    }

    return { messages, sessionId, summary };
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Check if message content contains only tool_result blocks (not actual user input).
   * These are automatic responses to tool_use and should not be displayed in chat.
   */
  private isToolResultOnlyMessage(content: unknown): boolean {
    if (!Array.isArray(content)) return false;
    if (content.length === 0) return false;

    for (const item of content) {
      // If there's a plain string, it's actual user text
      if (typeof item === 'string') return false;

      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        // If any content block is NOT tool_result, keep the message
        if (obj.type !== 'tool_result') return false;
      }
    }

    // All content items are tool_result - skip this message
    return true;
  }

  /**
   * Parse a single JSONL line to CodingAgentMessage array
   */
  private parseJsonlLineToMessages(data: ClaudeCodeJsonlLine): CodingAgentMessage[] {
    const messages: CodingAgentMessage[] = [];

    if (!data.message?.content) return messages;
    if (data.type !== 'user' && data.type !== 'assistant') return messages;

    // Skip user messages that contain only tool_result content (not actual user input)
    if (data.type === 'user' && this.isToolResultOnlyMessage(data.message.content)) {
      return messages;
    }

    const { blocks, displayText } = parseContentBlocks(data.message.content, {
      generateId: this.generateId,
    });

    if (!displayText && blocks.length === 0) return messages;

    messages.push({
      id: data.uuid || this.generateId(),
      role: data.type,
      content: displayText,
      contentBlocks: blocks.length > 0 ? blocks : undefined,
      timestamp: normalizeTimestamp(data.timestamp),
      messageType: data.type,
      agentMetadata: {
        rawType: data.type,
        parentUuid: data.parentUuid,
        cwd: data.cwd,
        gitBranch: data.gitBranch,
        version: data.version,
      },
    });

    return messages;
  }

  /**
   * Extract display text from content (lightweight, no block parsing)
   */
  private extractDisplayText(content: unknown): string {
    if (typeof content === 'string') return content;

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
}

// =============================================================================
// Singleton Instance for Convenience
// =============================================================================

/**
 * Default parser instance
 *
 * Use this for quick parsing without creating an instance.
 */
export const claudeCodeParser = new ClaudeCodeJsonlParser();

/**
 * Filter Module for JSONL session files
 *
 * Provides filtering capabilities for Claude Code JSONL session files,
 * allowing users to include only messages up to a specific point when forking.
 */

import type { FilterOptions, FilterResult, MessageMetadata, ParsedJsonlLine } from './types';

/**
 * Parse a JSONL line into a structured object for filtering
 */
function parseJsonlLine(line: string): ParsedJsonlLine | null {
  const trimmedLine = line.trim();
  if (!trimmedLine) {
    return null;
  }

  try {
    const data = JSON.parse(trimmedLine);
    return {
      uuid: data.uuid,
      messageId: data.messageId,
      timestamp: data.timestamp ?? data.snapshot?.timestamp,
      parentUuid: data.parentUuid,
      type: data.type,
      _rawLine: line,
    };
  } catch {
    // If parsing fails, return a minimal object with just the raw line
    return {
      _rawLine: line,
    };
  }
}

/**
 * Check if a message matches the target message ID
 * Only matches on uuid for user/assistant messages to avoid matching
 * file-history-snapshot or other metadata entries that may share the same messageId
 */
function matchesMessageId(message: ParsedJsonlLine, targetId: string): boolean {
  // Only match uuid for actual conversation messages (user/assistant)
  // file-history-snapshot and other types may share messageId but shouldn't be the filter target
  if (message.type === 'user' || message.type === 'assistant') {
    return message.uuid === targetId;
  }
  // For other types, don't match (they're metadata, not conversation messages)
  return false;
}

/**
 * Check if a message's timestamp is at or before the target timestamp
 */
function isAtOrBeforeTimestamp(message: ParsedJsonlLine, targetTimestamp: Date): boolean {
  if (!message.timestamp) {
    // Messages without timestamps are included (like summaries at the start)
    return true;
  }

  const messageTime = new Date(message.timestamp);
  return messageTime <= targetTimestamp;
}

/**
 * Filter JSONL content by message ID
 *
 * Includes all messages up to and including the message with the target ID.
 * Preserves the order of messages in the file.
 *
 * @param content - Raw JSONL content (newline-separated JSON objects)
 * @param targetMessageId - The message ID to filter up to (inclusive)
 * @returns FilterResult with the filtered content
 */
export function filterByMessageId(content: string, targetMessageId: string): FilterResult {
  const lines = content.split('\n');
  const includedLines: string[] = [];
  let targetFound = false;

  for (const line of lines) {
    const message = parseJsonlLine(line);

    if (!message) {
      // Preserve empty lines up until we find the target
      if (!targetFound) {
        includedLines.push(line);
      }
      continue;
    }

    includedLines.push(line);

    if (matchesMessageId(message, targetMessageId)) {
      targetFound = true;
      break;
    }
  }

  const includedNonEmpty = includedLines.filter((l) => l.trim()).length;
  const totalNonEmpty = lines.filter((l) => l.trim()).length;

  return {
    content: includedLines.join('\n'),
    includedCount: includedNonEmpty,
    filteredCount: totalNonEmpty - includedNonEmpty,
    targetFound,
  };
}

/**
 * Filter JSONL content by timestamp
 *
 * Includes all messages with timestamps at or before the target timestamp.
 * Messages without timestamps (like summaries) are always included.
 *
 * @param content - Raw JSONL content (newline-separated JSON objects)
 * @param targetTimestamp - The timestamp to filter up to (inclusive)
 * @returns FilterResult with the filtered content
 */
export function filterByTimestamp(content: string, targetTimestamp: string | Date): FilterResult {
  const target = typeof targetTimestamp === 'string' ? new Date(targetTimestamp) : targetTimestamp;

  const lines = content.split('\n');
  const includedLines: string[] = [];
  let lastIncludedHadTimestamp = false;

  for (const line of lines) {
    const message = parseJsonlLine(line);

    if (!message) {
      // Preserve empty lines
      includedLines.push(line);
      continue;
    }

    if (isAtOrBeforeTimestamp(message, target)) {
      includedLines.push(line);
      if (message.timestamp) {
        lastIncludedHadTimestamp = true;
      }
    }
  }

  const includedCount = includedLines.filter((l) => l.trim()).length;
  const totalCount = lines.filter((l) => l.trim()).length;

  return {
    content: includedLines.join('\n'),
    includedCount,
    filteredCount: totalCount - includedCount,
    targetFound: lastIncludedHadTimestamp,
  };
}

/**
 * Filter JSONL content based on provided options
 *
 * @param content - Raw JSONL content
 * @param options - Filter options (messageId or timestamp)
 * @returns FilterResult with the filtered content
 */
export function filterJsonl(content: string, options: FilterOptions): FilterResult {
  if (options.targetMessageId) {
    return filterByMessageId(content, options.targetMessageId);
  }

  if (options.targetTimestamp) {
    return filterByTimestamp(content, options.targetTimestamp);
  }

  // No filtering - return all content
  const lines = content.split('\n');
  const nonEmptyCount = lines.filter((l) => l.trim()).length;

  return {
    content,
    includedCount: nonEmptyCount,
    filteredCount: 0,
    targetFound: true,
  };
}

/**
 * Extract message metadata from JSONL content for UI display
 *
 * @param content - Raw JSONL content
 * @returns Array of message metadata for messages that have identifiers
 */
export function extractMessageMetadata(content: string): MessageMetadata[] {
  const lines = content.split('\n');
  const metadata: MessageMetadata[] = [];

  for (const line of lines) {
    const message = parseJsonlLine(line);
    if (!message) continue;

    const id = message.uuid ?? message.messageId;
    if (!id) continue;

    // Extract a preview from the message content if available
    let preview: string | undefined;
    try {
      const data = JSON.parse(line);
      if (data.message?.content) {
        const contentStr =
          typeof data.message.content === 'string'
            ? data.message.content
            : JSON.stringify(data.message.content);
        preview = contentStr.slice(0, 100) + (contentStr.length > 100 ? '...' : '');
      } else if (data.summary) {
        preview = data.summary;
      }
    } catch {
      // Ignore parsing errors for preview
    }

    metadata.push({
      id,
      timestamp: message.timestamp,
      type: message.type,
      preview,
    });
  }

  return metadata;
}

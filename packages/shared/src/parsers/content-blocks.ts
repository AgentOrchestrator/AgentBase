/**
 * Content block parsing utilities
 *
 * Parses raw content (string, array, or object) into typed AgentContentBlock[]
 */

import type {
  AgentContentBlock,
  AgentWebSearchResultBlock,
  AgentWebSearchToolResultContent,
  AgentWebSearchToolResultErrorCode,
} from '../types.js';

/**
 * Options for parsing content blocks
 */
export interface ContentBlockParseOptions {
  /** ID generator function for blocks that need IDs */
  generateId: () => string;
}

/**
 * Parse content (string, array, or object) into AgentContentBlock[]
 *
 * Handles all content block types:
 * - text blocks (with optional citations)
 * - thinking blocks
 * - redacted_thinking blocks
 * - tool_use blocks
 * - server_tool_use blocks
 * - web_search_tool_result blocks
 * - tool_result blocks (converted to text)
 *
 * @param content - Raw content from JSONL message
 * @param options - Parse options including ID generator
 * @returns Parsed blocks and concatenated display text
 */
export function parseContentBlocks(
  content: unknown,
  options: ContentBlockParseOptions
): { blocks: AgentContentBlock[]; displayText: string } {
  const { generateId } = options;
  const blocks: AgentContentBlock[] = [];
  const textParts: string[] = [];

  const pushTextBlock = (text: string, citations?: unknown[] | null) => {
    const normalized = String(text);
    if (!normalized) return;
    blocks.push({ type: 'text', text: normalized, citations });
    textParts.push(normalized);
  };

  const parseToolInput = (input: unknown): Record<string, unknown> => {
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      return input as Record<string, unknown>;
    }
    return {};
  };

  const parseBlock = (part: unknown) => {
    if (typeof part === 'string') {
      pushTextBlock(part);
      return;
    }

    if (!part || typeof part !== 'object') return;

    const obj = part as Record<string, unknown>;
    const type = obj.type;

    switch (type) {
      case 'text':
        if (typeof obj.text === 'string') {
          const citations = Array.isArray(obj.citations)
            ? obj.citations
            : obj.citations === null
              ? null
              : undefined;
          pushTextBlock(obj.text, citations);
        }
        break;

      case 'thinking':
        if (typeof obj.thinking === 'string') {
          blocks.push({
            type: 'thinking',
            thinking: obj.thinking,
            signature: typeof obj.signature === 'string' ? obj.signature : undefined,
          });
        }
        break;

      case 'redacted_thinking':
        if (typeof obj.data === 'string') {
          blocks.push({ type: 'redacted_thinking', data: obj.data });
        }
        break;

      case 'tool_use':
      case 'server_tool_use': {
        const id = typeof obj.id === 'string' ? obj.id : generateId();
        const name = typeof obj.name === 'string' ? obj.name : 'unknown';
        const input = parseToolInput(obj.input);
        if (type === 'tool_use') {
          blocks.push({ type: 'tool_use', id, name, input });
        } else {
          blocks.push({ type: 'server_tool_use', id, name, input });
        }
        break;
      }

      case 'web_search_tool_result': {
        const toolUseId =
          typeof obj.tool_use_id === 'string'
            ? obj.tool_use_id
            : typeof obj.toolUseId === 'string'
              ? obj.toolUseId
              : generateId();
        const parsedContent = parseWebSearchToolResultContent(obj.content);
        if (parsedContent) {
          blocks.push({
            type: 'web_search_tool_result',
            toolUseId,
            content: parsedContent,
          });
        }
        break;
      }

      case 'tool_result':
        if (obj.content !== undefined) {
          pushTextBlock(String(obj.content));
        }
        break;
    }
  };

  if (typeof content === 'string') {
    pushTextBlock(content);
  } else if (Array.isArray(content)) {
    for (const part of content) {
      parseBlock(part);
    }
  } else {
    parseBlock(content);
  }

  return {
    blocks,
    displayText: textParts.join('\n'),
  };
}

/**
 * Parse web search tool result content
 *
 * Handles two formats:
 * 1. Array of web_search_result entries
 * 2. web_search_tool_result_error object
 *
 * @param content - Raw content from web search tool result
 * @returns Parsed content or null if invalid
 */
export function parseWebSearchToolResultContent(
  content: unknown
): AgentWebSearchToolResultContent | null {
  // Handle array of search results
  if (Array.isArray(content)) {
    const results: AgentWebSearchResultBlock[] = [];
    for (const entry of content) {
      if (!entry || typeof entry !== 'object') continue;
      const obj = entry as Record<string, unknown>;
      if (obj.type !== 'web_search_result') continue;
      if (typeof obj.title !== 'string' || typeof obj.url !== 'string') continue;
      results.push({
        type: 'web_search_result',
        encryptedContent: typeof obj.encrypted_content === 'string' ? obj.encrypted_content : '',
        pageAge: typeof obj.page_age === 'string' ? obj.page_age : null,
        title: obj.title,
        url: obj.url,
      });
    }
    return results.length > 0 ? results : null;
  }

  // Handle error result
  if (content && typeof content === 'object') {
    const obj = content as Record<string, unknown>;
    if (obj.type === 'web_search_tool_result_error' && typeof obj.error_code === 'string') {
      if (isWebSearchToolResultErrorCode(obj.error_code)) {
        return {
          type: 'web_search_tool_result_error',
          errorCode: obj.error_code,
        };
      }
    }
  }

  return null;
}

/**
 * Type guard for web search error codes
 */
export function isWebSearchToolResultErrorCode(
  value: string
): value is AgentWebSearchToolResultErrorCode {
  return (
    value === 'invalid_tool_input' ||
    value === 'unavailable' ||
    value === 'max_uses_exceeded' ||
    value === 'too_many_requests' ||
    value === 'query_too_long'
  );
}

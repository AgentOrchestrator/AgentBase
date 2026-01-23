/**
 * SDK Message Mapper
 *
 * Maps messages from @anthropic-ai/claude-agent-sdk to internal types
 * used by the coding agent system.
 */

import type {
  SDKAssistantMessage,
  SDKMessage,
  SDKPartialAssistantMessage,
  SDKResultMessage,
} from '@anthropic-ai/claude-agent-sdk';
import type { GenerateResponse, StreamingBlockType, StreamingChunk } from '../types';

/**
 * Extract the result message from an array of SDK messages
 */
export function findResultMessage(messages: SDKMessage[]): SDKResultMessage | undefined {
  return messages.find((m): m is SDKResultMessage => m.type === 'result');
}

/**
 * Map SDK messages to GenerateResponse
 *
 * Extracts content from assistant messages and metadata from the result message.
 */
export function mapSdkMessagesToResponse(
  messages: SDKMessage[],
  resultMessage?: SDKResultMessage
): GenerateResponse {
  const result = resultMessage ?? findResultMessage(messages);

  // Extract content from assistant messages
  const assistantContent = messages
    .filter((m): m is SDKAssistantMessage => m.type === 'assistant')
    .map((m) => extractAssistantTextContent(m))
    .filter(Boolean)
    .join('\n');

  // Use result message content if available, otherwise fall back to assistant content
  const content =
    result?.subtype === 'success' ? result.result || assistantContent : assistantContent;

  // Calculate tokens if usage is available
  const tokensUsed = result?.usage
    ? (result.usage.input_tokens ?? 0) + (result.usage.output_tokens ?? 0)
    : undefined;

  if (!result) {
    console.warn('[SDKMessageMapper] No result message found in SDK messages');
    throw new Error('No result message found');
  }

  return {
    content: content.trim(),
    sessionId: result?.session_id,
    messageId: result?.uuid ?? crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    tokensUsed,
  };
}

/**
 * Extract text content from an SDK assistant message
 */
export function extractAssistantTextContent(message: SDKAssistantMessage): string {
  const content = message.message.content;

  // Handle string content directly
  if (typeof content === 'string') {
    return content;
  }

  // Handle array of content blocks - extract text blocks only
  if (Array.isArray(content)) {
    return content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
  }

  return '';
}

/**
 * Extract streaming chunk content from SDKPartialAssistantMessage
 *
 * Returns the text delta content if present, null otherwise.
 */
export function extractStreamingChunk(message: SDKPartialAssistantMessage): string | null {
  const event = message.event;

  // Handle content_block_delta events with text_delta
  if (event.type === 'content_block_delta') {
    const delta = event.delta as { type: string; text?: string };
    if (delta.type === 'text_delta' && delta.text) {
      return delta.text;
    }
  }

  return null;
}

/**
 * Map SDK block type to our StreamingBlockType
 */
function mapBlockType(type: string): StreamingBlockType {
  if (type === 'thinking') return 'thinking';
  if (type === 'tool_use') return 'tool_use';
  return 'text';
}

/**
 * Extract structured streaming chunk from SDKPartialAssistantMessage
 *
 * Handles all content block types:
 * - content_block_start: New block started (text, thinking, tool_use)
 * - content_block_delta: Delta content (text_delta, thinking_delta, input_json_delta)
 * - content_block_stop: Block completed
 *
 * Returns a StreamingChunk if the event is relevant, null otherwise.
 */
export function extractStructuredStreamingChunk(
  message: SDKPartialAssistantMessage
): StreamingChunk | null {
  const event = message.event as {
    type: string;
    index?: number;
    content_block?: {
      type: string;
      id?: string;
      name?: string;
    };
    delta?: {
      type: string;
      text?: string;
      thinking?: string;
      partial_json?: string;
    };
  };

  // Handle content_block_start - new block started
  if (event.type === 'content_block_start' && event.content_block) {
    const block = event.content_block;
    const blockType = mapBlockType(block.type);
    return {
      type: 'block_start',
      index: event.index ?? 0,
      blockType,
      block: {
        type: blockType,
        id: block.id,
        name: block.name,
      },
    };
  }

  // Handle content_block_delta - delta content
  if (event.type === 'content_block_delta' && event.delta) {
    const delta = event.delta;

    // Text delta
    if (delta.type === 'text_delta' && delta.text) {
      return {
        type: 'block_delta',
        index: event.index ?? 0,
        delta: { text: delta.text },
      };
    }

    // Thinking delta
    if (delta.type === 'thinking_delta' && delta.thinking) {
      return {
        type: 'block_delta',
        index: event.index ?? 0,
        delta: { thinking: delta.thinking },
      };
    }

    // Input JSON delta (for tool_use)
    if (delta.type === 'input_json_delta' && delta.partial_json) {
      return {
        type: 'block_delta',
        index: event.index ?? 0,
        delta: { inputJson: delta.partial_json },
      };
    }
  }

  // Handle content_block_stop - block completed
  if (event.type === 'content_block_stop') {
    return {
      type: 'block_stop',
      index: event.index ?? 0,
    };
  }

  return null;
}

/**
 * Check if a result message indicates an error
 */
export function isResultError(result: SDKResultMessage): boolean {
  return result.is_error || result.subtype !== 'success';
}

/**
 * Get error messages from a failed result
 */
export function getResultErrors(result: SDKResultMessage): string[] {
  if (result.subtype === 'success') {
    return [];
  }

  // Non-success result types have an errors array
  const errorResult = result as {
    subtype: string;
    errors?: string[];
  };

  return errorResult.errors ?? ['Unknown error occurred'];
}

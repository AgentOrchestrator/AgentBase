/**
 * SDK Message Mapper
 *
 * Maps messages from @anthropic-ai/claude-agent-sdk to internal types
 * used by the coding agent system.
 */

import type {
  SDKMessage,
  SDKAssistantMessage,
  SDKResultMessage,
  SDKPartialAssistantMessage,
} from '@anthropic-ai/claude-agent-sdk';
import type { GenerateResponse } from '../types/message.types';

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
    result?.subtype === 'success'
      ? result.result || assistantContent
      : assistantContent;

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

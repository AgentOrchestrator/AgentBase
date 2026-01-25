/**
 * SDK Query Executor
 *
 * Production implementation of QueryExecutor that wraps the Claude Agent SDK.
 * Maps SDK types to our internal types, isolating SDK-specific code.
 */

import type { StreamingChunk } from '@agent-orchestrator/shared';
import type {
  CanUseTool,
  Options,
  SDKAssistantMessage,
  SDKMessage,
  SDKPartialAssistantMessage,
  SDKResultMessage,
} from '@anthropic-ai/claude-agent-sdk';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type {
  QueryAssistantMessage,
  QueryExecutor,
  QueryMessageUnion,
  QueryOptions,
  QueryResultMessage,
  QueryStreamEvent,
} from './types';

/**
 * SDK hooks type - extracted from Options['hooks']
 */
type SdkHooks = Options['hooks'];

/**
 * Configuration for SdkQueryExecutor
 */
export interface SdkQueryExecutorConfig {
  /** SDK hooks for events */
  hooks?: SdkHooks;
  /** Permission handler */
  canUseTool?: CanUseTool;
}

/**
 * SdkQueryExecutor - Production implementation wrapping the SDK
 */
export class SdkQueryExecutor implements QueryExecutor {
  private readonly hooks?: SdkHooks;
  private readonly canUseTool?: CanUseTool;

  constructor(config: SdkQueryExecutorConfig = {}) {
    this.hooks = config.hooks;
    this.canUseTool = config.canUseTool;
  }

  /**
   * Execute a query using the SDK and yield normalized messages.
   */
  async *execute(prompt: string, options: QueryOptions): AsyncIterable<QueryMessageUnion> {
    const sdkOptions = this.mapToSdkOptions(options);
    const queryResult = query({ prompt, options: sdkOptions });

    for await (const sdkMessage of queryResult) {
      const normalizedMessage = this.mapFromSdkMessage(sdkMessage);
      if (normalizedMessage) {
        yield normalizedMessage;
      }
    }
  }

  /**
   * Map our QueryOptions to SDK Options
   */
  private mapToSdkOptions(options: QueryOptions): Partial<Options> {
    const sdkOptions: Partial<Options> = {
      cwd: options.cwd,
      abortController: options.abortController,
      hooks: this.hooks,
      canUseTool: this.canUseTool,
      tools: { type: 'preset', preset: 'claude_code' },
      settingSources: ['local'], // Only read from workspace .claude/settings.local.json
    };

    // System prompt
    if (options.systemPrompt) {
      sdkOptions.systemPrompt = {
        type: 'preset',
        preset: 'claude_code',
        append: options.systemPrompt,
      };
    } else {
      sdkOptions.systemPrompt = { type: 'preset', preset: 'claude_code' };
    }

    // Resume/continue options
    if (options.resume) {
      sdkOptions.resume = options.resume;
    }
    if (options.continue) {
      sdkOptions.continue = options.continue;
    }
    if (options.forkSession) {
      sdkOptions.forkSession = options.forkSession;
    }

    // Extra args
    if (options.extraArgs) {
      sdkOptions.extraArgs = options.extraArgs;
    }

    // Streaming
    if (options.includePartialMessages) {
      sdkOptions.includePartialMessages = true;
    }

    return sdkOptions;
  }

  /**
   * Map SDK message to our normalized message type
   */
  private mapFromSdkMessage(sdkMessage: SDKMessage): QueryMessageUnion | null {
    switch (sdkMessage.type) {
      case 'result':
        return this.mapResultMessage(sdkMessage);

      case 'assistant':
        return this.mapAssistantMessage(sdkMessage);

      case 'stream_event':
        return this.mapStreamEvent(sdkMessage);

      default:
        // Ignore other message types (user, system, etc.)
        return null;
    }
  }

  /**
   * Map SDK result message to QueryResultMessage
   */
  private mapResultMessage(sdkMessage: SDKResultMessage): QueryResultMessage {
    return {
      type: 'result',
      data: {
        isError: sdkMessage.is_error || sdkMessage.subtype !== 'success',
        subtype: sdkMessage.subtype,
        content: sdkMessage.subtype === 'success' ? sdkMessage.result : undefined,
        sessionId: sdkMessage.session_id,
        uuid: sdkMessage.uuid,
        usage: sdkMessage.usage
          ? {
              inputTokens: sdkMessage.usage.input_tokens,
              outputTokens: sdkMessage.usage.output_tokens,
            }
          : undefined,
        errors:
          sdkMessage.subtype !== 'success'
            ? ((sdkMessage as unknown as { errors?: string[] }).errors ?? ['Unknown error'])
            : undefined,
      },
    };
  }

  /**
   * Map SDK assistant message to QueryAssistantMessage
   */
  private mapAssistantMessage(sdkMessage: SDKAssistantMessage): QueryAssistantMessage {
    const content = this.extractAssistantContent(sdkMessage);
    return {
      type: 'assistant',
      data: {
        content,
      },
    };
  }

  /**
   * Extract text content from SDK assistant message
   */
  private extractAssistantContent(message: SDKAssistantMessage): string {
    const content = message.message.content;

    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
    }

    return '';
  }

  /**
   * Map SDK stream event to QueryStreamEvent
   */
  private mapStreamEvent(sdkMessage: SDKPartialAssistantMessage): QueryStreamEvent {
    const textChunk = this.extractTextChunk(sdkMessage);
    const structuredChunk = this.extractStructuredChunk(sdkMessage);

    return {
      type: 'stream_event',
      data: {
        textChunk: textChunk ?? undefined,
        structuredChunk: structuredChunk ?? undefined,
      },
    };
  }

  /**
   * Extract plain text chunk from stream event
   */
  private extractTextChunk(message: SDKPartialAssistantMessage): string | null {
    const event = message.event;

    if (event.type === 'content_block_delta') {
      const delta = event.delta as { type: string; text?: string };
      if (delta.type === 'text_delta' && delta.text) {
        return delta.text;
      }
    }

    return null;
  }

  /**
   * Extract structured chunk from stream event
   */
  private extractStructuredChunk(message: SDKPartialAssistantMessage): StreamingChunk | null {
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

    // Handle content_block_start
    if (event.type === 'content_block_start' && event.content_block) {
      const block = event.content_block;
      const blockType = this.mapBlockType(block.type);
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

    // Handle content_block_delta
    if (event.type === 'content_block_delta' && event.delta) {
      const delta = event.delta;

      if (delta.type === 'text_delta' && delta.text) {
        return {
          type: 'block_delta',
          index: event.index ?? 0,
          delta: { text: delta.text },
        };
      }

      if (delta.type === 'thinking_delta' && delta.thinking) {
        return {
          type: 'block_delta',
          index: event.index ?? 0,
          delta: { thinking: delta.thinking },
        };
      }

      if (delta.type === 'input_json_delta' && delta.partial_json) {
        return {
          type: 'block_delta',
          index: event.index ?? 0,
          delta: { inputJson: delta.partial_json },
        };
      }
    }

    // Handle content_block_stop
    if (event.type === 'content_block_stop') {
      return {
        type: 'block_stop',
        index: event.index ?? 0,
      };
    }

    return null;
  }

  /**
   * Map SDK block type to our StreamingBlockType
   */
  private mapBlockType(type: string): 'text' | 'thinking' | 'tool_use' {
    if (type === 'thinking') return 'thinking';
    if (type === 'tool_use') return 'tool_use';
    return 'text';
  }
}

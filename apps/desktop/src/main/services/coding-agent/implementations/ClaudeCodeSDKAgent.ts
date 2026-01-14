/**
 * Claude Code SDK Agent Implementation
 *
 * Uses the @anthropic-ai/claude-agent-sdk directly instead of spawning CLI,
 * enabling native hook support for reliable event handling.
 *
 * Implements:
 * - ICodingAgentProvider: Core generation via SDK query()
 * - ISessionResumable: Resume via SDK options
 * - IProcessLifecycle: Lifecycle management
 *
 * Key differences from ClaudeCodeAgent (CLI-based):
 * - Native hook support via SDK
 * - No subprocess spawning
 * - Direct streaming via async generator
 */

import { query, type Query, type SDKMessage, type Options } from '@anthropic-ai/claude-agent-sdk';
import {
  createEventRegistry,
  createSDKHookBridge,
  type EventRegistry,
  type SDKHookBridge,
} from '@agent-orchestrator/shared';

import type {
  ICodingAgentProvider,
  ISessionResumable,
  IProcessLifecycle,
} from '../interfaces';
import type {
  Result,
  AgentError,
  AgentCapabilities,
  CodingAgentType,
  GenerateRequest,
  GenerateResponse,
  StreamCallback,
  SessionIdentifier,
  ContinueOptions,
  AgentConfig,
} from '../types';
import { AgentErrorCode, ok, err, agentError } from '../types';

/**
 * SDK Agent configuration extending base config
 */
export interface ClaudeCodeSDKAgentConfig extends Partial<AgentConfig> {
  /** Enable debug logging for hooks */
  debugHooks?: boolean;

  /** Custom SDK options */
  sdkOptions?: Partial<Options>;
}

/**
 * Claude Code SDK-based agent implementation
 */
export class ClaudeCodeSDKAgent
  implements ICodingAgentProvider, ISessionResumable, IProcessLifecycle
{
  private initialized = false;
  private currentQuery: Query | null = null;
  private eventRegistry: EventRegistry;
  private hookBridge: SDKHookBridge;
  private config: ClaudeCodeSDKAgentConfig;

  constructor(config: ClaudeCodeSDKAgentConfig = {}) {
    this.config = config;

    // Create event registry and hook bridge
    this.eventRegistry = createEventRegistry();
    this.hookBridge = createSDKHookBridge(this.eventRegistry, {
      debug: config.debugHooks ?? false,
    });
  }

  // ==========================================================================
  // PUBLIC: Event Registry Access
  // ==========================================================================

  /**
   * Get the event registry for registering custom handlers
   *
   * @example
   * ```typescript
   * const agent = new ClaudeCodeSDKAgent();
   * agent.getEventRegistry().on('tool:begin', async (event) => {
   *   console.log('Tool starting:', event.payload);
   *   return { action: 'continue' };
   * });
   * ```
   */
  getEventRegistry(): EventRegistry {
    return this.eventRegistry;
  }

  // ==========================================================================
  // IProcessLifecycle Implementation
  // ==========================================================================

  get agentType(): CodingAgentType {
    return 'claude_code';
  }

  getCapabilities(): AgentCapabilities {
    return {
      canGenerate: true,
      canResumeSession: true,
      canForkSession: false, // SDK doesn't support forking yet
      canListSessions: false,
      supportsStreaming: true,
    };
  }

  async initialize(): Promise<Result<void, AgentError>> {
    // SDK doesn't require explicit initialization, but we mark it ready
    this.initialized = true;
    return ok(undefined);
  }

  async isAvailable(): Promise<boolean> {
    // SDK is available if we can import it (which we already have)
    // In production, you might want to check for API keys, etc.
    return true;
  }

  async dispose(): Promise<void> {
    // Interrupt any running query
    await this.cancelAll();

    // Cleanup hook bridge
    this.hookBridge.cleanup();
    this.eventRegistry.clear();
    this.initialized = false;
  }

  async cancelAll(): Promise<void> {
    if (this.currentQuery) {
      try {
        await this.currentQuery.interrupt();
      } catch {
        // Ignore interrupt errors
      }
      this.currentQuery = null;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // ==========================================================================
  // ICodingAgentProvider Implementation
  // ==========================================================================

  async generate(request: GenerateRequest): Promise<Result<GenerateResponse, AgentError>> {
    if (!this.initialized) {
      const initResult = await this.initialize();
      if (!initResult.success) {
        return initResult as Result<GenerateResponse, AgentError>;
      }
    }

    try {
      const options = this.buildSDKOptions(request);
      let fullContent = '';
      let messageId = '';

      // Run query and collect all output
      const queryInstance = query({ prompt: request.prompt, options });
      this.currentQuery = queryInstance;

      for await (const message of queryInstance) {
        if (message.type === 'assistant') {
          // Extract text content from assistant message
          const content = this.extractTextContent(message);
          fullContent += content;
          messageId = message.uuid;
        } else if (message.type === 'result') {
          // Query completed
          break;
        }
      }

      this.currentQuery = null;

      return ok({
        content: fullContent.trim(),
        messageId: messageId || crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.currentQuery = null;
      return err(
        agentError(
          AgentErrorCode.UNKNOWN_ERROR,
          `SDK query failed: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  async generateStreaming(
    request: GenerateRequest,
    onChunk: StreamCallback
  ): Promise<Result<GenerateResponse, AgentError>> {
    if (!this.initialized) {
      const initResult = await this.initialize();
      if (!initResult.success) {
        return initResult as Result<GenerateResponse, AgentError>;
      }
    }

    try {
      const options = this.buildSDKOptions(request);
      options.includePartialMessages = true; // Enable streaming deltas

      let fullContent = '';
      let messageId = '';

      const queryInstance = query({ prompt: request.prompt, options });
      this.currentQuery = queryInstance;

      for await (const message of queryInstance) {
        if (message.type === 'stream_event') {
          // Handle streaming delta
          const delta = this.extractStreamDelta(message);
          if (delta) {
            fullContent += delta;
            onChunk(delta);
          }
        } else if (message.type === 'assistant') {
          messageId = message.uuid;
        } else if (message.type === 'result') {
          break;
        }
      }

      this.currentQuery = null;

      return ok({
        content: fullContent.trim(),
        messageId: messageId || crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.currentQuery = null;
      return err(
        agentError(
          AgentErrorCode.UNKNOWN_ERROR,
          `SDK streaming query failed: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  // ==========================================================================
  // ISessionResumable Implementation
  // ==========================================================================

  async continueSession(
    identifier: SessionIdentifier,
    prompt: string,
    options?: ContinueOptions
  ): Promise<Result<GenerateResponse, AgentError>> {
    if (!this.initialized) {
      const initResult = await this.initialize();
      if (!initResult.success) {
        return initResult as Result<GenerateResponse, AgentError>;
      }
    }

    try {
      const sdkOptions = this.buildSDKOptions({
        prompt,
        workingDirectory: options?.workingDirectory,
        timeout: options?.timeout,
      });

      // Add resume option based on identifier
      if (identifier.type === 'latest') {
        sdkOptions.continue = true;
      } else if (identifier.type === 'id' || identifier.type === 'name') {
        sdkOptions.resume = identifier.value;
      }

      let fullContent = '';
      let messageId = '';

      const queryInstance = query({ prompt, options: sdkOptions });
      this.currentQuery = queryInstance;

      for await (const message of queryInstance) {
        if (message.type === 'assistant') {
          const content = this.extractTextContent(message);
          fullContent += content;
          messageId = message.uuid;
        } else if (message.type === 'result') {
          break;
        }
      }

      this.currentQuery = null;

      return ok({
        content: fullContent.trim(),
        messageId: messageId || crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.currentQuery = null;
      return err(
        agentError(
          AgentErrorCode.SESSION_INVALID,
          `Failed to continue session: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  async continueSessionStreaming(
    identifier: SessionIdentifier,
    prompt: string,
    onChunk: StreamCallback,
    options?: ContinueOptions
  ): Promise<Result<GenerateResponse, AgentError>> {
    if (!this.initialized) {
      const initResult = await this.initialize();
      if (!initResult.success) {
        return initResult as Result<GenerateResponse, AgentError>;
      }
    }

    try {
      const sdkOptions = this.buildSDKOptions({
        prompt,
        workingDirectory: options?.workingDirectory,
        timeout: options?.timeout,
      });

      sdkOptions.includePartialMessages = true;

      if (identifier.type === 'latest') {
        sdkOptions.continue = true;
      } else if (identifier.type === 'id' || identifier.type === 'name') {
        sdkOptions.resume = identifier.value;
      }

      let fullContent = '';
      let messageId = '';

      const queryInstance = query({ prompt, options: sdkOptions });
      this.currentQuery = queryInstance;

      for await (const message of queryInstance) {
        if (message.type === 'stream_event') {
          const delta = this.extractStreamDelta(message);
          if (delta) {
            fullContent += delta;
            onChunk(delta);
          }
        } else if (message.type === 'assistant') {
          messageId = message.uuid;
        } else if (message.type === 'result') {
          break;
        }
      }

      this.currentQuery = null;

      return ok({
        content: fullContent.trim(),
        messageId: messageId || crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.currentQuery = null;
      return err(
        agentError(
          AgentErrorCode.SESSION_INVALID,
          `Failed to continue session streaming: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private buildSDKOptions(request: Partial<GenerateRequest>): Options {
    const options: Options = {
      // Include our hook bridge
      hooks: this.hookBridge.hooks,

      // Use Claude Code's preset system prompt and tools
      systemPrompt: request.systemPrompt
        ? { type: 'preset', preset: 'claude_code', append: request.systemPrompt }
        : { type: 'preset', preset: 'claude_code' },
      tools: { type: 'preset', preset: 'claude_code' },

      // Set working directory
      cwd: request.workingDirectory ?? process.cwd(),

      // Merge any custom SDK options
      ...this.config.sdkOptions,
    };

    return options;
  }

  private extractTextContent(message: SDKMessage): string {
    if (message.type !== 'assistant') return '';

    const apiMessage = message.message;
    if (!apiMessage.content) return '';

    if (typeof apiMessage.content === 'string') {
      return apiMessage.content;
    }

    // Handle content array
    return apiMessage.content
      .filter(
        (block: { type: string }): block is { type: 'text'; text: string } => block.type === 'text'
      )
      .map((block: { type: 'text'; text: string }) => block.text)
      .join('');
  }

  private extractStreamDelta(message: SDKMessage): string | null {
    if (message.type !== 'stream_event') return null;

    const event = message.event;
    if (
      event.type === 'content_block_delta' &&
      event.delta &&
      'type' in event.delta &&
      event.delta.type === 'text_delta' &&
      'text' in event.delta
    ) {
      return (event.delta as { type: 'text_delta'; text: string }).text;
    }

    return null;
  }
}

/**
 * Factory function to create a new SDK-based Claude Code agent
 */
export function createClaudeCodeSDKAgent(
  config?: ClaudeCodeSDKAgentConfig
): ClaudeCodeSDKAgent {
  return new ClaudeCodeSDKAgent(config);
}

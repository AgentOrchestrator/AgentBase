import type { VendorId } from './config.types';
import type { ToolCall } from './tool.types';
import type { LlmChatMessage } from '@agent-orchestrator/shared';

/**
 * A single message in a chat conversation
 */
export type { LlmChatMessage };

/**
 * Request to generate a chat completion
 */
export interface ChatRequest {
  /** Conversation messages */
  messages: LlmChatMessage[];
  /** Override default vendor */
  vendor?: VendorId;
  /** Override default model */
  model?: string;
  /** System prompt (prepended to messages) */
  systemPrompt?: string;
  /** Temperature for generation (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Tool names from registry to make available */
  tools?: string[];
  /** Override default timeout */
  timeout?: number;
}

/**
 * Response from a chat completion
 */
export interface ChatResponse {
  /** Generated content */
  content: string;
  /** Model that generated the response */
  model: string;
  /** Vendor that processed the request */
  vendor: VendorId;
  /** Reason generation stopped */
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  /** Token usage statistics */
  usage?: TokenUsage;
  /** Tool calls requested by the model */
  toolCalls?: ToolCall[];
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Callback for streaming chat responses
 */
export type StreamCallback = (chunk: string) => void;

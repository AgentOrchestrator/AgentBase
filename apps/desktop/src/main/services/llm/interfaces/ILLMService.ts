import type {
  ChatRequest,
  ChatResponse,
  LLMCapabilities,
  LLMError,
  ModelInfo,
  Result,
  StreamCallback,
} from '../types';

/**
 * Core interface for LLM service operations.
 * Provider-agnostic design using Vercel AI SDK under the hood.
 */
export interface ILLMService {
  /**
   * Get service capabilities for runtime checking
   */
  getCapabilities(): LLMCapabilities;

  /**
   * Generate a chat completion
   */
  chat(request: ChatRequest): Promise<Result<ChatResponse, LLMError>>;

  /**
   * Generate a chat completion with streaming
   */
  chatStream(
    request: ChatRequest,
    onChunk: StreamCallback
  ): Promise<Result<ChatResponse, LLMError>>;

  /**
   * Check if the service is properly configured (has API key for default vendor)
   */
  isConfigured(): Promise<boolean>;

  /**
   * Get available models for all vendors
   */
  getAvailableModels(): Promise<Result<ModelInfo[], LLMError>>;

  /**
   * Dispose resources
   */
  dispose(): Promise<void>;
}

/**
 * Extended interface for tool-use capable services
 */
export interface IToolCapableLLMService extends ILLMService {
  /**
   * Chat with automatic tool execution support.
   * Executes tool calls and continues until model stops calling tools.
   * @param request - Chat request with tools specified
   * @param maxIterations - Maximum tool execution rounds (default: 10)
   */
  chatWithTools(
    request: ChatRequest,
    maxIterations?: number
  ): Promise<Result<ChatResponse, LLMError>>;
}

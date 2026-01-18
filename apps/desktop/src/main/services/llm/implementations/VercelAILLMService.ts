import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';
import type {
  IApiKeyRepository,
  ILogger,
  IToolCapableLLMService,
  IToolRegistry,
} from '../interfaces';
import type {
  ChatRequest,
  ChatResponse,
  LLMCapabilities,
  LLMConfig,
  LLMError,
  ModelInfo,
  Result,
  StreamCallback,
  VendorId,
} from '../types';
import { err, KNOWN_MODELS, LLMErrorCode, llmError, ok } from '../types';

// Type for language model returned by AI SDK providers
type LanguageModel = ReturnType<ReturnType<typeof createOpenAI>>;

/**
 * LLM Service implementation using Vercel AI SDK.
 * Provides provider-agnostic interface for chat completions with tool support.
 */
export class VercelAILLMService implements IToolCapableLLMService {
  private readonly toolRegistry: IToolRegistry;

  constructor(
    private readonly config: LLMConfig,
    private readonly apiKeyRepository: IApiKeyRepository,
    toolRegistry: IToolRegistry,
    private readonly logger: ILogger
  ) {
    // Store for future tool support implementation
    this.toolRegistry = toolRegistry;
  }

  /** Get the tool registry for future tool support */
  getToolRegistry(): IToolRegistry {
    return this.toolRegistry;
  }

  getCapabilities(): LLMCapabilities {
    return {
      canChat: true,
      canStream: true,
      canUseTools: true,
      supportedVendors: ['openai', 'anthropic', 'google'],
    };
  }

  async chat(request: ChatRequest): Promise<Result<ChatResponse, LLMError>> {
    const modelResult = await this.getModel(request.vendor, request.model);
    if (!modelResult.success) {
      return modelResult;
    }

    const { model, vendor, modelId } = modelResult.data;

    try {
      const messages = this.convertMessages(request);

      const result = await generateText({
        model,
        messages,
        ...(request.systemPrompt && { system: request.systemPrompt }),
        temperature: request.temperature ?? 0.7,
        maxRetries: this.config.maxRetries,
      });

      return ok(this.buildResponse(result, vendor, modelId));
    } catch (error) {
      this.logger.error('Chat failed', { error, vendor, model: modelId });
      return this.handleError(error);
    }
  }

  async chatStream(
    request: ChatRequest,
    onChunk: StreamCallback
  ): Promise<Result<ChatResponse, LLMError>> {
    const modelResult = await this.getModel(request.vendor, request.model);
    if (!modelResult.success) {
      return modelResult;
    }

    const { model, vendor, modelId } = modelResult.data;

    try {
      const messages = this.convertMessages(request);

      const result = streamText({
        model,
        messages,
        ...(request.systemPrompt && { system: request.systemPrompt }),
        temperature: request.temperature ?? 0.7,
        maxRetries: this.config.maxRetries,
      });

      // Stream chunks to callback
      let fullText = '';
      for await (const chunk of result.textStream) {
        fullText += chunk;
        onChunk(chunk);
      }

      return ok({
        content: fullText,
        model: modelId,
        vendor,
        finishReason: 'stop',
      });
    } catch (error) {
      this.logger.error('Chat stream failed', { error, vendor, model: modelId });
      return this.handleError(error);
    }
  }

  async chatWithTools(
    request: ChatRequest,
    _maxIterations: number = 10
  ): Promise<Result<ChatResponse, LLMError>> {
    // For now, just call chat without tools
    // Tool support requires more complex Vercel AI SDK integration
    // that needs careful type handling
    this.logger.warn(
      'chatWithTools called - tool execution not yet implemented, falling back to regular chat'
    );
    return this.chat(request);
  }

  async isConfigured(): Promise<boolean> {
    return this.apiKeyRepository.hasApiKey(this.config.defaultVendor);
  }

  async getAvailableModels(): Promise<Result<ModelInfo[], LLMError>> {
    return ok(KNOWN_MODELS);
  }

  async dispose(): Promise<void> {
    this.logger.info('LLM Service disposed');
  }

  // Private helper methods

  private async getModel(
    vendor?: VendorId,
    modelId?: string
  ): Promise<Result<{ model: LanguageModel; vendor: VendorId; modelId: string }, LLMError>> {
    const targetVendor = vendor || this.config.defaultVendor;
    const targetModel = modelId || this.config.defaultModels[targetVendor];

    const keyResult = await this.apiKeyRepository.getApiKey(targetVendor);
    if (!keyResult.success) {
      return keyResult;
    }

    if (!keyResult.data) {
      return err(llmError(LLMErrorCode.API_KEY_NOT_FOUND, `No API key found for ${targetVendor}`));
    }

    const apiKey = keyResult.data;

    try {
      let model: LanguageModel;

      switch (targetVendor) {
        case 'openai': {
          const openai = createOpenAI({ apiKey });
          model = openai(targetModel);
          break;
        }
        case 'anthropic': {
          const anthropic = createAnthropic({ apiKey });
          model = anthropic(targetModel);
          break;
        }
        case 'google': {
          const google = createGoogleGenerativeAI({ apiKey });
          model = google(targetModel);
          break;
        }
        default:
          return err(
            llmError(LLMErrorCode.PROVIDER_NOT_SUPPORTED, `Unsupported vendor: ${targetVendor}`)
          );
      }

      return ok({ model, vendor: targetVendor, modelId: targetModel });
    } catch (error) {
      return this.handleError(error);
    }
  }

  private convertMessages(
    request: ChatRequest
  ): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
    return request.messages
      .filter((msg) => msg.role !== 'tool') // Filter out tool messages for now
      .map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));
  }

  private buildResponse(
    result: Awaited<ReturnType<typeof generateText>>,
    vendor: VendorId,
    modelId: string
  ): ChatResponse {
    // Extract usage if available (SDK v5 uses different property names)
    let usage: ChatResponse['usage'] | undefined;
    if (result.usage) {
      const u = result.usage as Record<string, number>;
      const promptTokens = u.promptTokens ?? u.inputTokens ?? 0;
      const completionTokens = u.completionTokens ?? u.outputTokens ?? 0;
      usage = {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      };
    }

    return {
      content: result.text,
      model: modelId,
      vendor,
      finishReason: (result.finishReason as ChatResponse['finishReason']) || 'stop',
      usage,
    };
  }

  private handleError(error: unknown): Result<never, LLMError> {
    const err_ = error as Record<string, unknown>;

    // Handle API-specific errors
    if (err_?.statusCode === 429 || err_?.status === 429) {
      return err(llmError(LLMErrorCode.RATE_LIMITED, 'Rate limited by provider'));
    }
    if (err_?.statusCode === 401 || err_?.status === 401) {
      return err(llmError(LLMErrorCode.API_KEY_INVALID, 'Invalid API key'));
    }
    if (err_?.statusCode === 400 || err_?.status === 400) {
      return err(
        llmError(LLMErrorCode.INVALID_REQUEST, (err_?.message as string) || 'Invalid request')
      );
    }

    // Check for context length errors
    const message = (err_?.message as string) || '';
    if (
      message.includes('context_length') ||
      message.includes('max_tokens') ||
      message.includes('too long')
    ) {
      return err(llmError(LLMErrorCode.CONTEXT_LENGTH_EXCEEDED, 'Context length exceeded'));
    }

    // Network errors
    if (err_?.code === 'ECONNREFUSED' || err_?.code === 'ETIMEDOUT') {
      return err(llmError(LLMErrorCode.NETWORK_ERROR, 'Network error'));
    }

    return err(
      llmError(
        LLMErrorCode.UNKNOWN_ERROR,
        message || 'Unknown error',
        undefined,
        error instanceof Error ? error : undefined
      )
    );
  }
}

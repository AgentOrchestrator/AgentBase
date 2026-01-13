"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VercelAILLMService = void 0;
const openai_1 = require("@ai-sdk/openai");
const anthropic_1 = require("@ai-sdk/anthropic");
const google_1 = require("@ai-sdk/google");
const ai_1 = require("ai");
const types_1 = require("../types");
/**
 * LLM Service implementation using Vercel AI SDK.
 * Provides provider-agnostic interface for chat completions with tool support.
 */
class VercelAILLMService {
    constructor(config, apiKeyRepository, toolRegistry, logger) {
        this.config = config;
        this.apiKeyRepository = apiKeyRepository;
        this.toolRegistry = toolRegistry;
        this.logger = logger;
    }
    getCapabilities() {
        return {
            canChat: true,
            canStream: true,
            canUseTools: true,
            supportedVendors: ['openai', 'anthropic', 'google'],
        };
    }
    async chat(request) {
        const modelResult = await this.getModel(request.vendor, request.model);
        if (!modelResult.success) {
            return modelResult;
        }
        const { model, vendor, modelId } = modelResult.data;
        try {
            const messages = this.convertMessages(request);
            const result = await (0, ai_1.generateText)({
                model,
                messages,
                ...(request.systemPrompt && { system: request.systemPrompt }),
                temperature: request.temperature ?? 0.7,
                maxRetries: this.config.maxRetries,
            });
            return (0, types_1.ok)(this.buildResponse(result, vendor, modelId));
        }
        catch (error) {
            this.logger.error('Chat failed', { error, vendor, model: modelId });
            return this.handleError(error);
        }
    }
    async chatStream(request, onChunk) {
        const modelResult = await this.getModel(request.vendor, request.model);
        if (!modelResult.success) {
            return modelResult;
        }
        const { model, vendor, modelId } = modelResult.data;
        try {
            const messages = this.convertMessages(request);
            const result = (0, ai_1.streamText)({
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
            return (0, types_1.ok)({
                content: fullText,
                model: modelId,
                vendor,
                finishReason: 'stop',
            });
        }
        catch (error) {
            this.logger.error('Chat stream failed', { error, vendor, model: modelId });
            return this.handleError(error);
        }
    }
    async chatWithTools(request, maxIterations = 10) {
        // For now, just call chat without tools
        // Tool support requires more complex Vercel AI SDK integration
        // that needs careful type handling
        this.logger.warn('chatWithTools called - tool execution not yet implemented, falling back to regular chat');
        return this.chat(request);
    }
    async isConfigured() {
        return this.apiKeyRepository.hasApiKey(this.config.defaultVendor);
    }
    async getAvailableModels() {
        return (0, types_1.ok)(types_1.KNOWN_MODELS);
    }
    async dispose() {
        this.logger.info('LLM Service disposed');
    }
    // Private helper methods
    async getModel(vendor, modelId) {
        const targetVendor = vendor || this.config.defaultVendor;
        const targetModel = modelId || this.config.defaultModels[targetVendor];
        const keyResult = await this.apiKeyRepository.getApiKey(targetVendor);
        if (!keyResult.success) {
            return keyResult;
        }
        if (!keyResult.data) {
            return (0, types_1.err)((0, types_1.llmError)(types_1.LLMErrorCode.API_KEY_NOT_FOUND, `No API key found for ${targetVendor}`));
        }
        const apiKey = keyResult.data;
        try {
            let model;
            switch (targetVendor) {
                case 'openai': {
                    const openai = (0, openai_1.createOpenAI)({ apiKey });
                    model = openai(targetModel);
                    break;
                }
                case 'anthropic': {
                    const anthropic = (0, anthropic_1.createAnthropic)({ apiKey });
                    model = anthropic(targetModel);
                    break;
                }
                case 'google': {
                    const google = (0, google_1.createGoogleGenerativeAI)({ apiKey });
                    model = google(targetModel);
                    break;
                }
                default:
                    return (0, types_1.err)((0, types_1.llmError)(types_1.LLMErrorCode.PROVIDER_NOT_SUPPORTED, `Unsupported vendor: ${targetVendor}`));
            }
            return (0, types_1.ok)({ model, vendor: targetVendor, modelId: targetModel });
        }
        catch (error) {
            return this.handleError(error);
        }
    }
    convertMessages(request) {
        return request.messages
            .filter((msg) => msg.role !== 'tool') // Filter out tool messages for now
            .map((msg) => ({
            role: msg.role,
            content: msg.content,
        }));
    }
    buildResponse(result, vendor, modelId) {
        // Extract usage if available (SDK v5 uses different property names)
        let usage;
        if (result.usage) {
            const u = result.usage;
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
            finishReason: result.finishReason || 'stop',
            usage,
        };
    }
    handleError(error) {
        const err_ = error;
        // Handle API-specific errors
        if (err_?.statusCode === 429 || err_?.status === 429) {
            return (0, types_1.err)((0, types_1.llmError)(types_1.LLMErrorCode.RATE_LIMITED, 'Rate limited by provider'));
        }
        if (err_?.statusCode === 401 || err_?.status === 401) {
            return (0, types_1.err)((0, types_1.llmError)(types_1.LLMErrorCode.API_KEY_INVALID, 'Invalid API key'));
        }
        if (err_?.statusCode === 400 || err_?.status === 400) {
            return (0, types_1.err)((0, types_1.llmError)(types_1.LLMErrorCode.INVALID_REQUEST, err_?.message || 'Invalid request'));
        }
        // Check for context length errors
        const message = err_?.message || '';
        if (message.includes('context_length') ||
            message.includes('max_tokens') ||
            message.includes('too long')) {
            return (0, types_1.err)((0, types_1.llmError)(types_1.LLMErrorCode.CONTEXT_LENGTH_EXCEEDED, 'Context length exceeded'));
        }
        // Network errors
        if (err_?.code === 'ECONNREFUSED' || err_?.code === 'ETIMEDOUT') {
            return (0, types_1.err)((0, types_1.llmError)(types_1.LLMErrorCode.NETWORK_ERROR, 'Network error'));
        }
        return (0, types_1.err)((0, types_1.llmError)(types_1.LLMErrorCode.UNKNOWN_ERROR, message || 'Unknown error', undefined, error instanceof Error ? error : undefined));
    }
}
exports.VercelAILLMService = VercelAILLMService;

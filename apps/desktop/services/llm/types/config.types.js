"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KNOWN_MODELS = exports.DEFAULT_LLM_CONFIG = void 0;
/**
 * Default configuration for the LLM service
 */
exports.DEFAULT_LLM_CONFIG = {
    defaultVendor: 'anthropic',
    defaultModels: {
        openai: 'gpt-4o',
        anthropic: 'claude-sonnet-4-20250514',
        google: 'gemini-1.5-pro',
    },
    timeout: 120000,
    maxRetries: 2,
};
/**
 * Static list of known models per vendor
 */
exports.KNOWN_MODELS = [
    // OpenAI models
    {
        id: 'gpt-4o',
        name: 'GPT-4o',
        vendor: 'openai',
        contextWindow: 128000,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: true,
    },
    {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        vendor: 'openai',
        contextWindow: 128000,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: true,
    },
    // Anthropic models
    {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        vendor: 'anthropic',
        contextWindow: 200000,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: true,
    },
    {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        vendor: 'anthropic',
        contextWindow: 200000,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: true,
    },
    // Google models
    {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        vendor: 'google',
        contextWindow: 1000000,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: true,
    },
    {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        vendor: 'google',
        contextWindow: 1000000,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: true,
    },
];

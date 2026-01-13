/**
 * Supported LLM vendor identifiers
 */
export type VendorId = 'openai' | 'anthropic' | 'google';

/**
 * Configuration for the LLM service
 */
export interface LLMConfig {
  /** Default vendor to use when not specified */
  defaultVendor: VendorId;
  /** Default model for each vendor */
  defaultModels: Record<VendorId, string>;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retries for failed requests */
  maxRetries?: number;
}

/**
 * Information about an available model
 */
export interface ModelInfo {
  id: string;
  name: string;
  vendor: VendorId;
  contextWindow: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
  supportsVision?: boolean;
}

/**
 * Runtime capabilities of the LLM service
 */
export interface LLMCapabilities {
  canChat: boolean;
  canStream: boolean;
  canUseTools: boolean;
  supportedVendors: VendorId[];
}

/**
 * Default configuration for the LLM service
 */
export const DEFAULT_LLM_CONFIG: LLMConfig = {
  defaultVendor: 'anthropic',
  defaultModels: {
    openai: 'gpt-4o',
    anthropic: 'claude-sonnet-4-20250514',
    google: 'gemini-1.5-pro',
  },
  timeout: 120_000,
  maxRetries: 2,
};

/**
 * Static list of known models per vendor
 */
export const KNOWN_MODELS: ModelInfo[] = [
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

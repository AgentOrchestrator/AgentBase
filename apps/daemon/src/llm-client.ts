import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { getApiKey } from './api-key-manager.js';
import type {
  IApiKeyRepository,
  IUserPreferencesRepository,
  UserPreferences,
} from './interfaces/repositories.js';

// Type for language model returned by AI SDK providers
type LanguageModel = ReturnType<ReturnType<typeof createOpenAI>>;

export interface LLMConfig {
  provider: string;
  model: string;
  userId?: string;
  apiKeyRepo?: IApiKeyRepository;
}

// Re-export UserPreferences from interfaces for backward compatibility
export type { UserPreferences } from './interfaces/repositories.js';

/**
 * Fetch user preferences from the database
 * Returns default preferences if not found
 */
export async function getUserPreferences(
  userPrefsRepo: IUserPreferencesRepository,
  userId: string
): Promise<UserPreferences> {
  return userPrefsRepo.findByUserId(userId);
}

/**
 * Create an LLM client based on the provider
 * Returns null if the API key is not available
 */
export async function createLLMClient(config: LLMConfig): Promise<LanguageModel | null> {
  const { provider, model, userId, apiKeyRepo } = config;

  // Get API key with fallback priority: env var -> database -> null
  const apiKey = await getApiKey(provider, apiKeyRepo, userId);

  if (!apiKey) {
    console.log(`[LLM Client] No API key found for provider: ${provider}`);
    return null;
  }

  try {
    switch (provider.toLowerCase()) {
      case 'openai': {
        const openai = createOpenAI({ apiKey });
        return openai(model);
      }

      case 'anthropic': {
        const anthropic = createAnthropic({ apiKey });
        return anthropic(model);
      }

      case 'google': {
        const google = createGoogleGenerativeAI({ apiKey });
        return google(model);
      }

      // Add more providers as needed
      // case 'groq':
      // case 'openrouter':

      default:
        console.error(`[LLM Client] Unsupported provider: ${provider}`);
        return null;
    }
  } catch (error) {
    console.error(`[LLM Client] Error creating client for ${provider}:`, error);
    return null;
  }
}

/**
 * Generate text using the configured LLM client
 * Returns null if generation fails or no client available
 */
export async function generateLLMText(
  config: LLMConfig,
  prompt: string,
  systemPrompt?: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string | null> {
  const model = await createLLMClient(config);

  if (!model) {
    return null;
  }

  try {
    const result = await generateText({
      model,
      prompt,
      ...(systemPrompt && { system: systemPrompt }),
      temperature: options?.temperature ?? 0.3,
      maxRetries: 2,
    });

    return result.text;
  } catch (error: any) {
    console.error(`[LLM Client] Error generating text with ${config.provider}:`, error);
    return null;
  }
}

/**
 * Get the LLM configuration for a user based on their preferences
 * Falls back to defaults if preferences not found
 */
export async function getUserLLMConfig(
  userPrefsRepo: IUserPreferencesRepository,
  apiKeyRepo: IApiKeyRepository,
  userId: string
): Promise<LLMConfig> {
  const preferences = await getUserPreferences(userPrefsRepo, userId);

  return {
    provider: preferences.aiModelProvider || 'openai',
    model: preferences.aiModelName || 'gpt-4o-mini',
    userId,
    apiKeyRepo,
  };
}

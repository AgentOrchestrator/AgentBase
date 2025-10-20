import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { getApiKey } from './api-key-manager.js';
import { createAuthenticatedClient } from './supabase.js';

// Type for language model returned by AI SDK providers
type LanguageModel = ReturnType<ReturnType<typeof createOpenAI>>;

export interface LLMConfig {
  provider: string;
  model: string;
  accountId?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface UserPreferences {
  user_id: string;
  ai_summary_enabled: boolean;
  ai_title_enabled: boolean;
  ai_model_provider?: string;
  ai_model_name?: string;
}

/**
 * Fetch user preferences from the database
 * Returns default preferences if not found
 */
export async function getUserPreferences(
  userId: string,
  accessToken: string,
  refreshToken: string
): Promise<UserPreferences> {
  try {
    const supabase = await createAuthenticatedClient(accessToken, refreshToken);
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Return default preferences if not found
      console.log(`[LLM Client] No preferences found for user ${userId}, using defaults`);
      return {
        user_id: userId,
        ai_summary_enabled: true,
        ai_title_enabled: true,
        ai_model_provider: 'openai',
        ai_model_name: 'gpt-4o-mini',
      };
    }

    return {
      user_id: data.user_id,
      ai_summary_enabled: data.ai_summary_enabled ?? true,
      ai_title_enabled: data.ai_title_enabled ?? true,
      ai_model_provider: data.ai_model_provider ?? 'openai',
      ai_model_name: data.ai_model_name ?? 'gpt-4o-mini',
    };
  } catch (error) {
    console.error('[LLM Client] Error fetching user preferences:', error);
    // Return defaults on error
    return {
      user_id: userId,
      ai_summary_enabled: true,
      ai_title_enabled: true,
      ai_model_provider: 'openai',
      ai_model_name: 'gpt-4o-mini',
    };
  }
}

/**
 * Create an LLM client based on the provider
 * Returns null if the API key is not available
 */
export async function createLLMClient(config: LLMConfig): Promise<LanguageModel | null> {
  const { provider, model, accountId, accessToken, refreshToken } = config;

  // Get API key with fallback priority: env var -> database -> null
  const apiKey = await getApiKey(provider, accountId, accessToken, refreshToken);

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
  accountId: string,
  accessToken: string,
  refreshToken: string
): Promise<LLMConfig> {
  const preferences = await getUserPreferences(accountId, accessToken, refreshToken);

  return {
    provider: preferences.ai_model_provider || 'openai',
    model: preferences.ai_model_name || 'gpt-4o-mini',
    accountId,
    accessToken,
    refreshToken,
  };
}

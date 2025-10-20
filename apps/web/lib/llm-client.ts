import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, LanguageModel } from 'ai';
import { createClient } from '@/lib/supabase-server';

export interface LLMConfig {
  provider: string;
  model: string;
  apiKey: string;
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
export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  try {
    const supabase = await createClient();
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
 * Get API key for a provider with fallback priority:
 * 1. User's database API key (llm_api_keys table)
 * 2. Environment variable (e.g., OPENAI_API_KEY, ANTHROPIC_API_KEY)
 * 3. null (no key available)
 */
export async function getApiKey(
  provider: string,
  userId: string
): Promise<string | null> {
  // Priority 1: Check database for user's API key
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('llm_api_keys')
      .select('api_key')
      .eq('account_id', userId)
      .eq('provider', provider.toLowerCase())
      .eq('is_active', true)
      .single();

    if (!error && data?.api_key) {
      console.log(`[LLM Client] Using ${provider} API key from database for user ${userId}`);
      return data.api_key;
    }
  } catch (error) {
    console.error('[LLM Client] Error fetching API key from database:', error);
  }

  // Priority 2: Check environment variable
  const envVarMap: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_API_KEY',
    groq: 'GROQ_API_KEY',
    ollama: 'OLLAMA_BASE_URL',
    openrouter: 'OPENROUTER_API_KEY',
  };

  const envVarName = envVarMap[provider.toLowerCase()];
  if (envVarName && process.env[envVarName]) {
    console.log(`[LLM Client] Using ${provider} API key from environment variable`);
    return process.env[envVarName] || null;
  }

  // Priority 3: No API key found
  console.log(`[LLM Client] No ${provider} API key found`);
  return null;
}

/**
 * Create an LLM client based on the provider
 * Returns null if the API key is not available
 */
export function createLLMClient(config: LLMConfig): LanguageModel | null {
  const { provider, model, apiKey } = config;

  if (!apiKey) {
    console.log(`[LLM Client] No API key provided for ${provider}`);
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
  const model = createLLMClient(config);

  if (!model) {
    return null;
  }

  try {
    const result = await generateText({
      model,
      prompt,
      system: systemPrompt,
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? 500,
    });

    return result.text;
  } catch (error: any) {
    console.error(`[LLM Client] Error generating text with ${config.provider}:`, error);
    return null;
  }
}

/**
 * Get the LLM configuration for a user based on their preferences
 * Automatically fetches API key from database or environment
 * Returns null if no API key is available
 */
export async function getUserLLMConfig(userId: string): Promise<LLMConfig | null> {
  const preferences = await getUserPreferences(userId);

  const provider = preferences.ai_model_provider || 'openai';
  const model = preferences.ai_model_name || 'gpt-4o-mini';

  const apiKey = await getApiKey(provider, userId);

  if (!apiKey) {
    console.error(`[LLM Client] No API key available for provider: ${provider}`);
    return null;
  }

  return {
    provider,
    model,
    apiKey,
  };
}

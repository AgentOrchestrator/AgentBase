import { createAuthenticatedClient } from './supabase.js';

interface LLMApiKey {
  id: string;
  account_id: string;
  provider: string;
  api_key: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch API key from the database for a specific user and provider
 * @param accountId - The user's account ID
 * @param provider - The LLM provider (openai, anthropic, google, etc.)
 * @param accessToken - User's access token
 * @param refreshToken - User's refresh token
 * @returns The API key string if found and active, null otherwise
 */
export async function getApiKeyFromDatabase(
  accountId: string,
  provider: string,
  accessToken: string,
  refreshToken: string
): Promise<string | null> {
  try {
    const supabase = await createAuthenticatedClient(accessToken, refreshToken);

    const { data, error } = await supabase
      .from('llm_api_keys')
      .select('*')
      .eq('account_id', accountId)
      .eq('provider', provider)
      .eq('is_active', true)
      .single();

    if (error) {
      // If no key found, return null (not an error, just no key configured)
      if (error.code === 'PGRST116') {
        return null;
      }

      console.error(`[API Key Manager] Error fetching ${provider} API key from database:`, error);
      return null;
    }

    if (!data || !data.api_key) {
      return null;
    }

    console.log(`[API Key Manager] Found ${provider} API key in database for user ${accountId}`);
    return data.api_key;
  } catch (error) {
    console.error('[API Key Manager] Unexpected error fetching API key:', error);
    return null;
  }
}

/**
 * Get API key for a provider with fallback priority:
 * 1. Environment variable (e.g., OPENAI_API_KEY, ANTHROPIC_API_KEY)
 * 2. Database (llm_api_keys table)
 * 3. null (will use mock/fallback generation)
 *
 * @param provider - The LLM provider (openai, anthropic, google, groq, etc.)
 * @param accountId - The user's account ID (optional, required for database lookup)
 * @param accessToken - User's access token (optional, required for database lookup)
 * @param refreshToken - User's refresh token (optional, required for database lookup)
 * @returns The API key string if found, null otherwise
 */
export async function getApiKey(
  provider: string,
  accountId?: string | null,
  accessToken?: string | null,
  refreshToken?: string | null
): Promise<string | null> {
  // Map provider names to environment variable names
  const envVarMap: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_API_KEY',
    groq: 'GROQ_API_KEY',
    ollama: 'OLLAMA_BASE_URL',
    openrouter: 'OPENROUTER_API_KEY',
  };

  const envVarName = envVarMap[provider.toLowerCase()];

  // Priority 1: Check environment variable
  if (envVarName && process.env[envVarName]) {
    console.log(`[API Key Manager] Using ${provider} API key from environment variable ${envVarName}`);
    return process.env[envVarName] || null;
  }

  // Priority 2: Check database (if user credentials provided)
  if (accountId && accessToken && refreshToken) {
    const dbApiKey = await getApiKeyFromDatabase(accountId, provider.toLowerCase(), accessToken, refreshToken);
    if (dbApiKey) {
      return dbApiKey;
    }
  }

  // Priority 3: No API key found
  console.log(`[API Key Manager] No ${provider} API key found (will use fallback mode if applicable)`);
  return null;
}

/**
 * Get the default LLM provider for a user from their preferences
 * @param accountId - The user's account ID
 * @param accessToken - User's access token
 * @param refreshToken - User's refresh token
 * @returns The default provider name or null if not set
 */
export async function getDefaultProvider(
  accountId: string,
  accessToken: string,
  refreshToken: string
): Promise<string | null> {
  try {
    const supabase = await createAuthenticatedClient(accessToken, refreshToken);

    const { data, error } = await supabase
      .from('llm_api_keys')
      .select('provider')
      .eq('account_id', accountId)
      .eq('is_default', true)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    return data.provider;
  } catch (error) {
    console.error('[API Key Manager] Error fetching default provider:', error);
    return null;
  }
}

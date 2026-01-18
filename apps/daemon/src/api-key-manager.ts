import type { IApiKeyRepository } from './interfaces/repositories.js';

/**
 * Get API key from the database for a specific user and provider
 * @param apiKeyRepo - API key repository
 * @param userId - User ID
 * @param provider - The LLM provider (openai, anthropic, google, etc.)
 * @returns The API key string if found and active, null otherwise
 */
export async function getApiKeyFromDatabase(
  apiKeyRepo: IApiKeyRepository,
  userId: string,
  provider: string
): Promise<string | null> {
  const result = await apiKeyRepo.findActiveKey(userId, provider.toLowerCase());
  if (result) {
    console.log(`[API Key Manager] Found ${provider} API key in database for user ${userId}`);
    return result.key;
  }
  return null;
}

/**
 * Get API key for a provider with fallback priority:
 * 1. Environment variable (e.g., OPENAI_API_KEY, ANTHROPIC_API_KEY)
 * 2. Database (llm_api_keys table)
 * 3. null (will use mock/fallback generation)
 *
 * @param provider - The LLM provider (openai, anthropic, google, groq, etc.)
 * @param apiKeyRepo - API key repository (optional, required for database lookup)
 * @param userId - User ID (required if apiKeyRepo is provided)
 * @returns The API key string if found, null otherwise
 */
export async function getApiKey(
  provider: string,
  apiKeyRepo?: IApiKeyRepository | null,
  userId?: string | null
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
    console.log(
      `[API Key Manager] Using ${provider} API key from environment variable ${envVarName}`
    );
    return process.env[envVarName] || null;
  }

  // Priority 2: Check database (if repository and userId provided)
  if (apiKeyRepo && userId) {
    const dbApiKey = await getApiKeyFromDatabase(apiKeyRepo, userId, provider.toLowerCase());
    if (dbApiKey) {
      return dbApiKey;
    }
  }

  // Priority 3: No API key found
  console.log(
    `[API Key Manager] No ${provider} API key found (will use fallback mode if applicable)`
  );
  return null;
}

/**
 * Get the default LLM provider for a user from their preferences
 * @param apiKeyRepo - API key repository
 * @param userId - User ID
 * @returns The default provider name or null if not set
 */
export async function getDefaultProvider(
  apiKeyRepo: IApiKeyRepository,
  userId: string
): Promise<string | null> {
  return apiKeyRepo.findDefaultProvider(userId);
}

import type { LLMError, Result, VendorId } from '../types';

/**
 * Repository abstraction for API key storage.
 * Allows swapping between Keychain, SQLite, or other backends.
 */
export interface IApiKeyRepository {
  /**
   * Get API key for a vendor
   * @param vendor - The LLM vendor (openai, anthropic, google)
   * @returns The API key or null if not found
   */
  getApiKey(vendor: VendorId): Promise<Result<string | null, LLMError>>;

  /**
   * Store API key for a vendor
   * @param vendor - The LLM vendor
   * @param apiKey - The API key to store
   */
  setApiKey(vendor: VendorId, apiKey: string): Promise<Result<void, LLMError>>;

  /**
   * Delete API key for a vendor
   * @param vendor - The LLM vendor
   */
  deleteApiKey(vendor: VendorId): Promise<Result<void, LLMError>>;

  /**
   * Check if API key exists for a vendor
   * @param vendor - The LLM vendor
   */
  hasApiKey(vendor: VendorId): Promise<boolean>;

  /**
   * List all vendors with stored API keys
   */
  listStoredVendors(): Promise<Result<VendorId[], LLMError>>;
}

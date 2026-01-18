import type { IApiKeyRepository } from '../interfaces';
import type { LLMError, Result, VendorId } from '../types';
import { ok } from '../types';

/**
 * In-memory implementation of API key storage.
 * Useful for testing and as a fallback when Keychain is unavailable.
 *
 * WARNING: Keys stored in memory are not persisted and will be lost on restart.
 */
export class InMemoryApiKeyRepository implements IApiKeyRepository {
  private readonly keys = new Map<VendorId, string>();

  async getApiKey(vendor: VendorId): Promise<Result<string | null, LLMError>> {
    const key = this.keys.get(vendor) ?? null;
    return ok(key);
  }

  async setApiKey(vendor: VendorId, apiKey: string): Promise<Result<void, LLMError>> {
    this.keys.set(vendor, apiKey);
    return ok(undefined);
  }

  async deleteApiKey(vendor: VendorId): Promise<Result<void, LLMError>> {
    this.keys.delete(vendor);
    return ok(undefined);
  }

  async hasApiKey(vendor: VendorId): Promise<boolean> {
    return this.keys.has(vendor);
  }

  async listStoredVendors(): Promise<Result<VendorId[], LLMError>> {
    return ok(Array.from(this.keys.keys()));
  }

  /**
   * Clear all stored keys (useful for testing)
   */
  clear(): void {
    this.keys.clear();
  }
}

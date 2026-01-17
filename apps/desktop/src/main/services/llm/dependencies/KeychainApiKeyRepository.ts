import keytar from 'keytar';
import type { IApiKeyRepository } from '../interfaces';
import type { LLMError, Result, VendorId } from '../types';
import { err, LLMErrorCode, llmError, ok } from '../types';

/**
 * macOS Keychain implementation for API key storage.
 * Uses `keytar` package for cross-platform secure credential storage.
 *
 * Keychain entries are stored as:
 * - Service: "{appName}-llm-keys"
 * - Account: "{vendor}" (e.g., "openai", "anthropic", "google")
 */
export class KeychainApiKeyRepository implements IApiKeyRepository {
  private readonly serviceName: string;

  constructor(appName: string) {
    this.serviceName = `${appName}-llm-keys`;
  }

  async getApiKey(vendor: VendorId): Promise<Result<string | null, LLMError>> {
    try {
      const key = await keytar.getPassword(this.serviceName, vendor);
      return ok(key);
    } catch (error) {
      return err(
        llmError(
          LLMErrorCode.KEYCHAIN_ERROR,
          `Failed to retrieve API key for ${vendor}`,
          { vendor },
          error instanceof Error ? error : undefined
        )
      );
    }
  }

  async setApiKey(vendor: VendorId, apiKey: string): Promise<Result<void, LLMError>> {
    try {
      await keytar.setPassword(this.serviceName, vendor, apiKey);
      return ok(undefined);
    } catch (error) {
      return err(
        llmError(
          LLMErrorCode.KEYCHAIN_ERROR,
          `Failed to store API key for ${vendor}`,
          { vendor },
          error instanceof Error ? error : undefined
        )
      );
    }
  }

  async deleteApiKey(vendor: VendorId): Promise<Result<void, LLMError>> {
    try {
      await keytar.deletePassword(this.serviceName, vendor);
      return ok(undefined);
    } catch (error) {
      return err(
        llmError(
          LLMErrorCode.KEYCHAIN_ERROR,
          `Failed to delete API key for ${vendor}`,
          { vendor },
          error instanceof Error ? error : undefined
        )
      );
    }
  }

  async hasApiKey(vendor: VendorId): Promise<boolean> {
    const result = await this.getApiKey(vendor);
    return result.success && result.data !== null;
  }

  async listStoredVendors(): Promise<Result<VendorId[], LLMError>> {
    try {
      const credentials = await keytar.findCredentials(this.serviceName);
      const vendors = credentials.map((c) => c.account as VendorId);
      return ok(vendors);
    } catch (error) {
      return err(
        llmError(
          LLMErrorCode.KEYCHAIN_ERROR,
          'Failed to list stored vendors',
          undefined,
          error instanceof Error ? error : undefined
        )
      );
    }
  }
}

/**
 * Supabase implementation of IApiKeyRepository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../database.types.js';
import type { IApiKeyRepository } from '../../interfaces/repositories.js';

export class SupabaseApiKeyRepository implements IApiKeyRepository {
  constructor(
    private client: SupabaseClient<Database>,
    _userId: string
  ) {}

  async findActiveKey(
    userId: string,
    provider: string
  ): Promise<{ key: string; provider: string } | null> {
    try {
      const { data, error } = await this.client
        .from('llm_api_keys')
        .select('*')
        .eq('account_id', userId)
        .eq('provider', provider)
        .eq('is_active', true)
        .single();

      if (error) {
        // PGRST116 = no rows found, not an error
        if (error.code !== 'PGRST116') {
          console.error(`[ApiKeyRepository] Error fetching ${provider} API key:`, error.message);
        }
        return null;
      }

      if (!data || !data.api_key) {
        return null;
      }

      return {
        key: data.api_key,
        provider: data.provider,
      };
    } catch (error) {
      console.error('[ApiKeyRepository] Unexpected error fetching API key:', error);
      return null;
    }
  }

  async findDefaultProvider(userId: string): Promise<string | null> {
    try {
      const { data, error } = await this.client
        .from('llm_api_keys')
        .select('provider')
        .eq('account_id', userId)
        .eq('is_default', true)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return null;
      }

      return data.provider;
    } catch (error) {
      console.error('[ApiKeyRepository] Error fetching default provider:', error);
      return null;
    }
  }
}

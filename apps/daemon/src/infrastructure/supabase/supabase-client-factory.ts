/**
 * Supabase implementation of IAuthenticatedClientFactory
 *
 * Wraps createAuthenticatedSupabaseClient to provide a vendor-agnostic
 * interface for creating authenticated API clients.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../database.types.js';
import type {
  IAuthenticatedClientFactory,
  AuthenticatedClientResult,
} from '../../interfaces/authenticated-client-factory.js';
import { createAuthenticatedSupabaseClient } from './client.js';

/**
 * Supabase implementation of IAuthenticatedClientFactory
 */
export class SupabaseClientFactory
  implements IAuthenticatedClientFactory<SupabaseClient<Database>>
{
  async createClient(
    accessToken: string,
    refreshToken: string
  ): Promise<AuthenticatedClientResult<SupabaseClient<Database>>> {
    return createAuthenticatedSupabaseClient(accessToken, refreshToken);
  }

  async isClientValid(client: SupabaseClient<Database>): Promise<boolean> {
    try {
      const { data } = await client.auth.getSession();
      return !!data.session;
    } catch {
      return false;
    }
  }

  async getUserIdFromClient(
    client: SupabaseClient<Database>
  ): Promise<string | null> {
    try {
      const { data } = await client.auth.getSession();
      return data.session?.user.id ?? null;
    } catch {
      return null;
    }
  }
}

/**
 * Factory function to create SupabaseClientFactory
 */
export function createSupabaseClientFactory(): IAuthenticatedClientFactory<
  SupabaseClient<Database>
> {
  return new SupabaseClientFactory();
}

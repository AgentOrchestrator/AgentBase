/**
 * Supabase implementation of IUserRepository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../database.types.js';
import type { IUserRepository, User } from '../../interfaces/repositories.js';

export class SupabaseUserRepository implements IUserRepository {
  constructor(
    private client: SupabaseClient<Database>,
    _userId: string
  ) {}

  async findById(userId: string): Promise<User | null> {
    const { data, error } = await this.client.from('users').select('*').eq('id', userId).single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('[UserRepository] Error finding user by ID:', error.message);
      }
      return null;
    }

    if (!data) {
      return null;
    }

    return this.mapToUser(data);
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.client.from('users').select('*').eq('email', email).single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('[UserRepository] Error finding user by email:', error.message);
      }
      return null;
    }

    if (!data) {
      return null;
    }

    return this.mapToUser(data);
  }

  async updateProfile(
    userId: string,
    updates: Partial<Pick<User, 'displayName' | 'avatarUrl'>>
  ): Promise<User | null> {
    try {
      const updateData: Database['public']['Tables']['users']['Update'] = {
        updated_at: new Date().toISOString(),
      };

      if (updates.displayName !== undefined) {
        updateData.display_name = updates.displayName;
      }
      if (updates.avatarUrl !== undefined) {
        updateData.avatar_url = updates.avatarUrl;
      }

      const { data, error } = await this.client
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('[UserRepository] Error updating user profile:', error.message);
        return null;
      }

      if (!data) {
        return null;
      }

      return this.mapToUser(data);
    } catch (error) {
      console.error('[UserRepository] Unexpected error updating user profile:', error);
      return null;
    }
  }

  private mapToUser(data: Database['public']['Tables']['users']['Row']): User {
    return {
      id: data.id,
      email: data.email,
      displayName: data.display_name,
      avatarUrl: data.avatar_url,
      githubUsername: data.github_username,
      githubAvatarUrl: data.github_avatar_url,
      isAdmin: data.is_admin,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

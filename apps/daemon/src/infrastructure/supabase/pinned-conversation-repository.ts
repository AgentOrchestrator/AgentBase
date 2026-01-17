/**
 * Supabase implementation of IPinnedConversationRepository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../database.types.js';
import type {
  IPinnedConversationRepository,
  PinnedConversation,
} from '../../interfaces/repositories.js';

export class SupabasePinnedConversationRepository implements IPinnedConversationRepository {
  constructor(
    private client: SupabaseClient<Database>,
    _userId: string
  ) {}

  async getPinnedConversations(userId: string): Promise<PinnedConversation[]> {
    const { data, error } = await this.client
      .from('pinned_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('pinned_at', { ascending: false });

    if (error) {
      console.error(
        '[PinnedConversationRepository] Error getting pinned conversations:',
        error.message
      );
      return [];
    }

    return (data || []).map((row) => this.mapToPinnedConversation(row));
  }

  async pinConversation(
    userId: string,
    conversationId: string
  ): Promise<PinnedConversation | null> {
    try {
      const now = new Date().toISOString();

      const { data, error } = await this.client
        .from('pinned_conversations')
        .insert({
          user_id: userId,
          conversation_id: conversationId,
          pinned_at: now,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        console.error('[PinnedConversationRepository] Error pinning conversation:', error.message);
        return null;
      }

      if (!data) {
        return null;
      }

      return this.mapToPinnedConversation(data);
    } catch (error) {
      console.error('[PinnedConversationRepository] Unexpected error pinning:', error);
      return null;
    }
  }

  async unpinConversation(userId: string, conversationId: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('pinned_conversations')
        .delete()
        .eq('user_id', userId)
        .eq('conversation_id', conversationId);

      if (error) {
        console.error(
          '[PinnedConversationRepository] Error unpinning conversation:',
          error.message
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error('[PinnedConversationRepository] Unexpected error unpinning:', error);
      return false;
    }
  }

  async isConversationPinned(userId: string, conversationId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('pinned_conversations')
      .select('id')
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (error) {
      console.error('[PinnedConversationRepository] Error checking if pinned:', error.message);
      return false;
    }

    return data !== null;
  }

  private mapToPinnedConversation(
    data: Database['public']['Tables']['pinned_conversations']['Row']
  ): PinnedConversation {
    return {
      id: data.id,
      userId: data.user_id,
      conversationId: data.conversation_id,
      pinnedAt: data.pinned_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

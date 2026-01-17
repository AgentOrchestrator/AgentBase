/**
 * Supabase implementation of IChatHistoryRepository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../database.types.js';
import type {
  ChatHistoryInput,
  ChatHistoryRecord,
  IChatHistoryRepository,
} from '../../interfaces/repositories.js';
import type { AgentType, ChatMessage } from '../../types.js';

export class SupabaseChatHistoryRepository implements IChatHistoryRepository {
  constructor(
    private client: SupabaseClient<Database>,
    private userId: string
  ) {}

  async upsert(history: ChatHistoryInput): Promise<boolean> {
    try {
      const { error } = await this.client.from('chat_histories').upsert(
        {
          id: history.id,
          account_id: history.userId,
          project_id: history.projectId,
          agent_type: history.agentType,
          timestamp: history.timestamp,
          messages: history.messages as any,
          metadata: history.metadata as any,
          latest_message_timestamp: history.latestMessageTimestamp,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'id',
          ignoreDuplicates: false,
        }
      );

      if (error) {
        console.error('[ChatHistoryRepository] Error upserting chat history:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[ChatHistoryRepository] Unexpected error upserting chat history:', error);
      return false;
    }
  }

  async findById(id: string, userId: string): Promise<ChatHistoryRecord | null> {
    const { data, error } = await this.client
      .from('chat_histories')
      .select('*')
      .eq('id', id)
      .eq('account_id', userId)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('[ChatHistoryRepository] Error finding chat history:', error.message);
      }
      return null;
    }

    if (!data) {
      return null;
    }

    return this.mapToChatHistoryRecord(data);
  }

  async findRecentByUser(userId: string, since: Date): Promise<ChatHistoryRecord[]> {
    const { data, error } = await this.client
      .from('chat_histories')
      .select('*')
      .eq('account_id', userId)
      .gte('latest_message_timestamp', since.toISOString())
      .order('latest_message_timestamp', { ascending: false });

    if (error) {
      console.error('[ChatHistoryRepository] Error finding recent chat histories:', error.message);
      return [];
    }

    return (data || []).map((row) => this.mapToChatHistoryRecord(row));
  }

  async updateAiSummary(id: string, summary: string, messageCount: number): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('chat_histories')
        .update({
          ai_summary: summary,
          ai_summary_generated_at: new Date().toISOString(),
          ai_summary_message_count: messageCount,
        })
        .eq('id', id);

      if (error) {
        console.error('[ChatHistoryRepository] Error updating AI summary:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[ChatHistoryRepository] Unexpected error updating AI summary:', error);
      return false;
    }
  }

  async updateAiKeywords(
    id: string,
    keywords: { type: string[]; topic: string[] },
    messageCount: number
  ): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('chat_histories')
        .update({
          ai_keywords_type: keywords.type,
          ai_keywords_topic: keywords.topic,
          ai_keywords_generated_at: new Date().toISOString(),
          ai_keywords_message_count: messageCount,
        })
        .eq('id', id);

      if (error) {
        console.error('[ChatHistoryRepository] Error updating AI keywords:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[ChatHistoryRepository] Unexpected error updating AI keywords:', error);
      return false;
    }
  }

  async updateAiTitle(id: string, title: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('chat_histories')
        .update({
          ai_title: title,
          ai_title_generated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.error('[ChatHistoryRepository] Error updating AI title:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[ChatHistoryRepository] Unexpected error updating AI title:', error);
      return false;
    }
  }

  private mapToChatHistoryRecord(
    data: Database['public']['Tables']['chat_histories']['Row']
  ): ChatHistoryRecord {
    const record: ChatHistoryRecord = {
      id: data.id,
      userId: data.account_id ?? '',
      projectId: data.project_id,
      agentType: (data.agent_type as AgentType) ?? 'other',
      timestamp: data.timestamp,
      messages: Array.isArray(data.messages) ? (data.messages as unknown as ChatMessage[]) : [],
      latestMessageTimestamp: data.latest_message_timestamp,
      aiSummary: data.ai_summary,
      aiSummaryGeneratedAt: data.ai_summary_generated_at,
      aiSummaryMessageCount: data.ai_summary_message_count,
      aiTitle: data.ai_title,
      aiTitleGeneratedAt: data.ai_title_generated_at,
      aiKeywordsTopic: data.ai_keywords_topic,
      aiKeywordsType: data.ai_keywords_type,
      aiKeywordsGeneratedAt: data.ai_keywords_generated_at,
      aiKeywordsMessageCount: data.ai_keywords_message_count,
    };

    // Only set optional properties if they have values
    if (data.metadata) {
      record.metadata = data.metadata as Record<string, unknown>;
    }
    if (data.created_at) {
      record.createdAt = data.created_at;
    }
    if (data.updated_at) {
      record.updatedAt = data.updated_at;
    }

    return record;
  }
}

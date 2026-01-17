/**
 * SQLite implementation of IChatHistoryRepository
 */

import type Database from 'better-sqlite3';
import type {
  ChatHistoryInput,
  ChatHistoryRecord,
  IChatHistoryRepository,
} from '../../../interfaces/repositories.js';
import type { AgentType, ChatMessage } from '../../../types.js';

interface ChatHistoryRow {
  id: string;
  account_id: string;
  project_id: string | null;
  agent_type: string;
  timestamp: string;
  messages: string;
  metadata: string | null;
  latest_message_timestamp: string | null;
  ai_summary: string | null;
  ai_summary_generated_at: string | null;
  ai_summary_message_count: number | null;
  ai_title: string | null;
  ai_title_generated_at: string | null;
  ai_keywords_type: string | null;
  ai_keywords_topic: string | null;
  ai_keywords_generated_at: string | null;
  ai_keywords_message_count: number | null;
  created_at: string;
  updated_at: string;
}

export class SQLiteChatHistoryRepository implements IChatHistoryRepository {
  constructor(
    private db: Database.Database,
    private userId: string
  ) {}

  async upsert(history: ChatHistoryInput): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      const messagesJson = JSON.stringify(history.messages);
      const metadataJson = history.metadata ? JSON.stringify(history.metadata) : null;

      const stmt = this.db.prepare(`
        INSERT INTO chat_histories (
          id, account_id, project_id, agent_type, timestamp, messages, metadata,
          latest_message_timestamp, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          project_id = excluded.project_id,
          agent_type = excluded.agent_type,
          timestamp = excluded.timestamp,
          messages = excluded.messages,
          metadata = excluded.metadata,
          latest_message_timestamp = excluded.latest_message_timestamp,
          updated_at = excluded.updated_at
      `);

      stmt.run(
        history.id,
        history.userId,
        history.projectId,
        history.agentType,
        history.timestamp,
        messagesJson,
        metadataJson,
        history.latestMessageTimestamp,
        now,
        now
      );

      return true;
    } catch (error) {
      console.error('[SQLiteChatHistoryRepository] Error upserting:', error);
      return false;
    }
  }

  async findById(id: string, userId: string): Promise<ChatHistoryRecord | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM chat_histories
      WHERE id = ? AND account_id = ?
    `);
    const row = stmt.get(id, userId) as ChatHistoryRow | undefined;

    if (!row) {
      return null;
    }

    return this.mapToChatHistoryRecord(row);
  }

  async findRecentByUser(userId: string, since: Date): Promise<ChatHistoryRecord[]> {
    const sinceIso = since.toISOString();
    const stmt = this.db.prepare(`
      SELECT * FROM chat_histories
      WHERE account_id = ?
        AND (latest_message_timestamp >= ? OR updated_at >= ?)
      ORDER BY latest_message_timestamp DESC
    `);
    const rows = stmt.all(userId, sinceIso, sinceIso) as ChatHistoryRow[];

    return rows.map((row) => this.mapToChatHistoryRecord(row));
  }

  async updateAiSummary(id: string, summary: string, messageCount: number): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        UPDATE chat_histories
        SET ai_summary = ?,
            ai_summary_generated_at = ?,
            ai_summary_message_count = ?,
            updated_at = ?
        WHERE id = ?
      `);
      stmt.run(summary, now, messageCount, now, id);
      return true;
    } catch (error) {
      console.error('[SQLiteChatHistoryRepository] Error updating AI summary:', error);
      return false;
    }
  }

  async updateAiKeywords(
    id: string,
    keywords: { type: string[]; topic: string[] },
    messageCount: number
  ): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        UPDATE chat_histories
        SET ai_keywords_type = ?,
            ai_keywords_topic = ?,
            ai_keywords_generated_at = ?,
            ai_keywords_message_count = ?,
            updated_at = ?
        WHERE id = ?
      `);
      stmt.run(
        JSON.stringify(keywords.type),
        JSON.stringify(keywords.topic),
        now,
        messageCount,
        now,
        id
      );
      return true;
    } catch (error) {
      console.error('[SQLiteChatHistoryRepository] Error updating AI keywords:', error);
      return false;
    }
  }

  async updateAiTitle(id: string, title: string): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        UPDATE chat_histories
        SET ai_title = ?,
            ai_title_generated_at = ?,
            updated_at = ?
        WHERE id = ?
      `);
      stmt.run(title, now, now, id);
      return true;
    } catch (error) {
      console.error('[SQLiteChatHistoryRepository] Error updating AI title:', error);
      return false;
    }
  }

  private mapToChatHistoryRecord(row: ChatHistoryRow): ChatHistoryRecord {
    return {
      id: row.id,
      userId: row.account_id,
      projectId: row.project_id,
      agentType: row.agent_type as AgentType,
      timestamp: row.timestamp,
      messages: JSON.parse(row.messages) as ChatMessage[],
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      latestMessageTimestamp: row.latest_message_timestamp,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      aiSummary: row.ai_summary,
      aiSummaryGeneratedAt: row.ai_summary_generated_at,
      aiSummaryMessageCount: row.ai_summary_message_count,
      aiTitle: row.ai_title,
      aiTitleGeneratedAt: row.ai_title_generated_at,
      aiKeywordsType: row.ai_keywords_type ? JSON.parse(row.ai_keywords_type) : null,
      aiKeywordsTopic: row.ai_keywords_topic ? JSON.parse(row.ai_keywords_topic) : null,
      aiKeywordsGeneratedAt: row.ai_keywords_generated_at,
      aiKeywordsMessageCount: row.ai_keywords_message_count,
    };
  }
}

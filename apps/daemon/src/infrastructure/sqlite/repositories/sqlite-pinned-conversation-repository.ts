/**
 * SQLite implementation of IPinnedConversationRepository
 */

import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  IPinnedConversationRepository,
  PinnedConversation,
} from '../../../interfaces/repositories.js';

interface PinnedConversationRow {
  id: string;
  user_id: string;
  conversation_id: string;
  pinned_at: string;
  created_at: string;
  updated_at: string;
}

export class SQLitePinnedConversationRepository implements IPinnedConversationRepository {
  constructor(
    private db: Database.Database,
    _userId: string
  ) {}

  async getPinnedConversations(userId: string): Promise<PinnedConversation[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM pinned_conversations
      WHERE user_id = ?
      ORDER BY pinned_at DESC
    `);
    const rows = stmt.all(userId) as PinnedConversationRow[];

    return rows.map((row) => this.mapToPinnedConversation(row));
  }

  async pinConversation(
    userId: string,
    conversationId: string
  ): Promise<PinnedConversation | null> {
    try {
      const now = new Date().toISOString();
      const id = randomUUID();

      const stmt = this.db.prepare(`
        INSERT INTO pinned_conversations (
          id, user_id, conversation_id, pinned_at, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, conversation_id) DO UPDATE SET
          pinned_at = excluded.pinned_at,
          updated_at = excluded.updated_at
      `);

      stmt.run(id, userId, conversationId, now, now, now);

      return this.findByConversationId(userId, conversationId);
    } catch (error) {
      console.error('[SQLitePinnedConversationRepository] Error pinning conversation:', error);
      return null;
    }
  }

  async unpinConversation(userId: string, conversationId: string): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM pinned_conversations
        WHERE user_id = ? AND conversation_id = ?
      `);
      stmt.run(userId, conversationId);
      return true;
    } catch (error) {
      console.error('[SQLitePinnedConversationRepository] Error unpinning conversation:', error);
      return false;
    }
  }

  async isConversationPinned(userId: string, conversationId: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      SELECT 1 FROM pinned_conversations
      WHERE user_id = ? AND conversation_id = ?
      LIMIT 1
    `);
    const row = stmt.get(userId, conversationId);
    return !!row;
  }

  private findByConversationId(userId: string, conversationId: string): PinnedConversation | null {
    const stmt = this.db.prepare(`
      SELECT * FROM pinned_conversations
      WHERE user_id = ? AND conversation_id = ?
    `);
    const row = stmt.get(userId, conversationId) as PinnedConversationRow | undefined;

    if (!row) {
      return null;
    }

    return this.mapToPinnedConversation(row);
  }

  private mapToPinnedConversation(row: PinnedConversationRow): PinnedConversation {
    return {
      id: row.id,
      userId: row.user_id,
      conversationId: row.conversation_id,
      pinnedAt: row.pinned_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

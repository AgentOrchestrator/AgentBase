/**
 * SQLite implementation of IApiKeyRepository
 */

import type Database from 'better-sqlite3';
import type { IApiKeyRepository } from '../../../interfaces/repositories.js';

interface ApiKeyRow {
  id: string;
  account_id: string;
  provider: string;
  api_key: string;
  is_active: number;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export class SQLiteApiKeyRepository implements IApiKeyRepository {
  constructor(
    private db: Database.Database,
    _userId: string
  ) {}

  async findActiveKey(
    userId: string,
    provider: string
  ): Promise<{ key: string; provider: string } | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM llm_api_keys
      WHERE account_id = ? AND provider = ? AND is_active = 1
      LIMIT 1
    `);
    const row = stmt.get(userId, provider) as ApiKeyRow | undefined;

    if (!row) {
      return null;
    }

    return {
      key: row.api_key,
      provider: row.provider,
    };
  }

  async findDefaultProvider(userId: string): Promise<string | null> {
    const stmt = this.db.prepare(`
      SELECT provider FROM llm_api_keys
      WHERE account_id = ? AND is_default = 1 AND is_active = 1
      LIMIT 1
    `);
    const row = stmt.get(userId) as { provider: string } | undefined;

    return row?.provider ?? null;
  }

  /**
   * Save or update an API key
   */
  async saveApiKey(
    userId: string,
    provider: string,
    apiKey: string,
    isDefault: boolean = false
  ): Promise<void> {
    const now = new Date().toISOString();
    const id = `${userId}-${provider}`;

    // If setting as default, unset other defaults
    if (isDefault) {
      this.db
        .prepare(`
        UPDATE llm_api_keys SET is_default = 0 WHERE account_id = ?
      `)
        .run(userId);
    }

    const stmt = this.db.prepare(`
      INSERT INTO llm_api_keys (
        id, account_id, provider, api_key, is_active, is_default, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, 1, ?, ?, ?)
      ON CONFLICT(account_id, provider) DO UPDATE SET
        api_key = excluded.api_key,
        is_active = 1,
        is_default = excluded.is_default,
        updated_at = excluded.updated_at
    `);

    stmt.run(id, userId, provider, apiKey, isDefault ? 1 : 0, now, now);
  }

  /**
   * Deactivate an API key
   */
  async deactivateApiKey(userId: string, provider: string): Promise<void> {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE llm_api_keys
      SET is_active = 0, updated_at = ?
      WHERE account_id = ? AND provider = ?
    `);
    stmt.run(now, userId, provider);
  }
}

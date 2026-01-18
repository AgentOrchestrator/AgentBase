/**
 * SQLite implementation of IUserPreferencesRepository
 */

import type Database from 'better-sqlite3';
import type {
  IUserPreferencesRepository,
  UserPreferences,
} from '../../../interfaces/repositories.js';

interface UserPreferencesRow {
  user_id: string;
  ai_summary_enabled: number;
  ai_title_enabled: number;
  ai_model_provider: string | null;
  ai_model_name: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PREFERENCES: Omit<UserPreferences, 'userId'> = {
  aiSummaryEnabled: true,
  aiTitleEnabled: true,
  aiModelProvider: 'openai',
  aiModelName: 'gpt-4o-mini',
};

export class SQLiteUserPreferencesRepository implements IUserPreferencesRepository {
  constructor(
    private db: Database.Database,
    private userId: string
  ) {}

  async findByUserId(userId: string): Promise<UserPreferences> {
    const stmt = this.db.prepare(`
      SELECT * FROM user_preferences WHERE user_id = ?
    `);
    const row = stmt.get(userId) as UserPreferencesRow | undefined;

    if (!row) {
      // Return default preferences
      return {
        userId,
        ...DEFAULT_PREFERENCES,
      };
    }

    const result: UserPreferences = {
      userId: row.user_id,
      aiSummaryEnabled: row.ai_summary_enabled === 1,
      aiTitleEnabled: row.ai_title_enabled === 1,
    };

    if (row.ai_model_provider !== null) {
      result.aiModelProvider = row.ai_model_provider;
    }
    if (row.ai_model_name !== null) {
      result.aiModelName = row.ai_model_name;
    }

    return result;
  }

  /**
   * Save or update user preferences
   */
  async savePreferences(preferences: UserPreferences): Promise<UserPreferences> {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO user_preferences (
        user_id, ai_summary_enabled, ai_title_enabled,
        ai_model_provider, ai_model_name, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        ai_summary_enabled = excluded.ai_summary_enabled,
        ai_title_enabled = excluded.ai_title_enabled,
        ai_model_provider = excluded.ai_model_provider,
        ai_model_name = excluded.ai_model_name,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      preferences.userId,
      preferences.aiSummaryEnabled ? 1 : 0,
      preferences.aiTitleEnabled ? 1 : 0,
      preferences.aiModelProvider ?? null,
      preferences.aiModelName ?? null,
      now,
      now
    );

    return this.findByUserId(preferences.userId);
  }
}

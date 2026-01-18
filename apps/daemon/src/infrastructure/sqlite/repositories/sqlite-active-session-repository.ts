/**
 * SQLite implementation of IActiveSessionRepository
 */

import type Database from 'better-sqlite3';
import type {
  ActiveSession,
  ActiveSessionInput,
  IActiveSessionRepository,
} from '../../../interfaces/repositories.js';

interface ActiveSessionRow {
  id: string;
  user_id: string;
  project_id: string | null;
  editor_type: string;
  workspace_path: string | null;
  is_active: number;
  last_activity_at: string;
  recent_files: string | null;
  session_metadata: string | null;
  created_at: string;
  updated_at: string;
}

export class SQLiteActiveSessionRepository implements IActiveSessionRepository {
  constructor(
    private db: Database.Database,
    _userId: string
  ) {}

  async getActiveSessions(userId: string): Promise<ActiveSession[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM active_sessions
      WHERE user_id = ? AND is_active = 1
      ORDER BY last_activity_at DESC
    `);
    const rows = stmt.all(userId) as ActiveSessionRow[];

    return rows.map((row) => this.mapToActiveSession(row));
  }

  async getActiveSessionsByEditor(userId: string, editorType: string): Promise<ActiveSession[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM active_sessions
      WHERE user_id = ? AND editor_type = ? AND is_active = 1
      ORDER BY last_activity_at DESC
    `);
    const rows = stmt.all(userId, editorType) as ActiveSessionRow[];

    return rows.map((row) => this.mapToActiveSession(row));
  }

  async upsertActiveSession(
    userId: string,
    sessionId: string,
    input: ActiveSessionInput
  ): Promise<ActiveSession | null> {
    try {
      const now = new Date().toISOString();
      const recentFilesJson = input.recentFiles ? JSON.stringify(input.recentFiles) : null;
      const metadataJson = input.sessionMetadata ? JSON.stringify(input.sessionMetadata) : null;

      const stmt = this.db.prepare(`
        INSERT INTO active_sessions (
          id, user_id, project_id, editor_type, workspace_path,
          is_active, last_activity_at, recent_files, session_metadata,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          project_id = excluded.project_id,
          editor_type = excluded.editor_type,
          workspace_path = excluded.workspace_path,
          is_active = 1,
          last_activity_at = excluded.last_activity_at,
          recent_files = excluded.recent_files,
          session_metadata = excluded.session_metadata,
          updated_at = excluded.updated_at
      `);

      stmt.run(
        sessionId,
        userId,
        input.projectId ?? null,
        input.editorType,
        input.workspacePath ?? null,
        now,
        recentFilesJson,
        metadataJson,
        now,
        now
      );

      return this.findById(sessionId);
    } catch (error) {
      console.error('[SQLiteActiveSessionRepository] Error upserting session:', error);
      return null;
    }
  }

  async deactivateSession(sessionId: string): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        UPDATE active_sessions
        SET is_active = 0, updated_at = ?
        WHERE id = ?
      `);
      stmt.run(now, sessionId);
      return true;
    } catch (error) {
      console.error('[SQLiteActiveSessionRepository] Error deactivating session:', error);
      return false;
    }
  }

  async updateLastActivity(sessionId: string): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        UPDATE active_sessions
        SET last_activity_at = ?, updated_at = ?
        WHERE id = ?
      `);
      stmt.run(now, now, sessionId);
      return true;
    } catch (error) {
      console.error('[SQLiteActiveSessionRepository] Error updating last activity:', error);
      return false;
    }
  }

  private findById(sessionId: string): ActiveSession | null {
    const stmt = this.db.prepare(`
      SELECT * FROM active_sessions WHERE id = ?
    `);
    const row = stmt.get(sessionId) as ActiveSessionRow | undefined;

    if (!row) {
      return null;
    }

    return this.mapToActiveSession(row);
  }

  private mapToActiveSession(row: ActiveSessionRow): ActiveSession {
    return {
      id: row.id,
      userId: row.user_id,
      projectId: row.project_id,
      editorType: row.editor_type,
      workspacePath: row.workspace_path,
      isActive: row.is_active === 1,
      lastActivityAt: row.last_activity_at,
      recentFiles: row.recent_files ? JSON.parse(row.recent_files) : null,
      sessionMetadata: row.session_metadata ? JSON.parse(row.session_metadata) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

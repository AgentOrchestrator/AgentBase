/**
 * SQLite implementation of IUserRepository
 */

import type Database from 'better-sqlite3';
import type { IUserRepository, User } from '../../../interfaces/repositories.js';
import { randomUUID } from 'crypto';

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  github_username: string | null;
  github_avatar_url: string | null;
  is_admin: number;
  created_at: string;
  updated_at: string;
}

export class SQLiteUserRepository implements IUserRepository {
  constructor(private db: Database.Database) {}

  async findById(userId: string): Promise<User | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM users WHERE id = ?
    `);
    const row = stmt.get(userId) as UserRow | undefined;

    if (!row) {
      return null;
    }

    return this.mapToUser(row);
  }

  async findByEmail(email: string): Promise<User | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM users WHERE email = ?
    `);
    const row = stmt.get(email) as UserRow | undefined;

    if (!row) {
      return null;
    }

    return this.mapToUser(row);
  }

  async updateProfile(
    userId: string,
    updates: Partial<Pick<User, 'displayName' | 'avatarUrl'>>
  ): Promise<User | null> {
    const now = new Date().toISOString();
    const setClauses: string[] = ['updated_at = ?'];
    const values: (string | null)[] = [now];

    if (updates.displayName !== undefined) {
      setClauses.push('display_name = ?');
      values.push(updates.displayName);
    }

    if (updates.avatarUrl !== undefined) {
      setClauses.push('avatar_url = ?');
      values.push(updates.avatarUrl);
    }

    values.push(userId);

    const stmt = this.db.prepare(`
      UPDATE users
      SET ${setClauses.join(', ')}
      WHERE id = ?
    `);
    stmt.run(...values);

    return this.findById(userId);
  }

  /**
   * Create or get the local user
   * Used by SQLiteRepositoryFactory to ensure a local user exists
   */
  async getOrCreateLocalUser(userId: string): Promise<User> {
    const existing = await this.findById(userId);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO users (id, email, display_name, is_admin, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(userId, 'local@localhost', 'Local User', 1, now, now);

    return (await this.findById(userId))!;
  }

  private mapToUser(row: UserRow): User {
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      githubUsername: row.github_username,
      githubAvatarUrl: row.github_avatar_url,
      isAdmin: row.is_admin === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

/**
 * SQLite implementation of IProjectRepository
 */

import type Database from 'better-sqlite3';
import type { IProjectRepository, Project, ProjectInput } from '../../../interfaces/repositories.js';
import { randomUUID } from 'crypto';

interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  project_path: string | null;
  description: string | null;
  is_default: number;
  workspace_metadata: string | null;
  created_at: string;
  updated_at: string;
}

export class SQLiteProjectRepository implements IProjectRepository {
  constructor(
    private db: Database.Database,
    private userId: string
  ) {}

  async findDefaultProject(userId: string): Promise<Project | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM projects
      WHERE user_id = ? AND is_default = 1
      LIMIT 1
    `);
    const row = stmt.get(userId) as ProjectRow | undefined;

    if (!row) {
      return null;
    }

    return this.mapToProject(row);
  }

  async createDefaultProject(userId: string): Promise<Project> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO projects (id, user_id, name, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId, 'Uncategorized', 1, now, now);

    return (await this.findDefaultProject(userId))!;
  }

  async findOrCreateDefaultProject(userId: string): Promise<Project> {
    const existing = await this.findDefaultProject(userId);
    if (existing) {
      return existing;
    }
    return this.createDefaultProject(userId);
  }

  async findByUserAndName(userId: string, name: string): Promise<Project | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM projects
      WHERE user_id = ? AND name = ?
      LIMIT 1
    `);
    const row = stmt.get(userId, name) as ProjectRow | undefined;

    if (!row) {
      return null;
    }

    return this.mapToProject(row);
  }

  async upsertProject(userId: string, project: ProjectInput): Promise<Project> {
    const existing = await this.findByUserAndName(userId, project.name);
    const now = new Date().toISOString();

    if (existing) {
      // Update existing project
      const setClauses: string[] = ['updated_at = ?'];
      const values: (string | number | null)[] = [now];

      if (project.path !== undefined) {
        setClauses.push('project_path = ?');
        values.push(project.path);
      }

      if (project.description !== undefined) {
        setClauses.push('description = ?');
        values.push(project.description ?? null);
      }

      if (project.isDefault !== undefined) {
        setClauses.push('is_default = ?');
        values.push(project.isDefault ? 1 : 0);
      }

      if (project.workspaceMetadata !== undefined) {
        setClauses.push('workspace_metadata = ?');
        values.push(JSON.stringify(project.workspaceMetadata));
      }

      values.push(existing.id);

      const stmt = this.db.prepare(`
        UPDATE projects
        SET ${setClauses.join(', ')}
        WHERE id = ?
      `);
      stmt.run(...values);

      return (await this.findByUserAndName(userId, project.name))!;
    } else {
      // Create new project
      const id = randomUUID();
      const stmt = this.db.prepare(`
        INSERT INTO projects (id, user_id, name, project_path, description, is_default, workspace_metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        id,
        userId,
        project.name,
        project.path,
        project.description ?? null,
        project.isDefault ? 1 : 0,
        project.workspaceMetadata ? JSON.stringify(project.workspaceMetadata) : null,
        now,
        now
      );

      return (await this.findByUserAndName(userId, project.name))!;
    }
  }

  private mapToProject(row: ProjectRow): Project {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      path: row.project_path,
      description: row.description,
      isDefault: row.is_default === 1,
      workspaceMetadata: row.workspace_metadata
        ? JSON.parse(row.workspace_metadata)
        : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

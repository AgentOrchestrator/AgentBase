/**
 * SQLite implementation of ICanvasLayoutRepository
 */

import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  CanvasNodePosition,
  ICanvasLayoutRepository,
} from '../../../interfaces/repositories.js';

interface CanvasLayoutRow {
  id: string;
  user_id: string;
  node_id: string;
  position_x: number;
  position_y: number;
  created_at: string;
  updated_at: string;
}

export class SQLiteCanvasLayoutRepository implements ICanvasLayoutRepository {
  constructor(
    private db: Database.Database,
    _userId: string
  ) {}

  async getNodePositions(userId: string): Promise<CanvasNodePosition[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM user_canvas_layouts WHERE user_id = ?
    `);
    const rows = stmt.all(userId) as CanvasLayoutRow[];

    return rows.map((row) => this.mapToCanvasNodePosition(row));
  }

  async saveNodePosition(
    userId: string,
    nodeId: string,
    positionX: number,
    positionY: number
  ): Promise<CanvasNodePosition | null> {
    try {
      const now = new Date().toISOString();
      const id = randomUUID();

      const stmt = this.db.prepare(`
        INSERT INTO user_canvas_layouts (
          id, user_id, node_id, position_x, position_y, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, node_id) DO UPDATE SET
          position_x = excluded.position_x,
          position_y = excluded.position_y,
          updated_at = excluded.updated_at
      `);

      stmt.run(id, userId, nodeId, positionX, positionY, now, now);

      return this.findByNodeId(userId, nodeId);
    } catch (error) {
      console.error('[SQLiteCanvasLayoutRepository] Error saving node position:', error);
      return null;
    }
  }

  async saveNodePositions(
    userId: string,
    positions: Array<{ nodeId: string; positionX: number; positionY: number }>
  ): Promise<boolean> {
    try {
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`
        INSERT INTO user_canvas_layouts (
          id, user_id, node_id, position_x, position_y, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, node_id) DO UPDATE SET
          position_x = excluded.position_x,
          position_y = excluded.position_y,
          updated_at = excluded.updated_at
      `);

      const transaction = this.db.transaction(() => {
        for (const pos of positions) {
          const id = randomUUID();
          stmt.run(id, userId, pos.nodeId, pos.positionX, pos.positionY, now, now);
        }
      });

      transaction();
      return true;
    } catch (error) {
      console.error('[SQLiteCanvasLayoutRepository] Error saving node positions:', error);
      return false;
    }
  }

  async deleteNodePosition(userId: string, nodeId: string): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM user_canvas_layouts WHERE user_id = ? AND node_id = ?
      `);
      stmt.run(userId, nodeId);
      return true;
    } catch (error) {
      console.error('[SQLiteCanvasLayoutRepository] Error deleting node position:', error);
      return false;
    }
  }

  async clearAllPositions(userId: string): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM user_canvas_layouts WHERE user_id = ?
      `);
      stmt.run(userId);
      return true;
    } catch (error) {
      console.error('[SQLiteCanvasLayoutRepository] Error clearing positions:', error);
      return false;
    }
  }

  private findByNodeId(userId: string, nodeId: string): CanvasNodePosition | null {
    const stmt = this.db.prepare(`
      SELECT * FROM user_canvas_layouts WHERE user_id = ? AND node_id = ?
    `);
    const row = stmt.get(userId, nodeId) as CanvasLayoutRow | undefined;

    if (!row) {
      return null;
    }

    return this.mapToCanvasNodePosition(row);
  }

  private mapToCanvasNodePosition(row: CanvasLayoutRow): CanvasNodePosition {
    return {
      id: row.id,
      userId: row.user_id,
      nodeId: row.node_id,
      positionX: row.position_x,
      positionY: row.position_y,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

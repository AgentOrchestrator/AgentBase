/**
 * SQLite implementation of the IDatabase interface
 * Stores canvas state in a local SQLite database
 */

import sqlite3 from 'sqlite3';
import { IDatabase } from './IDatabase';
import { CanvasState, CanvasMetadata, CanvasNode, CanvasEdge } from '../types/database';
import type { CodingAgentState } from '../../../types/coding-agent-status';

export class SQLiteDatabase implements IDatabase {
  private db: sqlite3.Database;

  constructor(databasePath: string) {
    this.db = new sqlite3.Database(databasePath);
  }

  async initialize(): Promise<void> {
    // Enable foreign keys
    await this.run('PRAGMA foreign_keys = ON');

    // Create canvases table
    await this.run(`
      CREATE TABLE IF NOT EXISTS canvases (
        id TEXT PRIMARY KEY,
        name TEXT,
        viewport TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create nodes table
    await this.run(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT NOT NULL,
        canvas_id TEXT NOT NULL,
        type TEXT NOT NULL,
        position_x REAL NOT NULL,
        position_y REAL NOT NULL,
        data TEXT NOT NULL,
        style TEXT,
        PRIMARY KEY (id, canvas_id),
        FOREIGN KEY (canvas_id) REFERENCES canvases(id) ON DELETE CASCADE
      )
    `);

    // Create edges table
    await this.run(`
      CREATE TABLE IF NOT EXISTS edges (
        id TEXT NOT NULL,
        canvas_id TEXT NOT NULL,
        source TEXT NOT NULL,
        target TEXT NOT NULL,
        type TEXT,
        data TEXT,
        style TEXT,
        PRIMARY KEY (id, canvas_id),
        FOREIGN KEY (canvas_id) REFERENCES canvases(id) ON DELETE CASCADE
      )
    `);

    // Create settings table for storing app settings (like current canvas)
    await this.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Create indices for better query performance
    await this.run('CREATE INDEX IF NOT EXISTS idx_nodes_canvas_id ON nodes(canvas_id)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_edges_canvas_id ON edges(canvas_id)');

    // Create agent_statuses table for CodingAgentStatusManager
    await this.run(`
      CREATE TABLE IF NOT EXISTS agent_statuses (
        agent_id TEXT PRIMARY KEY,
        agent_type TEXT NOT NULL,
        status_info TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
  }

  async saveCanvas(canvasId: string, state: CanvasState): Promise<void> {
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      this.db.serialize(async () => {
        try {
          // Start transaction
          await this.run('BEGIN TRANSACTION');

          // Check if canvas exists
          const existingCanvas = await this.get<{ id: string }>(
            'SELECT id FROM canvases WHERE id = ?',
            [canvasId]
          );

          if (existingCanvas) {
            // Update existing canvas
            await this.run(
              `UPDATE canvases SET name = ?, viewport = ?, updated_at = ? WHERE id = ?`,
              [
                state.name || null,
                state.viewport ? JSON.stringify(state.viewport) : null,
                now,
                canvasId
              ]
            );
          } else {
            // Insert new canvas
            await this.run(
              `INSERT INTO canvases (id, name, viewport, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
              [
                canvasId,
                state.name || null,
                state.viewport ? JSON.stringify(state.viewport) : null,
                now,
                now
              ]
            );
          }

          // Insert or replace nodes
          for (const node of state.nodes) {
            await this.run(
              `INSERT OR REPLACE INTO nodes (id, canvas_id, type, position_x, position_y, data, style) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                node.id,
                canvasId,
                node.type,
                node.position.x,
                node.position.y,
                JSON.stringify(node.data),
                node.style ? JSON.stringify(node.style) : null
              ]
            );
          }

          // Insert or replace edges
          for (const edge of state.edges) {
            await this.run(
              `INSERT OR REPLACE INTO edges (id, canvas_id, source, target, type, data, style) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                edge.id,
                canvasId,
                edge.source,
                edge.target,
                edge.type || null,
                edge.data ? JSON.stringify(edge.data) : null,
                edge.style ? JSON.stringify(edge.style) : null
              ]
            );
          }

          // Delete nodes and edges that are no longer in the state
          if (state.nodes.length > 0) {
            const nodeIds = state.nodes.map(n => n.id);
            const placeholders = nodeIds.map(() => '?').join(',');
            await this.run(
              `DELETE FROM nodes WHERE canvas_id = ? AND id NOT IN (${placeholders})`,
              [canvasId, ...nodeIds]
            );
          } else {
            // If no nodes in state, delete all nodes for this canvas
            await this.run('DELETE FROM nodes WHERE canvas_id = ?', [canvasId]);
          }

          if (state.edges.length > 0) {
            const edgeIds = state.edges.map(e => e.id);
            const placeholders = edgeIds.map(() => '?').join(',');
            await this.run(
              `DELETE FROM edges WHERE canvas_id = ? AND id NOT IN (${placeholders})`,
              [canvasId, ...edgeIds]
            );
          } else {
            // If no edges in state, delete all edges for this canvas
            await this.run('DELETE FROM edges WHERE canvas_id = ?', [canvasId]);
          }

          // Commit transaction
          await this.run('COMMIT');
          resolve();
        } catch (error) {
          // Rollback on error
          await this.run('ROLLBACK').catch(() => {});
          reject(error);
        }
      });
    });
  }

  async loadCanvas(canvasId: string): Promise<CanvasState | null> {
    // Load canvas metadata
    const canvas = await this.get<{
      id: string;
      name: string | null;
      viewport: string | null;
      created_at: string;
      updated_at: string;
    }>('SELECT id, name, viewport, created_at, updated_at FROM canvases WHERE id = ?', [canvasId]);

    if (!canvas) {
      return null;
    }

    // Load nodes
    const nodeRows = await this.all<{
      id: string;
      type: string;
      position_x: number;
      position_y: number;
      data: string;
      style: string | null;
    }>('SELECT id, type, position_x, position_y, data, style FROM nodes WHERE canvas_id = ?', [
      canvasId
    ]);

    const nodes: CanvasNode[] = nodeRows.map(row => ({
      id: row.id,
      type: row.type as 'custom' | 'terminal' | 'workspace',
      position: {
        x: row.position_x,
        y: row.position_y
      },
      data: JSON.parse(row.data),
      style: row.style ? JSON.parse(row.style) : undefined
    }));

    // Load edges
    const edgeRows = await this.all<{
      id: string;
      source: string;
      target: string;
      type: string | null;
      data: string | null;
      style: string | null;
    }>('SELECT id, source, target, type, data, style FROM edges WHERE canvas_id = ?', [canvasId]);

    const edges: CanvasEdge[] = edgeRows.map(row => ({
      id: row.id,
      source: row.source,
      target: row.target,
      type: row.type || undefined,
      data: row.data ? JSON.parse(row.data) : undefined,
      style: row.style ? JSON.parse(row.style) : undefined
    }));

    return {
      id: canvas.id,
      name: canvas.name || undefined,
      nodes,
      edges,
      viewport: canvas.viewport ? JSON.parse(canvas.viewport) : undefined,
      createdAt: canvas.created_at,
      updatedAt: canvas.updated_at
    };
  }

  async listCanvases(): Promise<CanvasMetadata[]> {
    const canvases = await this.all<{
      id: string;
      name: string | null;
      created_at: string;
      updated_at: string;
      node_count: number;
      edge_count: number;
    }>(`
      SELECT
        c.id,
        c.name,
        c.created_at,
        c.updated_at,
        COUNT(DISTINCT n.id) as node_count,
        COUNT(DISTINCT e.id) as edge_count
      FROM canvases c
      LEFT JOIN nodes n ON c.id = n.canvas_id
      LEFT JOIN edges e ON c.id = e.canvas_id
      GROUP BY c.id
      ORDER BY c.updated_at DESC
    `);

    return canvases.map(canvas => ({
      id: canvas.id,
      name: canvas.name || undefined,
      nodeCount: canvas.node_count,
      edgeCount: canvas.edge_count,
      createdAt: canvas.created_at,
      updatedAt: canvas.updated_at
    }));
  }

  async deleteCanvas(canvasId: string): Promise<void> {
    // Foreign key constraints will cascade delete nodes and edges
    await this.run('DELETE FROM canvases WHERE id = ?', [canvasId]);
  }

  async getCurrentCanvasId(): Promise<string | null> {
    const result = await this.get<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      ['current_canvas_id']
    );

    return result?.value || null;
  }

  async setCurrentCanvasId(canvasId: string): Promise<void> {
    await this.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
      'current_canvas_id',
      canvasId
    ]);
  }

  close(): void {
    this.db.close();
  }

  // ===========================================================================
  // Agent Status Methods
  // ===========================================================================

  async saveAgentStatus(agentId: string, state: CodingAgentState): Promise<void> {
    const existing = await this.get<{ agent_id: string }>(
      'SELECT agent_id FROM agent_statuses WHERE agent_id = ?',
      [agentId]
    );

    if (existing) {
      await this.run(
        `UPDATE agent_statuses SET
          agent_type = ?,
          status_info = ?,
          title = ?,
          summary = ?,
          updated_at = ?
        WHERE agent_id = ?`,
        [
          state.agentType,
          JSON.stringify(state.statusInfo),
          JSON.stringify(state.title),
          state.summary,
          state.updatedAt,
          agentId,
        ]
      );
    } else {
      await this.run(
        `INSERT INTO agent_statuses
          (agent_id, agent_type, status_info, title, summary, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          agentId,
          state.agentType,
          JSON.stringify(state.statusInfo),
          JSON.stringify(state.title),
          state.summary,
          state.createdAt,
          state.updatedAt,
        ]
      );
    }
  }

  async loadAgentStatus(agentId: string): Promise<CodingAgentState | null> {
    const row = await this.get<{
      agent_id: string;
      agent_type: string;
      status_info: string;
      title: string;
      summary: string | null;
      created_at: number;
      updated_at: number;
    }>(
      'SELECT agent_id, agent_type, status_info, title, summary, created_at, updated_at FROM agent_statuses WHERE agent_id = ?',
      [agentId]
    );

    if (!row) {
      return null;
    }

    return {
      agentId: row.agent_id,
      agentType: row.agent_type as CodingAgentState['agentType'],
      statusInfo: JSON.parse(row.status_info),
      title: JSON.parse(row.title),
      summary: row.summary,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async deleteAgentStatus(agentId: string): Promise<void> {
    await this.run('DELETE FROM agent_statuses WHERE agent_id = ?', [agentId]);
  }

  async loadAllAgentStatuses(): Promise<CodingAgentState[]> {
    const rows = await this.all<{
      agent_id: string;
      agent_type: string;
      status_info: string;
      title: string;
      summary: string | null;
      created_at: number;
      updated_at: number;
    }>('SELECT agent_id, agent_type, status_info, title, summary, created_at, updated_at FROM agent_statuses');

    return rows.map((row) => ({
      agentId: row.agent_id,
      agentType: row.agent_type as CodingAgentState['agentType'],
      statusInfo: JSON.parse(row.status_info),
      title: JSON.parse(row.title),
      summary: row.summary,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  // Helper methods to promisify sqlite3 callbacks
  private run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T | undefined);
      });
    });
  }

  private all<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }
}

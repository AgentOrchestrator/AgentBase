/**
 * SQLite implementation of the IDatabase interface
 * Stores canvas state in a local SQLite database
 */

import { randomUUID } from 'node:crypto';
import type { RecentWorkspace } from '@agent-orchestrator/shared';
import sqlite3 from 'sqlite3';
import type { CodingAgentState } from '../../../types/coding-agent-status';
import type {
  AddOrchestratorMessageInput,
  OrchestratorConversation,
  OrchestratorMessage,
} from '../services/orchestrator/interfaces';
import type { CanvasEdge, CanvasMetadata, CanvasNode, CanvasState } from '../types/database';
import type { IDatabase } from './IDatabase';

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

    // Create recent_workspaces table
    await this.run(`
      CREATE TABLE IF NOT EXISTS recent_workspaces (
        path TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        last_opened_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    // Create index for sorting by last opened
    await this.run(
      'CREATE INDEX IF NOT EXISTS idx_recent_workspaces_last_opened ON recent_workspaces(last_opened_at DESC)'
    );

    // Create session_summaries table for caching AI-generated summaries
    await this.run(`
      CREATE TABLE IF NOT EXISTS session_summaries (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        workspace_path TEXT NOT NULL,
        summary TEXT NOT NULL,
        message_count INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(session_id, workspace_path)
      )
    `);

    // Create index for session lookup
    await this.run(
      'CREATE INDEX IF NOT EXISTS idx_session_summaries_session_id ON session_summaries(session_id)'
    );

    // Create orchestrator_conversations table
    await this.run(`
      CREATE TABLE IF NOT EXISTS orchestrator_conversations (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Create orchestrator_messages table
    await this.run(`
      CREATE TABLE IF NOT EXISTS orchestrator_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        tool_calls TEXT,
        FOREIGN KEY (conversation_id) REFERENCES orchestrator_conversations(id) ON DELETE CASCADE
      )
    `);

    // Create indices for orchestrator tables
    await this.run(
      'CREATE INDEX IF NOT EXISTS idx_orchestrator_messages_conversation_id ON orchestrator_messages(conversation_id)'
    );
    await this.run(
      'CREATE INDEX IF NOT EXISTS idx_orchestrator_conversations_updated_at ON orchestrator_conversations(updated_at DESC)'
    );
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
                canvasId,
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
                now,
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
                node.style ? JSON.stringify(node.style) : null,
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
                edge.style ? JSON.stringify(edge.style) : null,
              ]
            );
          }

          // Delete nodes and edges that are no longer in the state
          if (state.nodes.length > 0) {
            const nodeIds = state.nodes.map((n) => n.id);
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
            const edgeIds = state.edges.map((e) => e.id);
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
      canvasId,
    ]);

    const nodes: CanvasNode[] = nodeRows.map((row) => ({
      id: row.id,
      type: row.type as 'custom' | 'terminal' | 'agent',
      position: {
        x: row.position_x,
        y: row.position_y,
      },
      data: JSON.parse(row.data),
      style: row.style ? JSON.parse(row.style) : undefined,
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

    const edges: CanvasEdge[] = edgeRows.map((row) => ({
      id: row.id,
      source: row.source,
      target: row.target,
      type: row.type || undefined,
      data: row.data ? JSON.parse(row.data) : undefined,
      style: row.style ? JSON.parse(row.style) : undefined,
    }));

    return {
      id: canvas.id,
      name: canvas.name || undefined,
      nodes,
      edges,
      viewport: canvas.viewport ? JSON.parse(canvas.viewport) : undefined,
      createdAt: canvas.created_at,
      updatedAt: canvas.updated_at,
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

    return canvases.map((canvas) => ({
      id: canvas.id,
      name: canvas.name || undefined,
      nodeCount: canvas.node_count,
      edgeCount: canvas.edge_count,
      createdAt: canvas.created_at,
      updatedAt: canvas.updated_at,
    }));
  }

  async deleteCanvas(canvasId: string): Promise<void> {
    // Foreign key constraints will cascade delete nodes and edges
    await this.run('DELETE FROM canvases WHERE id = ?', [canvasId]);
  }

  async getCurrentCanvasId(): Promise<string | null> {
    const result = await this.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
      'current_canvas_id',
    ]);

    return result?.value || null;
  }

  async setCurrentCanvasId(canvasId: string): Promise<void> {
    await this.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
      'current_canvas_id',
      canvasId,
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
    }>(
      'SELECT agent_id, agent_type, status_info, title, summary, created_at, updated_at FROM agent_statuses'
    );

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

  // ===========================================================================
  // Recent Workspaces Methods
  // ===========================================================================

  async upsertRecentWorkspace(workspace: RecentWorkspace): Promise<void> {
    await this.run(
      `INSERT OR REPLACE INTO recent_workspaces (path, name, last_opened_at, created_at)
       VALUES (?, ?, ?, ?)`,
      [workspace.path, workspace.name, workspace.lastOpenedAt, workspace.createdAt]
    );
  }

  async getRecentWorkspaces(limit: number = 20): Promise<RecentWorkspace[]> {
    const rows = await this.all<{
      path: string;
      name: string;
      last_opened_at: number;
      created_at: number;
    }>(
      'SELECT path, name, last_opened_at, created_at FROM recent_workspaces ORDER BY last_opened_at DESC LIMIT ?',
      [limit]
    );

    return rows.map((row) => ({
      path: row.path,
      name: row.name,
      lastOpenedAt: row.last_opened_at,
      createdAt: row.created_at,
    }));
  }

  async removeRecentWorkspace(path: string): Promise<void> {
    await this.run('DELETE FROM recent_workspaces WHERE path = ?', [path]);
  }

  async clearAllRecentWorkspaces(): Promise<void> {
    await this.run('DELETE FROM recent_workspaces');
  }

  async getRecentWorkspaceByPath(path: string): Promise<RecentWorkspace | null> {
    const row = await this.get<{
      path: string;
      name: string;
      last_opened_at: number;
      created_at: number;
    }>('SELECT path, name, last_opened_at, created_at FROM recent_workspaces WHERE path = ?', [
      path,
    ]);

    if (!row) {
      return null;
    }

    return {
      path: row.path,
      name: row.name,
      lastOpenedAt: row.last_opened_at,
      createdAt: row.created_at,
    };
  }

  // ===========================================================================
  // Session Summary Cache Methods
  // ===========================================================================

  async getSessionSummary(
    sessionId: string,
    workspacePath: string
  ): Promise<{ summary: string; messageCount: number } | null> {
    const row = await this.get<{
      summary: string;
      message_count: number;
    }>(
      'SELECT summary, message_count FROM session_summaries WHERE session_id = ? AND workspace_path = ?',
      [sessionId, workspacePath]
    );

    if (!row) {
      return null;
    }

    return {
      summary: row.summary,
      messageCount: row.message_count,
    };
  }

  async saveSessionSummary(
    sessionId: string,
    workspacePath: string,
    summary: string,
    messageCount: number
  ): Promise<void> {
    const now = Date.now();
    const id = `${sessionId}-${workspacePath}`;

    await this.run(
      `INSERT OR REPLACE INTO session_summaries
        (id, session_id, workspace_path, summary, message_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, sessionId, workspacePath, summary, messageCount, now, now]
    );
  }

  async isSessionSummaryStale(
    sessionId: string,
    workspacePath: string,
    currentMessageCount: number
  ): Promise<boolean> {
    const cached = await this.getSessionSummary(sessionId, workspacePath);

    if (!cached) {
      return true; // No cache exists, needs generation
    }

    // Stale if message count has changed
    return cached.messageCount !== currentMessageCount;
  }

  async deleteSessionSummary(sessionId: string, workspacePath: string): Promise<void> {
    await this.run('DELETE FROM session_summaries WHERE session_id = ? AND workspace_path = ?', [
      sessionId,
      workspacePath,
    ]);
  }

  // ===========================================================================
  // Orchestrator Conversation Methods
  // ===========================================================================

  async createOrchestratorConversation(): Promise<OrchestratorConversation> {
    const id = randomUUID();
    const now = Date.now();

    await this.run(
      'INSERT INTO orchestrator_conversations (id, created_at, updated_at) VALUES (?, ?, ?)',
      [id, now, now]
    );

    return { id, createdAt: now, updatedAt: now };
  }

  async getOrchestratorConversation(id: string): Promise<OrchestratorConversation | null> {
    const row = await this.get<{
      id: string;
      created_at: number;
      updated_at: number;
    }>('SELECT id, created_at, updated_at FROM orchestrator_conversations WHERE id = ?', [id]);

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getMostRecentOrchestratorConversation(): Promise<OrchestratorConversation | null> {
    const row = await this.get<{
      id: string;
      created_at: number;
      updated_at: number;
    }>(
      'SELECT id, created_at, updated_at FROM orchestrator_conversations ORDER BY updated_at DESC LIMIT 1'
    );

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async deleteOrchestratorConversation(id: string): Promise<void> {
    // Foreign key constraint will cascade delete messages
    await this.run('DELETE FROM orchestrator_conversations WHERE id = ?', [id]);
  }

  async addOrchestratorMessage(input: AddOrchestratorMessageInput): Promise<OrchestratorMessage> {
    const id = randomUUID();
    const toolCallsJson = input.toolCalls ? JSON.stringify(input.toolCalls) : null;

    await this.run(
      `INSERT INTO orchestrator_messages (id, conversation_id, role, content, timestamp, tool_calls)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.conversationId, input.role, input.content, input.timestamp, toolCallsJson]
    );

    // Update conversation's updated_at timestamp
    await this.run('UPDATE orchestrator_conversations SET updated_at = ? WHERE id = ?', [
      Date.now(),
      input.conversationId,
    ]);

    return {
      id,
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      timestamp: input.timestamp,
      toolCalls: input.toolCalls,
    };
  }

  async getOrchestratorMessages(conversationId: string): Promise<OrchestratorMessage[]> {
    const rows = await this.all<{
      id: string;
      conversation_id: string;
      role: string;
      content: string;
      timestamp: number;
      tool_calls: string | null;
    }>(
      `SELECT id, conversation_id, role, content, timestamp, tool_calls
       FROM orchestrator_messages
       WHERE conversation_id = ?
       ORDER BY timestamp ASC`,
      [conversationId]
    );

    return rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role as 'user' | 'assistant',
      content: row.content,
      timestamp: row.timestamp,
      toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
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

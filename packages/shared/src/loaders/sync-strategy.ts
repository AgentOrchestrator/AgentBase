/**
 * Sync strategy interfaces for chat history synchronization
 *
 * Provides abstraction for different sync approaches:
 * - File-based: Read directly from source files (simple, always fresh)
 * - Database: Replicate to local database for fast queries
 * - Hybrid: Index in database + read-through cache (recommended)
 */

import type { AgentType, ChatHistory } from './types.js';

/**
 * Type of sync strategy
 */
export type SyncStrategyType = 'file' | 'database' | 'hybrid';

/**
 * Options for getting sessions to sync
 */
export interface SyncOptions {
  /** Only sync sessions modified after this timestamp (Unix ms) */
  sinceTimestamp?: number;
  /** Only sync specific agent types */
  agents?: AgentType[];
  /** Force full sync regardless of modification times */
  forceFullSync?: boolean;
}

/**
 * A session that needs to be synced
 */
export interface SyncCandidate {
  /** Session ID */
  sessionId: string;
  /** Agent type */
  agentType: AgentType;
  /** Path to the source file */
  sourcePath: string;
  /** Last modification time (Unix ms) */
  modifiedAt: number;
  /** Type of change detected */
  changeType: 'new' | 'updated';
}

/**
 * Interface for sync strategy implementations
 *
 * Sync strategies handle the detection and tracking of session changes
 * for efficient synchronization.
 */
export interface ISyncStrategy {
  /** The type of sync strategy */
  readonly type: SyncStrategyType;

  /**
   * Initialize the sync strategy (create tables, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Get sessions that need to be synced
   *
   * @param options - Sync options
   * @returns Array of sessions needing sync
   */
  getSessionsToSync(options?: SyncOptions): Promise<SyncCandidate[]>;

  /**
   * Mark sessions as successfully synced
   *
   * @param sessionIds - IDs of sessions that were synced
   */
  markSynced(sessionIds: string[]): Promise<void>;

  /**
   * Get a cached session (for database/hybrid strategies)
   *
   * @param sessionId - Session ID to retrieve
   * @returns Cached session or null if not cached
   */
  getCached?(sessionId: string): Promise<ChatHistory | null>;

  /**
   * Invalidate cache entries
   *
   * @param sessionIds - Session IDs to invalidate
   */
  invalidate?(sessionIds: string[]): Promise<void>;

  /**
   * Close/cleanup resources
   */
  close(): Promise<void>;
}

/**
 * Index entry for a session in the hybrid strategy
 */
export interface SessionIndexEntry {
  /** Session ID */
  id: string;
  /** Agent type */
  agentType: AgentType;
  /** Project path */
  projectPath: string | null;
  /** Project name */
  projectName: string | null;
  /** Source file path */
  sourcePath: string;
  /** Source file modification time (Unix ms) */
  sourceModifiedAt: number;
  /** Session timestamp (ISO) */
  sessionTimestamp: string | null;
  /** Number of messages */
  messageCount: number | null;
  /** Number of tool calls */
  toolCallCount: number;
  /** Whether session has thinking blocks */
  hasThinking: boolean;
  /** First user message preview */
  firstMessagePreview: string | null;
  /** Last sync timestamp (Unix ms) */
  lastSyncedAt: number | null;
  /** Whether session needs sync */
  needsSync: boolean;
  /** Created timestamp (Unix ms) */
  createdAt: number;
  /** Updated timestamp (Unix ms) */
  updatedAt: number;
}

/**
 * Factory for creating sync strategies
 */
export type SyncStrategyFactory = (dbPath?: string) => ISyncStrategy;

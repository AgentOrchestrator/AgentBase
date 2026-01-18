/**
 * Formal interfaces for chat history loaders
 * Implementations can be sync or async depending on their data source
 */

import type {
  AgentType,
  ChatHistory,
  ChatMessage,
  LoaderOptions,
  MessageFilterOptions,
  ProjectInfo,
  SessionChange,
  SessionContent,
  SessionFilterOptions,
  SessionSummary,
} from './types.js';

/**
 * Base interface for all chat history loaders
 *
 * Loaders read chat histories from various AI coding assistants
 * (Claude Code, Cursor, VSCode, CodeX, Factory, etc.) and convert
 * them to a standardized format.
 */
export interface IChatHistoryLoader {
  /** The agent type this loader handles */
  readonly agentType: AgentType;

  /** Human-readable name of the loader */
  readonly name: string;

  /**
   * Read chat histories from the source
   *
   * @param options - Options for filtering/limiting results
   * @returns Array of standardized chat histories
   */
  readHistories(options?: LoaderOptions): ChatHistory[] | Promise<ChatHistory[]>;

  /**
   * Extract project information from chat histories
   *
   * @param histories - Previously loaded chat histories
   * @returns Array of project info aggregated from histories
   */
  extractProjects(histories: ChatHistory[]): ProjectInfo[];

  /**
   * Check if this loader is available on the current system
   * (e.g., checks if the IDE's data directory exists)
   *
   * @returns true if the loader can read from this system
   */
  isAvailable(): boolean | Promise<boolean>;
}

/**
 * Extended interface for loaders that support incremental sync
 * Most file-based loaders support this via file modification time
 */
export interface IIncrementalLoader extends IChatHistoryLoader {
  /**
   * Get the timestamp of the most recent session
   * Useful for tracking sync progress
   */
  getLastSyncTimestamp(): number | Promise<number>;
}

/**
 * Extended interface for loaders that need database access
 * Cursor and VSCode loaders fall into this category
 */
export interface IDatabaseLoader extends IChatHistoryLoader {
  /**
   * Path to the database file
   */
  readonly databasePath: string;

  /**
   * Check if the database is accessible and valid
   */
  isDatabaseAccessible(): boolean | Promise<boolean>;
}

/**
 * Factory function type for creating loaders
 * Useful for dependency injection and testing
 */
export type LoaderFactory<T extends IChatHistoryLoader = IChatHistoryLoader> = () => T;

/**
 * Registry of all available loaders
 */
export interface ILoaderRegistry {
  /**
   * Register a loader
   */
  register(loader: IChatHistoryLoader): void;

  /**
   * Get all registered loaders
   */
  getAll(): IChatHistoryLoader[];

  /**
   * Get loaders that are available on this system
   */
  getAvailable(): Promise<IChatHistoryLoader[]>;

  /**
   * Get a specific loader by agent type
   */
  getByType(agentType: AgentType): IChatHistoryLoader | undefined;
}

// =============================================================================
// Chat History Provider (Extended interface with sync capabilities)
// =============================================================================

/**
 * Extended interface for chat history providers with sync, filtering, and streaming
 *
 * This interface extends IChatHistoryLoader with:
 * - Efficient listing without loading all messages
 * - Change detection for incremental sync
 * - Watch capabilities for real-time updates
 * - Streaming for large sessions
 * - Filtering by message type
 */
export interface IChatHistoryProvider extends IChatHistoryLoader {
  /**
   * Get modification times for incremental sync detection
   *
   * @param filter - Optional filter options
   * @returns Map of session ID to last modification timestamp (Unix ms)
   */
  getSessionModificationTimes(filter?: SessionFilterOptions): Promise<Map<string, number>>;

  /**
   * List sessions with summaries (without full messages)
   * More efficient than readHistories() for listing views
   *
   * @param filter - Optional filter options
   * @returns Array of session summaries
   */
  listSessionSummaries(filter?: SessionFilterOptions): Promise<SessionSummary[]>;

  /**
   * Get full session content with optional message filtering
   *
   * @param sessionId - Session ID to retrieve
   * @param filter - Optional message filter options
   * @returns Session content or null if not found
   */
  getFilteredSession(
    sessionId: string,
    filter?: MessageFilterOptions
  ): Promise<SessionContent | null>;

  /**
   * Stream messages one at a time (memory efficient for large sessions)
   *
   * @param sessionId - Session ID to stream
   * @param filter - Optional message filter options
   * @yields ChatMessage objects one at a time
   */
  streamSessionMessages?(
    sessionId: string,
    filter?: MessageFilterOptions
  ): AsyncGenerator<ChatMessage, void, unknown>;

  /**
   * Watch for session changes (file modifications, new sessions, deletions)
   *
   * @param callback - Function called when a session changes
   * @returns Unsubscribe function to stop watching
   */
  watchSessions?(callback: (change: SessionChange) => void): () => void;

  /**
   * Get data source paths for this provider
   * Used for file watching and debugging
   *
   * @returns Array of paths where this provider reads data from
   */
  getDataPaths(): string[];
}

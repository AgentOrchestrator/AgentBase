/**
 * Shared loaders module
 *
 * Provides types, interfaces, and utilities for chat history loaders.
 * Actual loader implementations live in daemon/desktop apps and implement
 * the IChatHistoryLoader interface.
 */

// =============================================================================
// Types
// =============================================================================

export type {
  // Core types
  AgentType,
  SessionSource,
  ChatMessage,
  SessionMetadata,
  ChatHistory,
  ProjectInfo,
  LoaderOptions,
  // Rich message types (NEW)
  MessageType,
  ToolCategory,
  ToolInfo,
  ThinkingInfo,
  McpInfo,
  ErrorInfo,
  // Filter types (NEW)
  MessageFilterOptions,
  SessionFilterOptions,
  // Session types (NEW)
  SessionSummary,
  SessionContent,
  SessionChange,
} from './types.js';

// =============================================================================
// Interfaces
// =============================================================================

export type {
  IChatHistoryLoader,
  IIncrementalLoader,
  IDatabaseLoader,
  LoaderFactory,
  ILoaderRegistry,
  // Chat history provider (NEW)
  IChatHistoryProvider,
} from './interfaces.js';

// =============================================================================
// Sync Strategy (NEW)
// =============================================================================

export type {
  SyncStrategyType,
  SyncOptions,
  SyncCandidate,
  ISyncStrategy,
  SessionIndexEntry,
  SyncStrategyFactory,
} from './sync-strategy.js';

// =============================================================================
// Utilities
// =============================================================================

export {
  normalizeTimestamp,
  extractProjectNameFromPath,
  generateDeterministicUUID,
  getHomeDir,
  fileExists,
  IDE_DATA_PATHS,
} from './utilities.js';

// =============================================================================
// Registry
// =============================================================================

export { LoaderRegistry, createLoaderRegistry } from './registry.js';

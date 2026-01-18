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
  ChatHistory,
  ChatMessage,
  ErrorInfo,
  LoaderOptions,
  McpInfo,
  // Filter types (NEW)
  MessageFilterOptions,
  // Rich message types (NEW)
  MessageType,
  ProjectInfo,
  SessionChange,
  SessionContent,
  SessionFilterOptions,
  SessionMetadata,
  SessionSource,
  // Session types (NEW)
  SessionSummary,
  ThinkingInfo,
  ToolCategory,
  ToolInfo,
} from './types.js';

// =============================================================================
// Interfaces
// =============================================================================

export type {
  IChatHistoryLoader,
  // Chat history provider (NEW)
  IChatHistoryProvider,
  IDatabaseLoader,
  IIncrementalLoader,
  ILoaderRegistry,
  LoaderFactory,
} from './interfaces.js';

// =============================================================================
// Sync Strategy (NEW)
// =============================================================================

export type {
  ISyncStrategy,
  SessionIndexEntry,
  SyncCandidate,
  SyncOptions,
  SyncStrategyFactory,
  SyncStrategyType,
} from './sync-strategy.js';

// =============================================================================
// Utilities
// =============================================================================

export {
  extractProjectNameFromPath,
  fileExists,
  generateDeterministicUUID,
  getHomeDir,
  IDE_DATA_PATHS,
  normalizeTimestamp,
} from './utilities.js';

// =============================================================================
// Registry
// =============================================================================

export { createLoaderRegistry, LoaderRegistry } from './registry.js';

/**
 * Shared loaders module
 *
 * Provides types, interfaces, and utilities for chat history loaders.
 * Actual loader implementations live in daemon/desktop apps and implement
 * the IChatHistoryLoader interface.
 */

// Types
export type {
  AgentType,
  SessionSource,
  ChatMessage,
  SessionMetadata,
  ChatHistory,
  ProjectInfo,
  LoaderOptions,
} from './types.js';

// Interfaces
export type {
  IChatHistoryLoader,
  IIncrementalLoader,
  IDatabaseLoader,
  LoaderFactory,
  ILoaderRegistry,
} from './interfaces.js';

// Utilities
export {
  normalizeTimestamp,
  extractProjectNameFromPath,
  generateDeterministicUUID,
  getHomeDir,
  fileExists,
  IDE_DATA_PATHS,
} from './utilities.js';

// Registry
export { LoaderRegistry, createLoaderRegistry } from './registry.js';

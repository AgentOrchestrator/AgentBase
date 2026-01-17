/**
 * Re-export shared types for backward compatibility
 * All types are now defined in @agent-orchestrator/shared
 */
export type {
  AgentType,
  ChatHistory,
  ChatMessage,
  IChatHistoryLoader,
  IDatabaseLoader,
  IIncrementalLoader,
  ILoaderRegistry,
  LoaderOptions,
  ProjectInfo,
  SessionMetadata,
} from '@agent-orchestrator/shared';

export {
  createLoaderRegistry,
  extractProjectNameFromPath,
  fileExists,
  generateDeterministicUUID,
  getHomeDir,
  IDE_DATA_PATHS,
  LoaderRegistry,
  normalizeTimestamp,
} from '@agent-orchestrator/shared';

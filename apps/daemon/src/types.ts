/**
 * Re-export shared types for backward compatibility
 * All types are now defined in @agent-orchestrator/shared
 */
export type {
  AgentType,
  ChatMessage,
  ChatHistory,
  SessionMetadata,
  ProjectInfo,
  LoaderOptions,
  IChatHistoryLoader,
  IIncrementalLoader,
  IDatabaseLoader,
  ILoaderRegistry,
} from '@agent-orchestrator/shared';

export {
  normalizeTimestamp,
  extractProjectNameFromPath,
  generateDeterministicUUID,
  getHomeDir,
  fileExists,
  IDE_DATA_PATHS,
} from '@agent-orchestrator/shared';

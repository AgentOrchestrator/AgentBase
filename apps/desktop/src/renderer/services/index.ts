/**
 * Services for the desktop app renderer process.
 */

export type {
  CreateAgentOptions,
  CreateNodeOptions,
} from './CanvasNodeService';
// Canvas node service
export { CanvasNodeService, canvasNodeService } from './CanvasNodeService';
export { CodingAgentStatusManager } from './CodingAgentStatusManager';
export * from './defaults';
export type {
  ForkError,
  ForkErrorType,
  ForkRequest,
  ForkResult,
  IForkService,
} from './ForkService';
// Fork service
export { ForkService, forkService } from './ForkService';
// Service factories
export * from './factories';
// Service implementations
export * from './impl';
export type {
  CreateTicketResponse,
  FetchIssuesResponse,
  FetchProjectsResponse,
  ILinearService,
  LinearTeam,
  LinearViewer,
} from './LinearService';
// Linear service (GraphQL API calls)
export { linearService } from './LinearService';
export type { ISessionProvider, SessionInfo, SessionStartCallback } from './SessionProvider';
// Session provider (abstraction for hooks system integration)
export { FileBasedSessionProvider, sessionProvider } from './SessionProvider';

// Shared event dispatcher (single IPC listener for agent events)
export { sharedEventDispatcher } from './SharedEventDispatcher';

// Worktree service (git worktree operations)
export type { IWorktreeService, WorktreeResult } from './WorktreeService';
export { WorktreeService, worktreeService } from './WorktreeService';

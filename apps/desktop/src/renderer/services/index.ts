/**
 * Services for the desktop app renderer process.
 */

export { CodingAgentStatusManager } from './CodingAgentStatusManager';
export * from './defaults';

// Service implementations
export * from './impl';

// Service factories
export * from './factories';

// Fork service
export { ForkService, forkService } from './ForkService';
export type { IForkService, ForkRequest, ForkResult, ForkError, ForkErrorType } from './ForkService';

// Session provider (abstraction for hooks system integration)
export { FileBasedSessionProvider, sessionProvider } from './SessionProvider';
export type { ISessionProvider, SessionInfo, SessionStartCallback } from './SessionProvider';

// Canvas node service
export { CanvasNodeService, canvasNodeService } from './CanvasNodeService';
export type {
  CreateNodeOptions,
  CreateAgentOptions,
} from './CanvasNodeService';

// Linear service (GraphQL API calls)
export { linearService } from './LinearService';
export type {
  ILinearService,
  FetchProjectsResponse,
  FetchIssuesResponse,
  CreateTicketResponse,
  LinearTeam,
  LinearViewer,
} from './LinearService';

// Shared event dispatcher (single IPC listener for agent events)
export { sharedEventDispatcher } from './SharedEventDispatcher';

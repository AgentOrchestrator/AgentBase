/**
 * Services for the desktop app renderer process.
 */

// Audio services
export * from './audio';

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
// Notification sound service
export type { INotificationSoundService } from './NotificationSoundService';
export { NotificationSoundService } from './NotificationSoundService';
export type { ISessionProvider, SessionInfo, SessionStartCallback } from './SessionProvider';
// Session provider (abstraction for hooks system integration)
export { FileBasedSessionProvider, sessionProvider } from './SessionProvider';
// Shared event dispatcher (single IPC listener for agent events)
export { sharedEventDispatcher } from './SharedEventDispatcher';

// Notification sound service singleton
import { agentActionStore } from '../stores';
import { HtmlAudioPlayer } from './audio';
import { NotificationSoundService } from './NotificationSoundService';

export const notificationSoundService = new NotificationSoundService(
  new HtmlAudioPlayer(),
  agentActionStore
);

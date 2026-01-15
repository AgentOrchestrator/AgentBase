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

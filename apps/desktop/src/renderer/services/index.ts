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

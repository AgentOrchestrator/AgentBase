/**
 * Services for the desktop app renderer process.
 */

export { CodingAgentStatusManager } from './CodingAgentStatusManager';
export * from './defaults';
export { WorktreeService, worktreeService } from './WorktreeService';
export type { IWorktreeService, WorktreeResult } from './WorktreeService';
export { ForkService, forkService } from './ForkService';
export type { IForkService, ForkRequest, ForkResult, ForkError, ForkErrorType } from './ForkService';

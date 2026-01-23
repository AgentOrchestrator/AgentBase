/**
 * Types for the Agent Lifecycle Notification Server
 *
 * This module handles lifecycle events from terminal-based agents
 * (e.g., Claude Code CLI) via HTTP sideband communication.
 */

/**
 * Lifecycle event types that can be received from terminal agents
 */
export type LifecycleEventType = 'Start' | 'Stop' | 'PermissionRequest';

/**
 * Validated lifecycle event ready for processing
 */
export interface LifecycleEvent {
  type: LifecycleEventType;
  terminalId: string;
  workspacePath: string;
  gitBranch: string;
  sessionId: string;
  agentId: string;
  timestamp: string;
}

/**
 * Raw request data from the HTTP hook endpoint
 * All fields are optional since we need to validate them
 */
export interface RawHookRequest {
  terminalId?: string;
  workspacePath?: string;
  gitBranch?: string;
  sessionId?: string;
  agentId?: string;
  eventType?: string;
}

/**
 * Result of validating a raw hook request
 */
export type ValidationResult =
  | { valid: true; event: LifecycleEvent }
  | { valid: false; reason: string; missingFields: string[] };

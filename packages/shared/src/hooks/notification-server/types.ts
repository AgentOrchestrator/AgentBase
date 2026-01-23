/**
 * Types for the Agent Lifecycle Notification Server
 *
 * This module handles lifecycle events from terminal-based agents
 * (e.g., Claude Code CLI) via HTTP sideband communication.
 */

/**
 * Lifecycle event types that can be received from terminal agents
 */
export type LifecycleEventType = 'Start' | 'Stop' | 'PermissionRequest' | 'PreToolUse';

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
  /** Tool name for PreToolUse events */
  toolName?: string;
  /** Tool input for PreToolUse events (can be complex object) */
  toolInput?: unknown;
  /** Tool use ID from Claude */
  toolUseId?: string;
}

/**
 * Raw request data from the HTTP hook endpoint
 * All fields are optional since we need to validate them
 * Supports both camelCase (our fields) and snake_case (Claude's fields)
 */
export interface RawHookRequest {
  // Our terminal context fields
  terminalId?: string;
  workspacePath?: string;
  gitBranch?: string;
  agentId?: string;
  eventType?: string;

  // Session ID - supports both formats
  sessionId?: string;
  session_id?: string;

  // Claude's hook data (snake_case)
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_use_id?: string;
  cwd?: string;
  prompt?: string;
  transcript_path?: string;

  // Legacy camelCase versions
  toolName?: string;
  toolInput?: unknown;
  toolUseId?: string;
}

/**
 * Result of validating a raw hook request
 */
export type ValidationResult =
  | { valid: true; event: LifecycleEvent }
  | { valid: false; reason: string; missingFields: string[] };

/**
 * Validation functions for Agent Lifecycle Notification Server
 *
 * Pure, testable functions for validating HTTP hook requests.
 */

import type {
  LifecycleEvent,
  LifecycleEventType,
  RawHookRequest,
  ValidationResult,
} from './types.js';

/**
 * Required fields that must be present in every hook request
 * Note: sessionId can come as session_id from Claude, checked separately
 */
export const REQUIRED_FIELDS = ['terminalId', 'agentId', 'eventType'] as const;

/**
 * Map raw event type string to normalized LifecycleEventType
 *
 * Claude Code hooks map to lifecycle events:
 * - UserPromptSubmit → Start (agent started processing)
 * - Stop/SessionEnd → Stop (agent finished)
 * - PreToolUse → PreToolUse (tool about to be used, filtered for AskUserQuestion)
 * - PermissionRequest → PermissionRequest (actual permission prompt)
 */
export function mapEventType(raw: string | undefined): LifecycleEventType | null {
  if (!raw) return null;

  switch (raw) {
    case 'UserPromptSubmit':
      return 'Start';
    case 'Stop':
    case 'SessionEnd':
      return 'Stop';
    case 'PreToolUse':
      return 'PreToolUse';
    case 'PermissionRequest':
      return 'PermissionRequest';
    default:
      return null;
  }
}

/**
 * Validate a raw hook request and return a validated LifecycleEvent or error
 *
 * @param raw - The raw request data from HTTP endpoint
 * @returns ValidationResult indicating success with event or failure with reasons
 */
export function validateHookRequest(raw: RawHookRequest): ValidationResult {
  const missingFields: string[] = [];

  // Check all required fields
  for (const field of REQUIRED_FIELDS) {
    if (!raw[field as keyof RawHookRequest]) {
      missingFields.push(field);
    }
  }

  // Check for sessionId (can be either sessionId or session_id)
  if (!raw.sessionId && !raw.session_id) {
    missingFields.push('sessionId (or session_id)');
  }

  // Check for workspacePath (can be workspacePath or cwd)
  if (!raw.workspacePath && !raw.cwd) {
    missingFields.push('workspacePath (or cwd)');
  }

  // Check for gitBranch
  if (!raw.gitBranch) {
    missingFields.push('gitBranch');
  }

  if (missingFields.length > 0) {
    return {
      valid: false,
      reason: `Missing required fields: ${missingFields.join(', ')}`,
      missingFields,
    };
  }

  // Validate eventType
  const eventType = mapEventType(raw.eventType);
  if (!eventType) {
    return {
      valid: false,
      reason: `Invalid eventType: ${raw.eventType}`,
      missingFields: [],
    };
  }

  // All validations passed - construct the event
  // Support both snake_case (from Claude) and camelCase field names
  const event: LifecycleEvent = {
    type: eventType,
    terminalId: raw.terminalId!,
    workspacePath: raw.workspacePath || raw.cwd || '',
    gitBranch: raw.gitBranch!,
    sessionId: raw.sessionId || raw.session_id || '',
    agentId: raw.agentId!,
    timestamp: new Date().toISOString(),
    // Pass through tool info for PreToolUse events (prefer snake_case from Claude)
    toolName: raw.tool_name || raw.toolName,
    toolInput: raw.tool_input || raw.toolInput,
    toolUseId: raw.tool_use_id || raw.toolUseId,
  };

  return { valid: true, event };
}

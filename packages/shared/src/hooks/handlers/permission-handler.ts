/**
 * Permission Handler - Auto-approve/deny logic for permission requests
 *
 * Evaluates permission requests against a policy and returns decisions.
 * Supports callbacks for 'ask' decisions to prompt the user.
 */

import type { PermissionPolicy } from '../policy.js';
import {
  DANGEROUS_COMMAND_PATTERNS,
  evaluatePermission,
  SAFE_COMMAND_PATTERNS,
} from '../policy.js';
import type { AgentEvent, EventHandler, EventResult, PermissionPayload } from '../types.js';

// =============================================================================
// HANDLER OPTIONS
// =============================================================================

/**
 * Options for creating a permission handler
 */
export interface PermissionHandlerOptions {
  /** Permission policy to evaluate against */
  policy: PermissionPolicy;

  /**
   * Callback for 'ask' decisions
   * Return true to allow, false to deny
   */
  onAsk?: (payload: PermissionPayload) => Promise<boolean>;

  /**
   * Callback called for all decisions (for logging/analytics)
   */
  onDecision?: (
    payload: PermissionPayload,
    decision: 'allow' | 'deny' | 'ask',
    decidedBy: 'policy' | 'user' | 'default'
  ) => void;

  /**
   * Timeout for onAsk callback in milliseconds
   * If exceeded, the default action is used
   * Default: 30000 (30 seconds)
   */
  askTimeout?: number;

  /**
   * Action to take when ask times out
   * Default: 'deny'
   */
  timeoutAction?: 'allow' | 'deny';
}

// =============================================================================
// PERMISSION HANDLER
// =============================================================================

/**
 * Create a permission handler that evaluates requests against a policy
 *
 * @example
 * const handler = createPermissionHandler({
 *   policy: PERMISSION_PRESETS.development,
 *   onAsk: async (payload) => {
 *     // Show dialog to user
 *     return await showPermissionDialog(payload);
 *   },
 * });
 *
 * registry.onPermissionRequest(handler);
 */
export function createPermissionHandler(
  options: PermissionHandlerOptions
): EventHandler<PermissionPayload> {
  const { policy, onAsk, onDecision, askTimeout = 30000, timeoutAction = 'deny' } = options;

  return async (event: AgentEvent<PermissionPayload>): Promise<EventResult> => {
    const payload = event.payload;

    // Evaluate the permission request against the policy
    const decision = evaluatePermission(policy, payload);

    // Handle auto-decisions
    if (decision === 'allow') {
      onDecision?.(payload, 'allow', 'policy');
      return {
        action: 'allow',
        message: `Auto-approved by policy: ${policy.name ?? 'unnamed'}`,
      };
    }

    if (decision === 'deny') {
      onDecision?.(payload, 'deny', 'policy');
      return {
        action: 'deny',
        message: `Auto-denied by policy: ${policy.name ?? 'unnamed'}`,
      };
    }

    // Handle 'ask' decision
    if (!onAsk) {
      // No callback provided, use default action
      onDecision?.(payload, decision, 'default');
      return {
        action: 'ask',
        message: 'User confirmation required (no callback provided)',
      };
    }

    // Call the ask callback with timeout
    try {
      const userDecision = await Promise.race([
        onAsk(payload),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), askTimeout)
        ),
      ]);

      const finalAction = userDecision ? 'allow' : 'deny';
      onDecision?.(payload, finalAction, 'user');
      return {
        action: finalAction,
        message: `User ${finalAction === 'allow' ? 'approved' : 'denied'} the request`,
      };
    } catch (error) {
      // Timeout or error
      onDecision?.(payload, timeoutAction, 'default');
      return {
        action: timeoutAction,
        message:
          error instanceof Error && error.message === 'Timeout'
            ? `Ask timed out after ${askTimeout}ms, defaulting to ${timeoutAction}`
            : `Error during ask: ${error}`,
      };
    }
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a command is in the safe commands list
 */
export function isSafeCommand(command: string): boolean {
  return SAFE_COMMAND_PATTERNS.some((pattern) => pattern.test(command));
}

/**
 * Check if a command is in the dangerous commands list
 */
export function isDangerousCommand(command: string): boolean {
  return DANGEROUS_COMMAND_PATTERNS.some((pattern) => pattern.test(command));
}

/**
 * Get a human-readable description of why a command is considered safe/dangerous
 */
export function getCommandRiskAssessment(command: string): {
  risk: 'safe' | 'dangerous' | 'unknown';
  reason: string;
} {
  if (isDangerousCommand(command)) {
    // Try to identify the specific danger
    if (/rm\s+.*-rf/.test(command)) {
      return { risk: 'dangerous', reason: 'Recursive delete operation' };
    }
    if (/sudo/.test(command)) {
      return { risk: 'dangerous', reason: 'Elevated permissions required' };
    }
    if (/curl.*\|\s*bash/.test(command) || /wget.*\|\s*bash/.test(command)) {
      return { risk: 'dangerous', reason: 'Remote code execution' };
    }
    if (/git\s+push.*--force/.test(command)) {
      return { risk: 'dangerous', reason: 'Force push may overwrite history' };
    }
    if (/git\s+reset\s+--hard/.test(command)) {
      return { risk: 'dangerous', reason: 'Hard reset discards changes' };
    }
    return { risk: 'dangerous', reason: 'Potentially destructive operation' };
  }

  if (isSafeCommand(command)) {
    // Try to identify the specific safety
    if (/^git\s+(status|diff|log|show|branch)/.test(command)) {
      return { risk: 'safe', reason: 'Read-only git operation' };
    }
    if (/^(ls|cat|head|tail|wc|grep|find)/.test(command)) {
      return { risk: 'safe', reason: 'Read-only file operation' };
    }
    if (/^(pwd|whoami|date|echo|which|type)/.test(command)) {
      return { risk: 'safe', reason: 'Information query' };
    }
    return { risk: 'safe', reason: 'Generally safe operation' };
  }

  return { risk: 'unknown', reason: 'No matching safety pattern' };
}

// =============================================================================
// CONVENIENCE HANDLERS
// =============================================================================

/**
 * Create a handler that always allows (for testing)
 */
export function createAlwaysAllowHandler(): EventHandler<PermissionPayload> {
  return async () => ({
    action: 'allow',
    message: 'Auto-approved (always allow handler)',
  });
}

/**
 * Create a handler that always denies (for testing)
 */
export function createAlwaysDenyHandler(): EventHandler<PermissionPayload> {
  return async () => ({
    action: 'deny',
    message: 'Auto-denied (always deny handler)',
  });
}

/**
 * Create a handler that always asks (delegates all decisions)
 */
export function createAlwaysAskHandler(): EventHandler<PermissionPayload> {
  return async () => ({
    action: 'ask',
    message: 'User confirmation required',
  });
}

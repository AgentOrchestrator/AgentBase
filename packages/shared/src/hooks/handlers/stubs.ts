/**
 * Stub Handlers - No-op handlers for all event types
 *
 * Useful for:
 * - Testing and development
 * - Logging all events
 * - Providing default behavior
 */

import type { EventRegistry } from '../registry.js';
import type { AgentEventType, EventHandler, EventResult, UnsubscribeFn } from '../types.js';

// =============================================================================
// ALL EVENT TYPES
// =============================================================================

/**
 * All possible vendor-agnostic event types
 */
export const ALL_EVENT_TYPES: AgentEventType[] = [
  // Session lifecycle
  'session:start',
  'session:end',
  'session:pause',
  'session:resume',

  // User input
  'user_input:complete',

  // Agent output
  'agent_output:delta',
  'agent_output:complete',

  // Tool execution
  'tool:begin',
  'tool:output',
  'tool:complete',
  'tool:error',

  // Permission
  'permission:request',
  'permission:approve',
  'permission:deny',

  // Delegation
  'delegation:start',
  'delegation:end',

  // Context
  'context:compact',

  // System
  'system:info',
  'system:warning',
  'system:error',
];

// =============================================================================
// STUB HANDLER FACTORY
// =============================================================================

/**
 * Options for creating stub handlers
 */
export interface StubHandlerOptions {
  /** Whether to log events to console */
  log?: boolean;

  /** Log prefix */
  logPrefix?: string;

  /** Custom result to return */
  result?: EventResult;
}

/**
 * Create a stub handler for a specific event type
 */
export function createStubHandler(
  eventType: AgentEventType,
  options: StubHandlerOptions = {}
): EventHandler {
  const { log = true, logPrefix = '[AgentHook]', result } = options;

  return async (event) => {
    if (log) {
      console.log(`${logPrefix} ${eventType}`, {
        id: event.id,
        agent: event.agent,
        sessionId: event.sessionId,
        payload: event.payload,
      });
    }

    return result ?? { action: 'continue' };
  };
}

// =============================================================================
// PRE-BUILT STUB HANDLERS
// =============================================================================

/**
 * Pre-built stub handlers for all event types (with logging)
 */
export const stubHandlers: Record<AgentEventType, EventHandler> = {
  // Session lifecycle
  'session:start': createStubHandler('session:start'),
  'session:end': createStubHandler('session:end'),
  'session:pause': createStubHandler('session:pause'),
  'session:resume': createStubHandler('session:resume'),

  // User input
  'user_input:complete': createStubHandler('user_input:complete'),

  // Agent output
  'agent_output:delta': createStubHandler('agent_output:delta', { log: false }), // Too noisy
  'agent_output:complete': createStubHandler('agent_output:complete'),

  // Tool execution
  'tool:begin': createStubHandler('tool:begin'),
  'tool:output': createStubHandler('tool:output', { log: false }), // Too noisy
  'tool:complete': createStubHandler('tool:complete'),
  'tool:error': createStubHandler('tool:error'),

  // Permission
  'permission:request': createStubHandler('permission:request'),
  'permission:approve': createStubHandler('permission:approve'),
  'permission:deny': createStubHandler('permission:deny'),

  // Delegation
  'delegation:start': createStubHandler('delegation:start'),
  'delegation:end': createStubHandler('delegation:end'),

  // Context
  'context:compact': createStubHandler('context:compact'),

  // System
  'system:info': createStubHandler('system:info'),
  'system:warning': createStubHandler('system:warning'),
  'system:error': createStubHandler('system:error'),
} as Record<AgentEventType, EventHandler>;

/**
 * Silent stub handlers (no logging)
 */
export const silentStubHandlers: Record<AgentEventType, EventHandler> = Object.fromEntries(
  ALL_EVENT_TYPES.map((type) => [type, createStubHandler(type, { log: false })])
) as Record<AgentEventType, EventHandler>;

// =============================================================================
// REGISTRATION HELPERS
// =============================================================================

/**
 * Register all stub handlers with a registry
 *
 * @param registry - The event registry to register with
 * @param options - Options for the stub handlers
 * @returns Unsubscribe function to remove all handlers
 */
export function registerAllStubs(
  registry: EventRegistry,
  options: StubHandlerOptions = {}
): UnsubscribeFn {
  const unsubscribers: UnsubscribeFn[] = [];

  for (const eventType of ALL_EVENT_TYPES) {
    const handler = createStubHandler(eventType, options);
    const unsubscribe = registry.on(eventType, handler);
    unsubscribers.push(unsubscribe);
  }

  return () => {
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
  };
}

/**
 * Create a logging handler that logs all events without modifying behavior
 */
export function createLoggingHandler(
  logFn: (message: string, data: unknown) => void = console.log
): EventHandler {
  return async (event) => {
    logFn(`[${event.type}] ${event.agent}`, {
      id: event.id,
      sessionId: event.sessionId,
      workspacePath: event.workspacePath,
      payload: event.payload,
    });
    return { action: 'continue' };
  };
}

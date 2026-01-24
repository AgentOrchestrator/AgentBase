/**
 * EventRegistry - Central hub for agent event handling
 *
 * Provides a pub/sub mechanism for agent events with support for:
 * - Specific event type subscriptions (e.g., 'permission:request')
 * - Category-level subscriptions (e.g., all 'permission' events)
 * - Global subscriptions (all events)
 */

// Use globalThis.crypto for cross-platform UUID generation (Node.js 19+ and browsers)
const randomUUID = (): string => globalThis.crypto.randomUUID();

import type {
  AgentEvent,
  AgentEventCategory,
  AgentEventType,
  AgentOutputPayload,
  EventHandler,
  EventResult,
  PermissionPayload,
  SessionPayload,
  ToolPayload,
  UnsubscribeFn,
} from './types.js';

/**
 * Extract category from event type (e.g., 'permission:request' → 'permission')
 */
function getCategory(eventType: AgentEventType): AgentEventCategory {
  return eventType.split(':')[0] as AgentEventCategory;
}

/**
 * EventRegistry manages event subscriptions and dispatching
 */
export class EventRegistry {
  /** Handlers registered for specific event types */
  private handlers = new Map<AgentEventType, Set<EventHandler>>();

  /** Handlers registered for entire categories */
  private categoryHandlers = new Map<AgentEventCategory, Set<EventHandler>>();

  /** Handlers registered for all events */
  private globalHandlers = new Set<EventHandler>();

  /**
   * Register a handler for a specific event type
   *
   * @example
   * registry.on('permission:request', async (event) => {
   *   console.log('Permission requested:', event.payload);
   *   return { action: 'continue' };
   * });
   */
  on<T = unknown>(eventType: AgentEventType, handler: EventHandler<T>): UnsubscribeFn {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)?.add(handler as EventHandler);

    return () => {
      this.handlers.get(eventType)?.delete(handler as EventHandler);
    };
  }

  /**
   * Register a handler for an entire event category
   *
   * @example
   * // Catch all permission events: request, approve, deny
   * registry.onCategory('permission', (event) => {
   *   console.log('Permission event:', event.type, event.payload);
   *   return { action: 'continue' };
   * });
   */
  onCategory<T = unknown>(category: AgentEventCategory, handler: EventHandler<T>): UnsubscribeFn {
    if (!this.categoryHandlers.has(category)) {
      this.categoryHandlers.set(category, new Set());
    }
    this.categoryHandlers.get(category)?.add(handler as EventHandler);

    return () => {
      this.categoryHandlers.get(category)?.delete(handler as EventHandler);
    };
  }

  /**
   * Register a handler for all events (useful for logging/debugging)
   *
   * @example
   * registry.onAll((event) => {
   *   console.log(`[${event.type}]`, event.payload);
   *   return { action: 'continue' };
   * });
   */
  onAll(handler: EventHandler): UnsubscribeFn {
    this.globalHandlers.add(handler);
    return () => {
      this.globalHandlers.delete(handler);
    };
  }

  /**
   * Emit an event to all registered handlers
   *
   * Handlers are called in order:
   * 1. Global handlers (onAll)
   * 2. Category handlers (onCategory)
   * 3. Specific type handlers (on)
   *
   * @returns Array of results from all handlers
   */
  async emit<T = unknown>(event: AgentEvent<T>): Promise<EventResult[]> {
    const results: EventResult[] = [];
    const category = getCategory(event.type);

    // Call global handlers
    for (const handler of this.globalHandlers) {
      try {
        const result = await handler(event);
        results.push(result);
      } catch (error) {
        console.error(`[EventRegistry] Global handler error:`, error);
        results.push({
          action: 'continue',
          message: `Handler error: ${error}`,
        });
      }
    }

    // Call category handlers
    const categorySet = this.categoryHandlers.get(category);
    if (categorySet) {
      for (const handler of categorySet) {
        try {
          const result = await handler(event);
          results.push(result);
        } catch (error) {
          console.error(`[EventRegistry] Category handler error for ${category}:`, error);
          results.push({
            action: 'continue',
            message: `Handler error: ${error}`,
          });
        }
      }
    }

    // Call specific type handlers
    const typeSet = this.handlers.get(event.type);
    if (typeSet) {
      for (const handler of typeSet) {
        try {
          const result = await handler(event);
          results.push(result);
        } catch (error) {
          console.error(`[EventRegistry] Handler error for ${event.type}:`, error);
          results.push({
            action: 'continue',
            message: `Handler error: ${error}`,
          });
        }
      }
    }

    return results;
  }

  // ===========================================================================
  // Convenience methods for common event types
  // ===========================================================================

  /**
   * Register handler for permission:request events
   */
  onPermissionRequest(handler: EventHandler<PermissionPayload>): UnsubscribeFn {
    return this.on('permission:request', handler);
  }

  /**
   * Register handler for tool:begin events
   */
  onToolBegin(handler: EventHandler<ToolPayload>): UnsubscribeFn {
    return this.on('tool:begin', handler);
  }

  /**
   * Register handler for tool:complete events
   */
  onToolComplete(handler: EventHandler<ToolPayload>): UnsubscribeFn {
    return this.on('tool:complete', handler);
  }

  /**
   * Register handler for session:start events
   */
  onSessionStart(handler: EventHandler<SessionPayload>): UnsubscribeFn {
    return this.on('session:start', handler);
  }

  /**
   * Register handler for session:end events
   */
  onSessionEnd(handler: EventHandler<SessionPayload>): UnsubscribeFn {
    return this.on('session:end', handler);
  }

  /**
   * Register handler for agent_output events (all actions: delta, complete)
   */
  onAgentOutput(handler: EventHandler<AgentOutputPayload>): UnsubscribeFn {
    return this.onCategory('agent_output', handler);
  }

  /**
   * Clear all registered handlers
   */
  clear(): void {
    this.handlers.clear();
    this.categoryHandlers.clear();
    this.globalHandlers.clear();
  }

  /**
   * Get handler counts for debugging
   */
  getStats(): {
    typeHandlers: number;
    categoryHandlers: number;
    globalHandlers: number;
  } {
    let typeHandlers = 0;
    for (const set of this.handlers.values()) {
      typeHandlers += set.size;
    }

    let categoryHandlers = 0;
    for (const set of this.categoryHandlers.values()) {
      categoryHandlers += set.size;
    }

    return {
      typeHandlers,
      categoryHandlers,
      globalHandlers: this.globalHandlers.size,
    };
  }
}

/**
 * Factory function to create a new EventRegistry instance
 */
export function createEventRegistry(): EventRegistry {
  return new EventRegistry();
}

/**
 * Required context for creating an AgentEvent
 */
export interface CreateEventContext {
  /** Agent node identifier - REQUIRED for routing */
  agentId: string;
  /** Session identifier - REQUIRED for response routing */
  sessionId: string;
  /** Workspace/project path - REQUIRED for context */
  workspacePath: string;
  /** Git branch - REQUIRED for context display */
  gitBranch: string;
  /** Vendor-specific raw data (optional) */
  raw?: unknown;
}

/**
 * Helper to create an AgentEvent with auto-generated ID and timestamp
 *
 * Context fields (agentId, sessionId, workspacePath, gitBranch) are REQUIRED.
 */
export function createEvent<T>(
  type: AgentEventType,
  agent: import('../loaders/types.js').AgentType,
  payload: T,
  context: CreateEventContext
): AgentEvent<T> {
  return {
    id: randomUUID(),
    type,
    agent,
    timestamp: new Date().toISOString(),
    payload,
    agentId: context.agentId,
    sessionId: context.sessionId,
    workspacePath: context.workspacePath,
    gitBranch: context.gitBranch,
    raw: context.raw,
  };
}

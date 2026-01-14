/**
 * Session Provider - Active session tracking for ForkService integration
 *
 * Provides the ISessionProvider interface used by ForkService to
 * auto-detect active sessions for forking operations.
 */

import type { AgentType } from '../../loaders/types.js';
import type { AgentEvent, SessionPayload, UnsubscribeFn } from '../types.js';
import type { EventRegistry } from '../registry.js';

// =============================================================================
// SESSION PROVIDER INTERFACE
// =============================================================================

/**
 * Interface for session providers
 *
 * This interface is consumed by ForkService to look up active sessions
 * when the user initiates a fork operation.
 */
export interface ISessionProvider {
  /**
   * Get the active session for a workspace path
   *
   * @param agentType - Type of agent to look for
   * @param workspacePath - Path to the workspace
   * @returns Session info or null if no active session
   */
  getActiveSession(
    agentType: AgentType,
    workspacePath: string
  ): Promise<{ id: string; updatedAt: string } | null>;

  /**
   * Subscribe to session start events
   *
   * @param callback - Called when a new session starts
   * @returns Unsubscribe function
   */
  onSessionStart?(
    callback: (
      sessionId: string,
      workspacePath: string,
      agentType: AgentType
    ) => void
  ): UnsubscribeFn;

  /**
   * Subscribe to session end events
   *
   * @param callback - Called when a session ends
   * @returns Unsubscribe function
   */
  onSessionEnd?(
    callback: (
      sessionId: string,
      workspacePath: string,
      agentType: AgentType
    ) => void
  ): UnsubscribeFn;
}

// =============================================================================
// ACTIVE SESSION TRACKING
// =============================================================================

/**
 * Internal representation of an active session
 */
interface ActiveSession {
  id: string;
  agentType: AgentType;
  updatedAt: string;
}

// =============================================================================
// HOOKS SESSION PROVIDER
// =============================================================================

/**
 * Session provider backed by the EventRegistry
 *
 * Listens to session:start and session:end events to maintain
 * a map of active sessions per workspace.
 */
export class HooksSessionProvider implements ISessionProvider {
  /** Map of workspace path → active session */
  private activeSessions = new Map<string, ActiveSession>();

  /** Callbacks for session start events */
  private sessionStartCallbacks = new Set<
    (sessionId: string, workspacePath: string, agentType: AgentType) => void
  >();

  /** Callbacks for session end events */
  private sessionEndCallbacks = new Set<
    (sessionId: string, workspacePath: string, agentType: AgentType) => void
  >();

  /** Unsubscribe functions for cleanup */
  private unsubscribers: UnsubscribeFn[] = [];

  constructor(private eventRegistry: EventRegistry) {
    this.setupListeners();
  }

  /**
   * Set up event listeners
   */
  private setupListeners(): void {
    // Listen for session:start events
    const unsubStart = this.eventRegistry.on(
      'session:start',
      (event: AgentEvent<SessionPayload>) => {
        const workspacePath =
          event.workspacePath ?? event.payload.workspacePath;
        if (!workspacePath) {
          return { action: 'continue' as const };
        }

        // Update active session
        this.activeSessions.set(workspacePath, {
          id: event.payload.sessionId,
          agentType: event.agent,
          updatedAt: event.timestamp,
        });

        // Notify callbacks
        for (const callback of this.sessionStartCallbacks) {
          try {
            callback(event.payload.sessionId, workspacePath, event.agent);
          } catch (error) {
            console.error(
              '[HooksSessionProvider] Error in session start callback:',
              error
            );
          }
        }

        return { action: 'continue' as const };
      }
    );
    this.unsubscribers.push(unsubStart);

    // Listen for session:end events
    const unsubEnd = this.eventRegistry.on(
      'session:end',
      (event: AgentEvent<SessionPayload>) => {
        const workspacePath =
          event.workspacePath ?? event.payload.workspacePath;
        if (!workspacePath) {
          return { action: 'continue' as const };
        }

        // Get session before removing
        const session = this.activeSessions.get(workspacePath);

        // Remove session
        this.activeSessions.delete(workspacePath);

        // Notify callbacks
        if (session) {
          for (const callback of this.sessionEndCallbacks) {
            try {
              callback(session.id, workspacePath, session.agentType);
            } catch (error) {
              console.error(
                '[HooksSessionProvider] Error in session end callback:',
                error
              );
            }
          }
        }

        return { action: 'continue' as const };
      }
    );
    this.unsubscribers.push(unsubEnd);
  }

  /**
   * Get the active session for a workspace path
   */
  async getActiveSession(
    agentType: AgentType,
    workspacePath: string
  ): Promise<{ id: string; updatedAt: string } | null> {
    const session = this.activeSessions.get(workspacePath);

    // Check if session exists and matches agent type
    if (!session || session.agentType !== agentType) {
      return null;
    }

    return {
      id: session.id,
      updatedAt: session.updatedAt,
    };
  }

  /**
   * Get active session for any agent type at a workspace
   */
  async getAnyActiveSession(
    workspacePath: string
  ): Promise<{ id: string; agentType: AgentType; updatedAt: string } | null> {
    const session = this.activeSessions.get(workspacePath);
    if (!session) {
      return null;
    }

    return {
      id: session.id,
      agentType: session.agentType,
      updatedAt: session.updatedAt,
    };
  }

  /**
   * Subscribe to session start events
   */
  onSessionStart(
    callback: (
      sessionId: string,
      workspacePath: string,
      agentType: AgentType
    ) => void
  ): UnsubscribeFn {
    this.sessionStartCallbacks.add(callback);
    return () => {
      this.sessionStartCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to session end events
   */
  onSessionEnd(
    callback: (
      sessionId: string,
      workspacePath: string,
      agentType: AgentType
    ) => void
  ): UnsubscribeFn {
    this.sessionEndCallbacks.add(callback);
    return () => {
      this.sessionEndCallbacks.delete(callback);
    };
  }

  /**
   * Get all active sessions
   */
  getAllActiveSessions(): Map<
    string,
    { id: string; agentType: AgentType; updatedAt: string }
  > {
    return new Map(this.activeSessions);
  }

  /**
   * Manually register a session (useful for initialization)
   */
  registerSession(
    workspacePath: string,
    sessionId: string,
    agentType: AgentType
  ): void {
    this.activeSessions.set(workspacePath, {
      id: sessionId,
      agentType,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Manually unregister a session
   */
  unregisterSession(workspacePath: string): void {
    this.activeSessions.delete(workspacePath);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.activeSessions.clear();
    this.sessionStartCallbacks.clear();
    this.sessionEndCallbacks.clear();
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a new session provider backed by an event registry
 */
export function createSessionProvider(
  registry: EventRegistry
): HooksSessionProvider {
  return new HooksSessionProvider(registry);
}

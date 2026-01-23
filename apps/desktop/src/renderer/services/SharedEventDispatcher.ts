/**
 * SharedEventDispatcher
 *
 * Singleton that manages a single IPC subscription for agent events.
 * Directly routes permission requests to agentActionStore.
 * Adapters no longer handle event forwarding - this centralizes event handling.
 *
 * This solves the problem of multiple ClaudeCodeAdapter instances each setting up
 * their own IPC listeners, causing duplicate event delivery.
 *
 * Handles two event channels:
 * 1. coding-agent:event - SDK-based agent events (ClaudeCodeAgent)
 * 2. agent-lifecycle - Terminal-based agent lifecycle events (HTTP sideband)
 */

import type {
  AgentAction,
  ClarifyingQuestionAction,
  LifecycleEvent,
  ToolApprovalAction,
} from '@agent-orchestrator/shared';
import type { AgentAdapterEvent } from '../context/node-services/coding-agent-adapter';
import { useActionPillStore } from '../features/action-pill';

type EventCallback<T = AgentAdapterEvent> = (event: T) => void;

class SharedEventDispatcher {
  private static instance: SharedEventDispatcher | null = null;
  private listeners = new Map<string, Set<EventCallback>>();
  private ipcCleanup: (() => void) | null = null;
  private lifecycleCleanup: (() => void) | null = null;
  private initialized = false;
  private processedEventIds = new Set<string>();

  static getInstance(): SharedEventDispatcher {
    if (!SharedEventDispatcher.instance) {
      SharedEventDispatcher.instance = new SharedEventDispatcher();
    }
    return SharedEventDispatcher.instance;
  }

  /**
   * Initialize the dispatcher - sets up IPC listeners for both channels.
   * Safe to call multiple times (idempotent).
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    // Subscribe to SDK agent events (ClaudeCodeAgent via SDK hooks)
    if (window.codingAgentAPI?.onAgentEvent) {
      this.ipcCleanup = window.codingAgentAPI.onAgentEvent((event: unknown) => {
        this.handleEvent(event as AgentAdapterEvent);
      });
    }

    // Subscribe to terminal agent lifecycle events (HTTP sideband)
    if (window.codingAgentAPI?.onAgentLifecycle) {
      this.lifecycleCleanup = window.codingAgentAPI.onAgentLifecycle((event: unknown) => {
        this.handleLifecycleEvent(event as LifecycleEvent);
      });
    }

    this.initialized = true;
    console.log('[SharedEventDispatcher] Initialized with IPC listeners');
  }

  /**
   * Subscribe to specific event types.
   * Returns unsubscribe function.
   */
  subscribe<T extends AgentAdapterEvent['type']>(
    type: T,
    callback: EventCallback<Extract<AgentAdapterEvent, { type: T }>>
  ): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)?.add(callback as EventCallback);

    return () => {
      this.listeners.get(type)?.delete(callback as EventCallback);
    };
  }

  private handleEvent(event: AgentAdapterEvent): void {
    // Deduplicate by event ID if present
    const eventId = (event as { id?: string }).id;
    if (eventId) {
      if (this.processedEventIds.has(eventId)) {
        return;
      }
      this.processedEventIds.add(eventId);
      // Cleanup old IDs periodically (keep last 500)
      if (this.processedEventIds.size > 1000) {
        const ids = Array.from(this.processedEventIds);
        this.processedEventIds = new Set(ids.slice(-500));
      }
    }

    // Handle permission requests directly → ActionPill store
    if (event.type === 'permission:request') {
      const action = this.buildActionFromPermissionEvent(event);
      if (action) {
        useActionPillStore.getState().addAction(action);
      }
    }

    // Notify any other subscribers
    const callbacks = this.listeners.get(event.type);
    callbacks?.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error(`[SharedEventDispatcher] Error in ${event.type} handler:`, err);
      }
    });
  }

  /**
   * Handle lifecycle events from terminal-based agents (HTTP sideband).
   * These come from notify.sh scripts called by Claude Code hooks.
   */
  private handleLifecycleEvent(event: LifecycleEvent): void {
    // Deduplicate by creating an ID from event properties
    const eventId = `lifecycle-${event.terminalId}-${event.type}-${event.timestamp}`;
    if (this.processedEventIds.has(eventId)) {
      return;
    }
    this.processedEventIds.add(eventId);

    console.log('[SharedEventDispatcher] Received lifecycle event:', event);

    // Forward lifecycle events to subscribers
    // Map lifecycle types to our event types for compatibility
    const eventTypeMap: Record<string, string> = {
      Start: 'session:start',
      Stop: 'session:end',
      PermissionRequest: 'permission:request',
    };

    const mappedType = eventTypeMap[event.type];
    if (mappedType) {
      const callbacks = this.listeners.get(mappedType);
      callbacks?.forEach((cb) => {
        try {
          // Convert to AgentAdapterEvent format for compatibility
          cb({
            type: mappedType,
            agentId: event.agentId,
            sessionId: event.sessionId,
            payload: {
              sessionId: event.sessionId,
              workspacePath: event.workspacePath,
            },
          } as unknown as AgentAdapterEvent);
        } catch (err) {
          console.error(`[SharedEventDispatcher] Error in ${mappedType} handler:`, err);
        }
      });
    }
  }

  private buildActionFromPermissionEvent(
    event: Extract<AgentAdapterEvent, { type: 'permission:request' }>
  ): AgentAction | null {
    const { payload, agentId, sessionId } = event;
    const eventId = (event as { id?: string }).id;
    const raw = (event as { raw?: Record<string, unknown> }).raw;

    // Extract required fields from raw event data
    const toolUseId = raw?.toolUseId as string | undefined;
    const workspacePath = (raw?.workspacePath as string) ?? payload.workingDirectory;
    const gitBranch = raw?.gitBranch as string | undefined;

    // Validate required fields - throw errors instead of using defaults
    if (!agentId) {
      console.error('[SharedEventDispatcher] Missing required field: agentId', event);
      throw new Error('[SharedEventDispatcher] Cannot build action: agentId is required');
    }
    if (!sessionId) {
      console.error('[SharedEventDispatcher] Missing required field: sessionId', event);
      throw new Error('[SharedEventDispatcher] Cannot build action: sessionId is required');
    }
    if (!workspacePath) {
      console.error('[SharedEventDispatcher] Missing required field: workspacePath', event);
      throw new Error('[SharedEventDispatcher] Cannot build action: workspacePath is required');
    }
    if (!gitBranch) {
      console.error('[SharedEventDispatcher] Missing required field: gitBranch', event);
      throw new Error('[SharedEventDispatcher] Cannot build action: gitBranch is required');
    }
    if (!toolUseId) {
      console.error('[SharedEventDispatcher] Missing required field: toolUseId', event);
      throw new Error('[SharedEventDispatcher] Cannot build action: toolUseId is required');
    }

    // Clarifying question (AskUserQuestion tool)
    if (payload.toolName === 'askuserquestion' || payload.toolName === 'AskUserQuestion') {
      const toolInput = raw?.toolInput as { questions?: unknown[] } | undefined;
      const questions = toolInput?.questions;

      if (!Array.isArray(questions)) {
        return null;
      }

      return {
        id: eventId ?? `${agentId}-${toolUseId}`,
        type: 'clarifying_question',
        agentId,
        sessionId,
        workspacePath,
        gitBranch,
        toolUseId,
        createdAt: new Date().toISOString(),
        questions: questions.map((q: unknown) => {
          const question = q as { question?: string; options?: unknown[] };
          return {
            question: question.question ?? '',
            options: Array.isArray(question.options)
              ? question.options.map((o: unknown) => {
                  const opt = o as { label?: string; value?: string };
                  return { label: opt.label ?? '', value: opt.value ?? opt.label ?? '' };
                })
              : [],
          };
        }),
      } as ClarifyingQuestionAction;
    }

    // Tool approval
    return {
      id: eventId ?? `${agentId}-${toolUseId}`,
      type: 'tool_approval',
      agentId,
      sessionId,
      workspacePath,
      gitBranch,
      toolUseId,
      createdAt: new Date().toISOString(),
      toolName: payload.toolName,
      command: payload.command,
      filePath: payload.filePath,
      workingDirectory: payload.workingDirectory,
      reason: payload.reason,
    } as ToolApprovalAction;
  }

  /**
   * Cleanup - call on app unmount if needed.
   */
  dispose(): void {
    this.ipcCleanup?.();
    this.ipcCleanup = null;
    this.lifecycleCleanup?.();
    this.lifecycleCleanup = null;
    this.listeners.clear();
    this.processedEventIds.clear();
    this.initialized = false;
  }
}

export const sharedEventDispatcher = SharedEventDispatcher.getInstance();

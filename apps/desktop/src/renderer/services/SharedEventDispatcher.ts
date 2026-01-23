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

// Debug logging helper (writes to file via IPC)
const DBG_ID = 'DBG-h00ks1';
let dbgStep = 2000; // Start at 2000 for renderer to distinguish from main process
declare global {
  interface Window {
    debugLog?: { write: (line: string) => void };
  }
}
function dbg(loc: string, state: Record<string, unknown>) {
  dbgStep++;
  const line = `[${DBG_ID}] Step ${dbgStep} | SharedEventDispatcher.ts:${loc} | ${JSON.stringify(state)}`;
  try {
    window.debugLog?.write(line);
  } catch {
    // Ignore if not available
  }
}

import type {
  AgentAction,
  ClarifyingQuestionAction,
  LifecycleEvent,
  ToolApprovalAction,
} from '@agent-orchestrator/shared';
// ToolApprovalAction is used for lifecycle events → ActionPill
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
    dbg('initialize-entry', {
      alreadyInitialized: this.initialized,
      hasOnAgentEvent: !!window.codingAgentAPI?.onAgentEvent,
      hasOnAgentLifecycle: !!window.codingAgentAPI?.onAgentLifecycle,
    });

    if (this.initialized) {
      return;
    }

    // Subscribe to SDK agent events (ClaudeCodeAgent via SDK hooks)
    if (window.codingAgentAPI?.onAgentEvent) {
      dbg('initialize-sdk-subscription', { subscribing: true });
      this.ipcCleanup = window.codingAgentAPI.onAgentEvent((event: unknown) => {
        dbg('sdk-event-received', { eventType: (event as { type?: string }).type });
        this.handleEvent(event as AgentAdapterEvent);
      });
    }

    // Subscribe to terminal agent lifecycle events (HTTP sideband)
    if (window.codingAgentAPI?.onAgentLifecycle) {
      dbg('initialize-lifecycle-subscription', { subscribing: true });
      this.lifecycleCleanup = window.codingAgentAPI.onAgentLifecycle((event: unknown) => {
        dbg('lifecycle-event-received', { event });
        this.handleLifecycleEvent(event as LifecycleEvent);
      });
    }

    this.initialized = true;
    dbg('initialize-complete', { initialized: true });
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
      try {
        const action = this.buildActionFromPermissionEvent(event);
        if (action) {
          useActionPillStore.getState().addAction(action);
        }
      } catch (err) {
        console.error('[SharedEventDispatcher] Failed to build action from permission event:', err);
        console.error('[SharedEventDispatcher] Event that caused the error:', event);
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
    dbg('handleLifecycleEvent-entry', {
      eventType: event.type,
      terminalId: event.terminalId,
      agentId: event.agentId,
      sessionId: event.sessionId,
    });

    // Deduplicate by creating an ID from event properties
    const eventId = `lifecycle-${event.terminalId}-${event.type}-${event.timestamp}`;
    if (this.processedEventIds.has(eventId)) {
      dbg('handleLifecycleEvent-duplicate', { eventId });
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
      PreToolUse: 'permission:request', // Map PreToolUse to permission request
    };

    const mappedType = eventTypeMap[event.type];
    dbg('handleLifecycleEvent-mapping', {
      originalType: event.type,
      mappedType: mappedType || 'NO MAPPING',
      hasListeners: mappedType ? (this.listeners.get(mappedType)?.size ?? 0) : 0,
    });

    // Handle permission requests → add to ActionPill store
    if (mappedType === 'permission:request') {
      dbg('handleLifecycleEvent-permission-request', {
        agentId: event.agentId,
        sessionId: event.sessionId,
        terminalId: event.terminalId,
      });

      // Build a ToolApprovalAction from the lifecycle event
      // toolInput can be an object (from jq merge) or string (fallback)
      let toolInputObj: Record<string, unknown> = {};
      if (event.toolInput) {
        if (typeof event.toolInput === 'object') {
          toolInputObj = event.toolInput as Record<string, unknown>;
        } else if (typeof event.toolInput === 'string') {
          try {
            toolInputObj = JSON.parse(event.toolInput);
          } catch {
            toolInputObj = { raw: event.toolInput };
          }
        }
      }

      const action: ToolApprovalAction = {
        type: 'tool_approval',
        id: `lifecycle-${event.terminalId}-${event.timestamp}`,
        agentId: event.agentId,
        sessionId: event.sessionId,
        workspacePath: event.workspacePath,
        gitBranch: event.gitBranch,
        toolUseId: event.toolUseId || `terminal-tool-${Date.now()}`,
        toolName: event.toolName || 'Terminal Tool',
        input: toolInputObj,
        timestamp: Date.now(),
      };

      dbg('handleLifecycleEvent-adding-action', { actionId: action.id, actionType: action.type });
      useActionPillStore.getState().addAction(action);
    }

    // Forward to any subscribers
    if (mappedType) {
      const callbacks = this.listeners.get(mappedType);
      dbg('handleLifecycleEvent-forwarding', {
        mappedType,
        listenerCount: callbacks?.size ?? 0,
      });

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
          dbg('handleLifecycleEvent-error', { error: String(err), mappedType });
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

    // Extract required fields - these are at the TOP LEVEL of the event (set by ClaudeCodeAgent)
    // Not in raw! The raw object only has toolInput, toolUseId, signal, suggestions
    const toolUseId = raw?.toolUseId as string | undefined;
    const workspacePath =
      (event as { workspacePath?: string }).workspacePath ?? payload.workingDirectory;
    const gitBranch = (event as { gitBranch?: string }).gitBranch;

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

    // Tool approval - include input from raw.toolInput for displaying in ActionPill
    const toolInput = raw?.toolInput as Record<string, unknown> | undefined;
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
      input: toolInput,
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

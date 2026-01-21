/**
 * SharedEventDispatcher
 *
 * Singleton that manages a single IPC subscription for agent events.
 * Directly routes permission requests to agentActionStore.
 * Adapters no longer handle event forwarding - this centralizes event handling.
 *
 * This solves the problem of multiple ClaudeCodeAdapter instances each setting up
 * their own IPC listeners, causing duplicate event delivery.
 */

import type {
  AgentAction,
  ClarifyingQuestionAction,
  ToolApprovalAction,
} from '@agent-orchestrator/shared';
import type { AgentAdapterEvent } from '../context/node-services/coding-agent-adapter';
import { useActionPillStore } from '../features/action-pill';
import { useActionFlowLogger } from '../features/action-pill/store/actionFlowLogger';

type EventCallback<T = AgentAdapterEvent> = (event: T) => void;

class SharedEventDispatcher {
  private static instance: SharedEventDispatcher | null = null;
  private listeners = new Map<string, Set<EventCallback>>();
  private ipcCleanup: (() => void) | null = null;
  private initialized = false;
  private processedEventIds = new Set<string>();

  static getInstance(): SharedEventDispatcher {
    if (!SharedEventDispatcher.instance) {
      SharedEventDispatcher.instance = new SharedEventDispatcher();
    }
    return SharedEventDispatcher.instance;
  }

  /**
   * Initialize the dispatcher - sets up single IPC listener.
   * Safe to call multiple times (idempotent).
   */
  initialize(): void {
    if (this.initialized || !window.codingAgentAPI?.onAgentEvent) {
      return;
    }

    this.ipcCleanup = window.codingAgentAPI.onAgentEvent((event: unknown) => {
      this.handleEvent(event as AgentAdapterEvent);
    });
    this.initialized = true;
    console.log('[SharedEventDispatcher] Initialized with single IPC listener');
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
      // STEP 16: Log event received in renderer
      console.log('[STEP 16 - Renderer] Permission event received', {
        eventAgentId: event.agentId || 'MISSING IN EVENT!',
        eventKeys: Object.keys(event),
        event: JSON.stringify(event),
        eventId,
        sessionId: event.sessionId,
        toolName: event.payload.toolName,
      });

      // Log event received
      try {
        useActionFlowLogger.getState().addLog(
          'STEP 16: Permission Event Received',
          `Permission request event received from main process. agentId: ${event.agentId || 'MISSING!'}`,
          event.agentId ? 'info' : 'error',
          {
            agentId: event.agentId,
            details: {
              eventId,
              sessionId: event.sessionId,
              toolName: event.payload.toolName,
              eventAgentId: event.agentId,
            },
          }
        );
      } catch (err) {
        console.error('[SharedEventDispatcher] Failed to log event:', err);
      }

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

  private buildActionFromPermissionEvent(
    event: Extract<AgentAdapterEvent, { type: 'permission:request' }>
  ): AgentAction | null {
    const { payload, agentId, sessionId } = event;
    const eventId = (event as { id?: string }).id;
    const raw = (event as { raw?: Record<string, unknown> }).raw;
    const toolUseId = raw?.toolUseId as string | undefined;

    // Clarifying question (AskUserQuestion tool)
    if (payload.toolName === 'askuserquestion' || payload.toolName === 'AskUserQuestion') {
      const toolInput = raw?.toolInput as { questions?: unknown[] } | undefined;
      const questions = toolInput?.questions;

      if (!Array.isArray(questions)) {
        return null;
      }

      return {
        id: eventId ?? `${agentId}-${toolUseId ?? Date.now()}`,
        type: 'clarifying_question',
        agentId,
        sessionId,
        createdAt: new Date().toISOString(),
        toolUseId,
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

    // STEP 17: Log before creating action
    console.log('[STEP 17 - Renderer] About to create action', {
      eventAgentId: agentId || 'MISSING FROM EVENT!',
      eventId,
      toolName: payload.toolName,
    });

    // Tool approval
    const actionId = eventId ?? `${agentId}-${toolUseId ?? Date.now()}`;
    const action = {
      id: actionId,
      type: 'tool_approval',
      agentId,
      sessionId,
      createdAt: new Date().toISOString(),
      toolName: payload.toolName,
      command: payload.command,
      filePath: payload.filePath,
      workingDirectory: payload.workingDirectory,
      reason: payload.reason,
      toolUseId,
    } as ToolApprovalAction;

    // STEP 18: Log action creation
    console.log('[STEP 18 - Renderer] Action created', {
      actionId,
      actionAgentId: action.agentId || 'MISSING IN ACTION!',
      action: JSON.stringify(action),
    });

    try {
      useActionFlowLogger.getState().addLog(
        'STEP 18: Action Created',
        `Action "${actionId}" created with agentId: ${agentId || 'MISSING!'}`,
        agentId ? 'success' : 'error',
        {
          agentId,
          actionId,
          details: {
            type: 'tool_approval',
            toolName: payload.toolName,
            command: payload.command,
            filePath: payload.filePath,
            actionAgentId: action.agentId,
          },
        }
      );
    } catch (err) {
      console.error('[SharedEventDispatcher] Failed to log action creation:', err);
    }

    return action;
  }

  /**
   * Cleanup - call on app unmount if needed.
   */
  dispose(): void {
    this.ipcCleanup?.();
    this.ipcCleanup = null;
    this.listeners.clear();
    this.processedEventIds.clear();
    this.initialized = false;
  }
}

export const sharedEventDispatcher = SharedEventDispatcher.getInstance();

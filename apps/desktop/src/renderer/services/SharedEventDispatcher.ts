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
  private initializationTime: number | null = null;

  /**
   * Short grace period (in ms) after initialization for timestamp-based filtering.
   * Events with timestamps older than initialization time are filtered.
   * This is a fallback for events without parseable timestamps.
   */
  private static readonly STARTUP_GRACE_PERIOD_MS = 1000;

  static getInstance(): SharedEventDispatcher {
    if (!SharedEventDispatcher.instance) {
      SharedEventDispatcher.instance = new SharedEventDispatcher();
    }
    return SharedEventDispatcher.instance;
  }

  /**
   * Initialize the dispatcher - sets up IPC listeners for both channels.
   * Safe to call multiple times (idempotent).
   *
   * Clears any stale pending actions from previous sessions on startup.
   * This ensures actions don't persist across app restarts (e.g., from HMR in dev mode).
   */
  initialize(): void {
    if (this.initialized) {
      console.log('[SharedEventDispatcher] Already initialized, skipping');
      return;
    }

    // Clear any stale actions from previous session
    // This handles cases where actions might persist due to HMR or other edge cases
    const existingActions = useActionPillStore.getState().actions;
    console.log('[SharedEventDispatcher] Clearing stale actions on startup', {
      actionCount: existingActions.length,
      actions: existingActions.map((a) => ({ id: a.id, type: a.type, agentId: a.agentId })),
    });
    useActionPillStore.getState().clearAll();

    // Record initialization time to filter stale events during startup grace period
    this.initializationTime = Date.now();

    // Subscribe to SDK agent events (ClaudeCodeAgent via SDK hooks)
    if (window.codingAgentAPI?.onAgentEvent) {
      this.ipcCleanup = window.codingAgentAPI.onAgentEvent((event: unknown) => {
        console.log('[SharedEventDispatcher] Received SDK agent event', {
          type: (event as AgentAdapterEvent).type,
          agentId: (event as AgentAdapterEvent).agentId,
          sessionId: (event as AgentAdapterEvent).sessionId,
        });
        this.handleEvent(event as AgentAdapterEvent);
      });
    }

    // Subscribe to terminal agent lifecycle events (HTTP sideband)
    if (window.codingAgentAPI?.onAgentLifecycle) {
      this.lifecycleCleanup = window.codingAgentAPI.onAgentLifecycle((event: unknown) => {
        console.log('[SharedEventDispatcher] Received lifecycle event from terminal', {
          type: (event as LifecycleEvent).type,
          terminalId: (event as LifecycleEvent).terminalId,
          agentId: (event as LifecycleEvent).agentId,
          toolName: (event as LifecycleEvent).toolName,
        });
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

  /**
   * Check if an SDK permission event should be shown in the ActionPill.
   * SDK events only show AskUserQuestion (clarifying questions that need user response).
   * Regular tool permission prompts are handled in the terminal UI, not ActionPill.
   */
  private shouldShowSdkEventInActionPill(
    event: Extract<AgentAdapterEvent, { type: 'permission:request' }>
  ): boolean {
    const toolName = event.payload.toolName?.toLowerCase();
    return toolName === 'askuserquestion' || toolName === 'askclarifyingquestion';
  }

  /**
   * Check if an event is stale based on its timestamp.
   * An event is considered stale if:
   * 1. We're still within the grace period after initialization, AND
   * 2. The event's timestamp is older than our initialization time
   *
   * This allows legitimate new events to pass through even during the grace period,
   * while filtering out stale events from session history.
   *
   * @param eventTimestamp - The event's timestamp (Unix ms, Unix seconds, or ISO string)
   * @returns true if the event should be filtered as stale
   */
  private isStaleEvent(eventTimestamp: number | string | undefined): boolean {
    if (!this.initializationTime) {
      return false;
    }

    const timeSinceInit = Date.now() - this.initializationTime;

    // After grace period, accept all events
    if (timeSinceInit >= SharedEventDispatcher.STARTUP_GRACE_PERIOD_MS) {
      return false;
    }

    // During grace period, filter based on event timestamp
    if (eventTimestamp === undefined) {
      // No timestamp available - can't determine staleness, accept the event
      // This is safer than dropping potentially legitimate events
      return false;
    }

    // Threshold to distinguish Unix seconds from milliseconds:
    // - Unix seconds are ~1.7 billion (10 digits) for current dates
    // - Unix milliseconds are ~1.7 trillion (13 digits) for current dates
    // Using 10 billion as threshold safely distinguishes between them
    const SECONDS_VS_MS_THRESHOLD = 10_000_000_000;

    let eventTimeMs: number;
    if (typeof eventTimestamp === 'string') {
      // Try parsing as ISO string or Unix timestamp string
      const parsed = Date.parse(eventTimestamp);
      if (isNaN(parsed)) {
        // Try as Unix timestamp (seconds)
        const asNumber = Number(eventTimestamp);
        if (isNaN(asNumber)) {
          return false; // Can't parse, accept the event
        }
        // If it looks like seconds (< 10 billion), convert to ms
        eventTimeMs = asNumber < SECONDS_VS_MS_THRESHOLD ? asNumber * 1000 : asNumber;
      } else {
        eventTimeMs = parsed;
      }
    } else {
      // Number - could be ms or seconds
      eventTimeMs =
        eventTimestamp < SECONDS_VS_MS_THRESHOLD ? eventTimestamp * 1000 : eventTimestamp;
    }

    // Event is stale if it was created before we initialized
    return eventTimeMs < this.initializationTime;
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
    // Only show AskUserQuestion in ActionPill; other tools are handled in terminal UI
    if (event.type === 'permission:request' && this.shouldShowSdkEventInActionPill(event)) {
      // Filter stale events based on timestamp comparison
      // When the app starts and SDK connects to existing sessions, stale permission requests
      // from session history may be re-emitted. We filter these by comparing event timestamps.
      const raw = (event as { raw?: Record<string, unknown> }).raw;
      const eventTimestamp =
        (raw?.timestamp as number | string | undefined) ??
        (raw?.createdAt as number | string | undefined);

      if (this.isStaleEvent(eventTimestamp)) {
        console.log('[SharedEventDispatcher] Filtering stale SDK permission event', {
          eventId,
          agentId: event.agentId,
          eventTimestamp,
          initializationTime: this.initializationTime,
        });
        return;
      }

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
   * Parse toolInput which can be an object or JSON string.
   * Returns an empty object if parsing fails.
   */
  private parseToolInput(toolInput: unknown): Record<string, unknown> {
    if (!toolInput) {
      return {};
    }

    if (typeof toolInput === 'object') {
      return toolInput as Record<string, unknown>;
    }

    if (typeof toolInput === 'string') {
      try {
        return JSON.parse(toolInput);
      } catch (parseError) {
        console.warn(
          '[SharedEventDispatcher] toolInput is not valid JSON, storing as raw:',
          parseError
        );
        return { raw: toolInput };
      }
    }

    return {};
  }

  /**
   * Map lifecycle event types to internal event types.
   * Returns null for unrecognized types.
   */
  private mapLifecycleTypeToEventType(
    type: string
  ): 'session:start' | 'session:end' | 'permission:request' | 'tool:begin' | null {
    switch (type) {
      case 'Start':
        return 'session:start';
      case 'Stop':
        return 'session:end';
      case 'PermissionRequest':
        return 'permission:request';
      case 'PreToolUse':
        return 'tool:begin';
      default:
        return null;
    }
  }

  /**
   * Check if a lifecycle event should show in ActionPill.
   * - PermissionRequest: always show (actual permission prompts)
   * - PreToolUse: only show AskUserQuestion (clarifying questions)
   */
  private shouldLifecycleEventShowInActionPill(event: LifecycleEvent): boolean {
    if (event.type === 'PermissionRequest') {
      return true;
    }
    if (event.type === 'PreToolUse') {
      const toolName = event.toolName?.toLowerCase();
      return toolName === 'askuserquestion' || toolName === 'askclarifyingquestion';
    }
    return false;
  }

  /**
   * Check if a lifecycle event is an AskUserQuestion (clarifying question)
   */
  private isAskUserQuestionEvent(event: LifecycleEvent): boolean {
    if (event.type !== 'PreToolUse') return false;
    const toolName = event.toolName?.toLowerCase();
    return toolName === 'askuserquestion' || toolName === 'askclarifyingquestion';
  }

  /**
   * Build the appropriate action type from a lifecycle event.
   * - AskUserQuestion → ClarifyingQuestionAction with questions/options
   * - Other events → ToolApprovalAction
   */
  private buildActionFromLifecycleEvent(event: LifecycleEvent): AgentAction {
    const baseFields = {
      id: `lifecycle-${event.terminalId}-${event.timestamp}`,
      agentId: event.agentId,
      sessionId: event.sessionId,
      workspacePath: event.workspacePath,
      gitBranch: event.gitBranch,
      toolUseId: event.toolUseId || `terminal-tool-${Date.now()}`,
      createdAt: new Date().toISOString(),
      terminalId: event.terminalId,
    };

    // For AskUserQuestion, create a ClarifyingQuestionAction with questions/options
    if (this.isAskUserQuestionEvent(event)) {
      const toolInput = this.parseToolInput(event.toolInput) as { questions?: unknown[] };
      const questions = Array.isArray(toolInput.questions)
        ? toolInput.questions.map((q) => this.mapQuestion(q))
        : [];

      return {
        ...baseFields,
        type: 'clarifying_question',
        questions,
      } as ClarifyingQuestionAction & { terminalId: string };
    }

    // For other events, create a ToolApprovalAction
    return {
      ...baseFields,
      type: 'tool_approval',
      toolName: event.toolName || 'Terminal Tool',
      input: this.parseToolInput(event.toolInput),
    } as ToolApprovalAction;
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

    // Map lifecycle types to our event types for compatibility
    const mappedType = this.mapLifecycleTypeToEventType(event.type);
    if (!mappedType) {
      return;
    }

    // Add to ActionPill store if this event type should show
    // - PermissionRequest: always (actual permission prompts)
    // - PreToolUse: only AskUserQuestion (clarifying questions)
    if (this.shouldLifecycleEventShowInActionPill(event)) {
      // Filter stale events based on timestamp comparison
      // Lifecycle events have a timestamp field we can use directly
      if (this.isStaleEvent(event.timestamp)) {
        console.log('[SharedEventDispatcher] Filtering stale lifecycle event', {
          eventId,
          type: event.type,
          terminalId: event.terminalId,
          eventTimestamp: event.timestamp,
          initializationTime: this.initializationTime,
        });
        return;
      }

      const action = this.buildActionFromLifecycleEvent(event);
      useActionPillStore.getState().addAction(action);
    }

    // Forward to any subscribers
    const callbacks = this.listeners.get(mappedType);
    callbacks?.forEach((cb) => {
      try {
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

  /**
   * Validate and extract required fields from a permission event.
   * Throws descriptive errors if any required field is missing.
   */
  private validatePermissionEventFields(
    event: Extract<AgentAdapterEvent, { type: 'permission:request' }>
  ): {
    agentId: string;
    sessionId: string;
    workspacePath: string;
    gitBranch: string;
    toolUseId: string;
    eventId: string | undefined;
    raw: Record<string, unknown> | undefined;
  } {
    const { agentId, sessionId } = event;
    const eventId = (event as { id?: string }).id;
    const raw = (event as { raw?: Record<string, unknown> }).raw;
    const toolUseId = raw?.toolUseId as string | undefined;
    const workspacePath =
      (event as { workspacePath?: string }).workspacePath ?? event.payload.workingDirectory;
    const gitBranch = (event as { gitBranch?: string }).gitBranch;

    // Validate all required fields - collect missing fields for a single error message
    const missingFields: string[] = [];
    if (!agentId) missingFields.push('agentId');
    if (!sessionId) missingFields.push('sessionId');
    if (!workspacePath) missingFields.push('workspacePath');
    if (!gitBranch) missingFields.push('gitBranch');
    if (!toolUseId) missingFields.push('toolUseId');

    if (missingFields.length > 0) {
      console.error('[SharedEventDispatcher] Missing required fields:', missingFields, event);
      throw new Error(
        `[SharedEventDispatcher] Cannot build action: missing required fields: ${missingFields.join(', ')}`
      );
    }

    return {
      agentId: agentId!,
      sessionId: sessionId!,
      workspacePath: workspacePath!,
      gitBranch: gitBranch!,
      toolUseId: toolUseId!,
      eventId,
      raw,
    };
  }

  /**
   * Map a raw question object to a typed question with options.
   */
  private mapQuestion(q: unknown): {
    question: string;
    options: { label: string; value: string }[];
  } {
    const questionObj = q as { question?: string; options?: unknown[] };
    const questionText = questionObj.question ?? '';

    if (!Array.isArray(questionObj.options)) {
      return { question: questionText, options: [] };
    }

    const options = questionObj.options.map((o: unknown) => {
      const opt = o as { label?: string; value?: string };
      const label = opt.label ?? '';
      const value = opt.value ?? opt.label ?? '';
      return { label, value };
    });

    return { question: questionText, options };
  }

  private buildActionFromPermissionEvent(
    event: Extract<AgentAdapterEvent, { type: 'permission:request' }>
  ): AgentAction | null {
    const { payload } = event;
    const fields = this.validatePermissionEventFields(event);
    const actionId = fields.eventId ?? `${fields.agentId}-${fields.toolUseId}`;
    const createdAt = new Date().toISOString();

    // Clarifying question (AskUserQuestion tool)
    const isAskUserQuestion =
      payload.toolName === 'askuserquestion' || payload.toolName === 'AskUserQuestion';

    if (isAskUserQuestion) {
      const toolInput = fields.raw?.toolInput as { questions?: unknown[] } | undefined;
      const questions = toolInput?.questions;

      if (!Array.isArray(questions)) {
        return null;
      }

      return {
        id: actionId,
        type: 'clarifying_question',
        agentId: fields.agentId,
        sessionId: fields.sessionId,
        workspacePath: fields.workspacePath,
        gitBranch: fields.gitBranch,
        toolUseId: fields.toolUseId,
        createdAt,
        questions: questions.map((q) => this.mapQuestion(q)),
      } as ClarifyingQuestionAction;
    }

    // Tool approval - include input from raw.toolInput for displaying in ActionPill
    const toolInput = fields.raw?.toolInput as Record<string, unknown> | undefined;
    return {
      id: actionId,
      type: 'tool_approval',
      agentId: fields.agentId,
      sessionId: fields.sessionId,
      workspacePath: fields.workspacePath,
      gitBranch: fields.gitBranch,
      toolUseId: fields.toolUseId,
      createdAt,
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
    this.initializationTime = null;
    this.initialized = false;
  }
}

export const sharedEventDispatcher = SharedEventDispatcher.getInstance();

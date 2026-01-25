/**
 * Tool Completion Service
 *
 * Handles automatic dismissal of action pill items when tools complete or error.
 *
 * Flow:
 * 1. Listen for tool:complete and tool:error events from SharedEventDispatcher
 * 2. Match event.toolUseId to action.toolUseId
 * 3. Show brief visual feedback (500ms)
 * 4. Remove action from store
 *
 * Supports both SDK agents (via coding-agent:event IPC) and terminal agents
 * (via agent-lifecycle HTTP sideband).
 */

import { sharedEventDispatcher } from '../../../services/SharedEventDispatcher';
import { useActionPillStore } from '../store';

export interface IToolCompletionService {
  initialize(): void;
  dispose(): void;
}

interface ToolEventShape {
  type?: string;
  payload?: { toolUseId?: string };
  raw?: { toolUseId?: string };
}

/** Duration of visual feedback before action is removed from the pill */
const DISMISSAL_FEEDBACK_DURATION_MS = 500;

/** Maximum processed IDs to keep before cleanup */
const MAX_PROCESSED_IDS = 750;

/** Number of IDs to keep after cleanup */
const KEEP_PROCESSED_IDS = 500;

class ToolCompletionServiceImpl implements IToolCompletionService {
  private unsubscribeComplete: (() => void) | null = null;
  private unsubscribeError: (() => void) | null = null;
  private processedToolUseIds = new Set<string>();
  private dismissalTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  initialize(): void {
    if (this.unsubscribeComplete || this.unsubscribeError) {
      console.warn('[ToolCompletionService] Already initialized, skipping');
      return;
    }

    // Subscribe to tool:complete events
    this.unsubscribeComplete = sharedEventDispatcher.subscribe('tool:complete', (event) => {
      this.handleToolCompletion(event as ToolEventShape);
    });

    // Subscribe to tool:error events
    this.unsubscribeError = sharedEventDispatcher.subscribe('tool:error', (event) => {
      this.handleToolCompletion(event as ToolEventShape);
    });

    console.log('[ToolCompletionService] Initialized');
  }

  dispose(): void {
    this.unsubscribeComplete?.();
    this.unsubscribeComplete = null;

    this.unsubscribeError?.();
    this.unsubscribeError = null;

    // Clear any pending dismissal timeouts
    for (const timeout of this.dismissalTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.dismissalTimeouts.clear();
    this.processedToolUseIds.clear();

    console.log('[ToolCompletionService] Disposed');
  }

  private handleToolCompletion(event: ToolEventShape): void {
    // Extract toolUseId from event (try both payload and raw)
    const toolUseId = event.payload?.toolUseId ?? event.raw?.toolUseId;

    // Most tool completion events won't have a toolUseId (only permission-requiring
    // tools like AskUserQuestion have them). This is the common case, so we exit
    // silently without logging to avoid noise.
    if (!toolUseId) {
      return;
    }

    // Deduplicate: only process each toolUseId once
    if (this.processedToolUseIds.has(toolUseId)) {
      return;
    }
    this.processedToolUseIds.add(toolUseId);

    // Cleanup old IDs periodically
    if (this.processedToolUseIds.size > MAX_PROCESSED_IDS) {
      const ids = Array.from(this.processedToolUseIds);
      this.processedToolUseIds = new Set(ids.slice(-KEEP_PROCESSED_IDS));
    }

    // Find action by toolUseId
    const matchingAction = useActionPillStore
      .getState()
      .actions.find((action) => action.toolUseId === toolUseId);

    // No matching action - the tool didn't require approval or was already dismissed
    if (!matchingAction) {
      return;
    }

    console.log('[ToolCompletionService] Tool completed, dismissing action', {
      actionId: matchingAction.id,
      toolUseId,
      eventType: event.type,
    });

    // Start dismissal sequence
    this.dismissAction(matchingAction.id);
  }

  private dismissAction(actionId: string): void {
    // Mark as dismissing for visual feedback
    useActionPillStore.getState().markDismissing(actionId);

    // Cancel any existing timeout for this action (idempotent)
    const existingTimeout = this.dismissalTimeouts.get(actionId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Complete dismissal after feedback delay
    const timeout = setTimeout(() => {
      useActionPillStore.getState().completeDismissal(actionId);
      this.dismissalTimeouts.delete(actionId);
    }, DISMISSAL_FEEDBACK_DURATION_MS);

    this.dismissalTimeouts.set(actionId, timeout);
  }
}

export const toolCompletionService: IToolCompletionService = new ToolCompletionServiceImpl();

/**
 * ActionPill Zustand Store
 *
 * Centralized state management for the ActionPill feature.
 * Replaces the class-based AgentActionStore and local useState calls.
 */

import type { AgentAction } from '@agent-orchestrator/shared';
import { create } from 'zustand';
import type { ActionPillState, PillAnimationState } from './types';

const initialAnimationState: PillAnimationState = {
  isSquare: false,
  showContent: false,
  isContentVisible: false,
  isTextVisible: true,
};

/**
 * Helper to get sorted actions array
 */
function getSortedActions(actions: AgentAction[]): AgentAction[] {
  return [...actions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Helper to compute the highlighted agent ID from current state.
 * Uses selectedAgentId if that agent has actions, otherwise falls back to first action's agent.
 */
function computeHighlightedAgentId(
  isExpanded: boolean,
  actions: AgentAction[],
  selectedAgentId: string | null
): string | null {
  if (!isExpanded || actions.length === 0) {
    return null;
  }

  // If selected agent has actions, use it
  if (selectedAgentId && actions.some((a) => a.agentId === selectedAgentId)) {
    return selectedAgentId;
  }

  // Fall back to first action's agent
  const sorted = getSortedActions(actions);
  return sorted[0]?.agentId ?? null;
}

/**
 * Helper to get the index of the selected agent in sorted actions.
 * Returns 0 if agent not found (falls back to first action).
 */
function getSelectedActionIndex(actions: AgentAction[], selectedAgentId: string | null): number {
  if (!selectedAgentId || actions.length === 0) {
    return 0;
  }
  const sorted = getSortedActions(actions);
  const index = sorted.findIndex((a) => a.agentId === selectedAgentId);
  return index >= 0 ? index : 0;
}

export const useActionPillStore = create<ActionPillState>((set, get) => ({
  // Initial state
  actions: [],
  isExpanded: false,
  hasNewActions: false,
  animationState: initialAnimationState,
  selectedAgentId: null,
  actionAnswers: {},
  submittingActions: new Set(),
  dismissingActions: new Set(),
  highlightedAgentId: null,

  // Core actions
  addAction: (action: AgentAction) => {
    set((state) => {
      // Don't add duplicates
      if (state.actions.some((a) => a.id === action.id)) {
        return state;
      }
      const newActions = [...state.actions, action];
      return {
        actions: newActions,
        hasNewActions: true,
        highlightedAgentId: computeHighlightedAgentId(
          state.isExpanded,
          newActions,
          state.selectedAgentId
        ),
      };
    });
  },

  removeAction: (actionId: string) => {
    set((state) => {
      const newActions = state.actions.filter((a) => a.id !== actionId);

      // If no actions left, collapse the pill but keep selectedAgentId
      if (newActions.length === 0) {
        return {
          actions: newActions,
          isExpanded: false,
          hasNewActions: false,
          animationState: initialAnimationState,
          // selectedAgentId is preserved - selection is independent
          highlightedAgentId: null,
        };
      }

      return {
        actions: newActions,
        highlightedAgentId: computeHighlightedAgentId(
          state.isExpanded,
          newActions,
          state.selectedAgentId
        ),
      };
    });
  },

  clearAgent: (agentId: string) => {
    set((state) => {
      const newActions = state.actions.filter((a) => a.agentId !== agentId);

      if (newActions.length === 0) {
        return {
          actions: newActions,
          isExpanded: false,
          hasNewActions: false,
          animationState: initialAnimationState,
          // selectedAgentId is preserved - selection is independent
          highlightedAgentId: null,
        };
      }

      return {
        actions: newActions,
        highlightedAgentId: computeHighlightedAgentId(
          state.isExpanded,
          newActions,
          state.selectedAgentId
        ),
      };
    });
  },

  // UI actions
  expand: () => {
    const state = get();
    if (state.actions.length === 0 || state.isExpanded) {
      return;
    }

    // Use selectedAgentId if that agent has actions, otherwise use first action's agent
    const effectiveAgentId = computeHighlightedAgentId(true, state.actions, state.selectedAgentId);

    console.log('[ActionPillStore] Expanded pill, highlighted agent:', {
      selectedAgentId: state.selectedAgentId,
      effectiveAgentId,
      totalActions: state.actions.length,
    });

    // Start expansion animation sequence
    set({
      isExpanded: true,
      hasNewActions: false,
      animationState: {
        isSquare: true,
        showContent: false,
        isContentVisible: false,
        isTextVisible: false,
      },
      highlightedAgentId: effectiveAgentId,
    });

    // Show content container after shape transition
    setTimeout(() => {
      set((s) => ({
        animationState: {
          ...s.animationState,
          showContent: true,
        },
      }));

      // Fade in content
      setTimeout(() => {
        set((s) => ({
          animationState: {
            ...s.animationState,
            isContentVisible: true,
          },
        }));
      }, 100);
    }, 350);
  },

  collapse: () => {
    const state = get();
    if (!state.isExpanded) {
      return;
    }

    console.log('[ActionPillStore] Collapsed pill, selection preserved:', {
      selectedAgentId: state.selectedAgentId,
    });

    // Start collapse animation sequence
    // Note: selectedAgentId is preserved - selection persists when collapsed
    set((s) => ({
      animationState: {
        ...s.animationState,
        isContentVisible: false,
        showContent: false,
      },
    }));

    setTimeout(() => {
      set({
        isExpanded: false,
        // selectedAgentId is NOT reset - selection persists independently
        animationState: {
          isSquare: false,
          showContent: false,
          isContentVisible: false,
          isTextVisible: false,
        },
        highlightedAgentId: null,
      });

      // Fade in collapsed text
      setTimeout(() => {
        set((s) => ({
          animationState: {
            ...s.animationState,
            isTextVisible: true,
          },
        }));
      }, 350);
    }, 50);
  },

  markActionsViewed: () => {
    set({ hasNewActions: false });
  },

  // Selection actions
  selectAgent: (agentId: string) => {
    const state = get();

    console.log('[ActionPillStore] Selected agent:', {
      agentId,
      isExpanded: state.isExpanded,
      hasActionsForAgent: state.actions.some((a) => a.agentId === agentId),
    });

    // Set selection - this works for ANY agent, not just those with actions
    // highlightedAgentId only updates if pill is expanded AND agent has actions
    const newHighlightedId = state.isExpanded
      ? computeHighlightedAgentId(true, state.actions, agentId)
      : state.highlightedAgentId;

    set({
      selectedAgentId: agentId,
      highlightedAgentId: newHighlightedId,
    });
    return true;
  },

  clearSelection: () => {
    const state = get();
    const sortedActions = getSortedActions(state.actions);
    const firstAgentId = sortedActions[0]?.agentId ?? null;

    console.log('[ActionPillStore] Cleared selection:', {
      previousAgentId: state.selectedAgentId,
      isExpanded: state.isExpanded,
    });

    // Reset to null, do NOT collapse
    set({
      selectedAgentId: null,
      highlightedAgentId: state.isExpanded ? firstAgentId : state.highlightedAgentId,
    });
  },

  cycleSelectedAgent: (direction: 'next' | 'prev') => {
    set((state) => {
      if (!state.isExpanded || state.actions.length === 0) {
        return state;
      }

      const sortedActions = getSortedActions(state.actions);
      const count = sortedActions.length;

      // Find current index based on selectedAgentId
      const currentIndex = getSelectedActionIndex(state.actions, state.selectedAgentId);

      let newIndex: number;
      if (direction === 'next') {
        // Wrap around: last -> first
        newIndex = (currentIndex + 1) % count;
      } else {
        // Wrap around: first -> last
        newIndex = (currentIndex - 1 + count) % count;
      }

      const newAgentId = sortedActions[newIndex]?.agentId ?? null;
      console.log('[ActionPillStore] Cycled selection:', {
        direction,
        agentId: newAgentId,
        previousAgentId: state.selectedAgentId,
        index: newIndex,
        totalActions: count,
      });

      return {
        selectedAgentId: newAgentId,
        highlightedAgentId: newAgentId,
      };
    });
  },

  // Form actions
  updateActionAnswer: (actionId: string, question: string, value: string) => {
    set((state) => ({
      actionAnswers: {
        ...state.actionAnswers,
        [actionId]: {
          ...(state.actionAnswers[actionId] || {}),
          [question]: value,
        },
      },
    }));
  },

  clearActionAnswers: (actionId: string) => {
    set((state) => {
      if (!state.actionAnswers[actionId]) {
        return state;
      }
      const newAnswers = { ...state.actionAnswers };
      delete newAnswers[actionId];
      return { actionAnswers: newAnswers };
    });
  },

  setSubmitting: (actionId: string, isSubmitting: boolean) => {
    set((state) => {
      const newSet = new Set(state.submittingActions);
      if (isSubmitting) {
        newSet.add(actionId);
      } else {
        newSet.delete(actionId);
      }
      return { submittingActions: newSet };
    });
  },

  markDismissing: (actionId: string) => {
    set((state) => {
      // Idempotent: check if already dismissing
      if (state.dismissingActions.has(actionId)) {
        return state;
      }
      const newSet = new Set(state.dismissingActions);
      newSet.add(actionId);
      return { dismissingActions: newSet };
    });
  },

  completeDismissal: (actionId: string) => {
    set((state) => {
      // Remove from dismissing set
      const newDismissing = new Set(state.dismissingActions);
      newDismissing.delete(actionId);

      // Remove the action
      const newActions = state.actions.filter((a) => a.id !== actionId);

      // Handle cleanup if no actions left
      if (newActions.length === 0) {
        return {
          actions: newActions,
          dismissingActions: newDismissing,
          isExpanded: false,
          hasNewActions: false,
          animationState: initialAnimationState,
          // selectedAgentId is preserved - selection is independent
          highlightedAgentId: null,
        };
      }

      return {
        actions: newActions,
        dismissingActions: newDismissing,
        highlightedAgentId: computeHighlightedAgentId(
          state.isExpanded,
          newActions,
          state.selectedAgentId
        ),
      };
    });
  },
}));

/**
 * Selectors for common derived values
 */
export const selectSortedActions = (state: ActionPillState): AgentAction[] => {
  return [...state.actions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

export const selectHasActions = (state: ActionPillState): boolean => {
  return state.actions.length > 0;
};

export const selectActionCount = (state: ActionPillState): number => {
  return state.actions.length;
};

export const selectTopmostAction = (state: ActionPillState): AgentAction | null => {
  if (state.actions.length === 0) return null;
  const sorted = selectSortedActions(state);
  return sorted[0] ?? null;
};

/**
 * Get the selected action based on selectedAgentId.
 * If the selected agent has actions, returns that agent's first action.
 * Otherwise falls back to the first action overall.
 */
export const selectSelectedAction = (state: ActionPillState): AgentAction | null => {
  if (state.actions.length === 0) return null;

  const sorted = selectSortedActions(state);

  // If selected agent has actions, return their first action
  if (state.selectedAgentId) {
    const agentAction = sorted.find((a) => a.agentId === state.selectedAgentId);
    if (agentAction) {
      return agentAction;
    }
  }

  // Fall back to first action
  return sorted[0] ?? null;
};

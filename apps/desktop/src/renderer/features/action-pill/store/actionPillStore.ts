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
 * Helper to compute the highlighted agent ID from current state
 */
function computeHighlightedAgentId(
  isExpanded: boolean,
  actions: AgentAction[],
  activeIndex: number
): string | null {
  if (!isExpanded || actions.length === 0) {
    return null;
  }
  const sorted = getSortedActions(actions);
  const clampedIndex = Math.min(activeIndex, sorted.length - 1);
  return sorted[clampedIndex]?.agentId ?? null;
}

export const useActionPillStore = create<ActionPillState>((set, get) => ({
  // Initial state
  actions: [],
  isExpanded: false,
  hasNewActions: false,
  animationState: initialAnimationState,
  activeActionIndex: 0,
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
          state.activeActionIndex
        ),
      };
    });
  },

  removeAction: (actionId: string) => {
    set((state) => {
      const newActions = state.actions.filter((a) => a.id !== actionId);

      // If no actions left, collapse the pill
      if (newActions.length === 0) {
        return {
          actions: newActions,
          isExpanded: false,
          hasNewActions: false,
          animationState: initialAnimationState,
          activeActionIndex: 0,
          highlightedAgentId: null,
        };
      }

      // Clamp activeActionIndex to valid range
      const newActiveIndex = Math.min(state.activeActionIndex, newActions.length - 1);

      return {
        actions: newActions,
        activeActionIndex: newActiveIndex,
        highlightedAgentId: computeHighlightedAgentId(state.isExpanded, newActions, newActiveIndex),
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
          activeActionIndex: 0,
          highlightedAgentId: null,
        };
      }

      // Clamp activeActionIndex to valid range
      const newActiveIndex = Math.min(state.activeActionIndex, newActions.length - 1);

      return {
        actions: newActions,
        activeActionIndex: newActiveIndex,
        highlightedAgentId: computeHighlightedAgentId(state.isExpanded, newActions, newActiveIndex),
      };
    });
  },

  // UI actions
  expand: () => {
    const state = get();
    if (state.actions.length === 0 || state.isExpanded) {
      return;
    }

    // Reset to first action when expanding
    const newActiveIndex = 0;

    // Start expansion animation sequence
    set({
      isExpanded: true,
      hasNewActions: false,
      activeActionIndex: newActiveIndex,
      animationState: {
        isSquare: true,
        showContent: false,
        isContentVisible: false,
        isTextVisible: false,
      },
      highlightedAgentId: computeHighlightedAgentId(true, state.actions, newActiveIndex),
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

    // Start collapse animation sequence
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
        activeActionIndex: 0,
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

  // Cycling actions
  cycleActiveAgent: (direction: 'next' | 'prev') => {
    set((state) => {
      if (!state.isExpanded || state.actions.length === 0) {
        return state;
      }

      const sortedActions = getSortedActions(state.actions);
      const count = sortedActions.length;

      let newIndex: number;
      if (direction === 'next') {
        // Wrap around: last -> first
        newIndex = (state.activeActionIndex + 1) % count;
      } else {
        // Wrap around: first -> last
        newIndex = (state.activeActionIndex - 1 + count) % count;
      }

      return {
        activeActionIndex: newIndex,
        highlightedAgentId: computeHighlightedAgentId(true, state.actions, newIndex),
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
          activeActionIndex: 0,
          highlightedAgentId: null,
        };
      }

      // Clamp activeActionIndex
      const newActiveIndex = Math.min(state.activeActionIndex, newActions.length - 1);

      return {
        actions: newActions,
        dismissingActions: newDismissing,
        activeActionIndex: newActiveIndex,
        highlightedAgentId: computeHighlightedAgentId(state.isExpanded, newActions, newActiveIndex),
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

export const selectActiveAction = (state: ActionPillState): AgentAction | null => {
  if (state.actions.length === 0) return null;
  const sorted = selectSortedActions(state);
  const clampedIndex = Math.min(state.activeActionIndex, sorted.length - 1);
  return sorted[clampedIndex] ?? null;
};

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
 * Helper to compute the highlighted agent ID from current state
 */
function computeHighlightedAgentId(
  isExpanded: boolean,
  actions: AgentAction[]
): string | null {
  if (!isExpanded || actions.length === 0) {
    return null;
  }
  // Sort by createdAt and get the topmost (earliest) action's agentId
  const sorted = [...actions].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );
  return sorted[0]?.agentId ?? null;
}

export const useActionPillStore = create<ActionPillState>((set, get) => ({
  // Initial state
  actions: [],
  isExpanded: false,
  hasNewActions: false,
  animationState: initialAnimationState,
  actionAnswers: {},
  submittingActions: new Set(),
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
        highlightedAgentId: computeHighlightedAgentId(state.isExpanded, newActions),
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
          highlightedAgentId: null,
        };
      }

      return {
        actions: newActions,
        highlightedAgentId: computeHighlightedAgentId(state.isExpanded, newActions),
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
          highlightedAgentId: null,
        };
      }

      return {
        actions: newActions,
        highlightedAgentId: computeHighlightedAgentId(state.isExpanded, newActions),
      };
    });
  },

  // UI actions
  expand: () => {
    const state = get();
    if (state.actions.length === 0 || state.isExpanded) {
      return;
    }

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
      highlightedAgentId: computeHighlightedAgentId(true, state.actions),
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

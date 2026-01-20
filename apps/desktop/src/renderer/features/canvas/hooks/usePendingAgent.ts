import { create } from 'zustand';
import type { LinearIssue } from './useCanvasDrop';

/**
 * Pending Agent Store
 *
 * Manages pending agent creation state:
 * - Position where a new agent should be created
 * - Linear issue to attach to the new agent
 * - Whether to auto-create a worktree
 *
 * This state is used when the new agent modal is opened
 * from various sources (context menu, drag & drop, keyboard shortcut).
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Position for a pending agent
 */
export interface PendingAgentPosition {
  x: number;
  y: number;
}

interface PendingAgentState {
  /** Position where the new agent should be created */
  pendingPosition: PendingAgentPosition | undefined;
  /** Linear issue to attach to the new agent */
  pendingLinearIssue: LinearIssue | undefined;
  /** Whether to auto-create a worktree for the new agent */
  autoCreateWorktree: boolean;
}

interface PendingAgentActions {
  /** Set pending agent data */
  setPending: (
    position: PendingAgentPosition | undefined,
    linearIssue?: LinearIssue,
    createWorktree?: boolean
  ) => void;
  /** Clear all pending data */
  clearPending: () => void;
  /** Set the auto-create worktree flag */
  setAutoCreateWorktree: (value: boolean) => void;
}

export type PendingAgentStore = PendingAgentState & PendingAgentActions;

/**
 * Return type for the usePendingAgent hook (backwards compatibility)
 */
export type UsePendingAgentReturn = PendingAgentStore;

// =============================================================================
// Store
// =============================================================================

export const usePendingAgent = create<PendingAgentStore>((set) => ({
  // Initial state
  pendingPosition: undefined,
  pendingLinearIssue: undefined,
  autoCreateWorktree: false,

  // Actions
  setPending: (position, linearIssue, createWorktree) =>
    set((state) => ({
      pendingPosition: position,
      pendingLinearIssue: linearIssue,
      autoCreateWorktree: createWorktree !== undefined ? createWorktree : state.autoCreateWorktree,
    })),

  clearPending: () =>
    set({
      pendingPosition: undefined,
      pendingLinearIssue: undefined,
      autoCreateWorktree: false,
    }),

  setAutoCreateWorktree: (value) => set({ autoCreateWorktree: value }),
}));

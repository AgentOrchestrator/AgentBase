import { useCallback, useState } from 'react';
import type { LinearIssue } from './useCanvasDrop';

/**
 * Position for a pending agent
 */
export interface PendingAgentPosition {
  x: number;
  y: number;
}

/**
 * Return type for the usePendingAgent hook
 */
export interface UsePendingAgentReturn {
  /** Position where the new agent should be created */
  pendingPosition: PendingAgentPosition | undefined;
  /** Linear issue to attach to the new agent */
  pendingLinearIssue: LinearIssue | undefined;
  /** Whether to auto-create a worktree for the new agent */
  autoCreateWorktree: boolean;
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

/**
 * Hook for managing pending agent creation state
 *
 * Manages:
 * - Position where a new agent should be created
 * - Linear issue to attach to the new agent
 * - Whether to auto-create a worktree
 *
 * This state is used when the new agent modal is opened
 * from various sources (context menu, drag & drop, keyboard shortcut).
 */
export function usePendingAgent(): UsePendingAgentReturn {
  const [pendingPosition, setPendingPosition] = useState<PendingAgentPosition | undefined>(
    undefined
  );
  const [pendingLinearIssue, setPendingLinearIssue] = useState<LinearIssue | undefined>(undefined);
  const [autoCreateWorktree, setAutoCreateWorktreeState] = useState(false);

  const setPending = useCallback(
    (
      position: PendingAgentPosition | undefined,
      linearIssue?: LinearIssue,
      createWorktree?: boolean
    ) => {
      setPendingPosition(position);
      setPendingLinearIssue(linearIssue);
      if (createWorktree !== undefined) {
        setAutoCreateWorktreeState(createWorktree);
      }
    },
    []
  );

  const clearPending = useCallback(() => {
    setPendingPosition(undefined);
    setPendingLinearIssue(undefined);
    setAutoCreateWorktreeState(false);
  }, []);

  const setAutoCreateWorktree = useCallback((value: boolean) => {
    setAutoCreateWorktreeState(value);
  }, []);

  return {
    pendingPosition,
    pendingLinearIssue,
    autoCreateWorktree,
    setPending,
    clearPending,
    setAutoCreateWorktree,
  };
}

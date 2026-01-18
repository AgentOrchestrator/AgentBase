/**
 * Fork Store Interface
 *
 * Observable store for managing fork operations.
 * The view delegates all fork business logic here.
 */

/**
 * Fork drag state during connection drag
 */
export interface ForkDragState {
  /** Whether a fork drag is currently in progress */
  isDragging: boolean;
  /** The source node ID being forked */
  sourceNodeId: string | null;
  /** The handle type that initiated the drag */
  sourceHandleType: 'source' | 'target' | null;
}

/**
 * Fork operation result
 */
export interface ForkResult {
  /** Whether the fork was successful */
  success: boolean;
  /** The newly created node ID */
  newNodeId?: string;
  /** The edge ID connecting parent to fork */
  edgeId?: string;
  /** Path to the new worktree (if created) */
  worktreePath?: string;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Callback for fork state changes
 */
export type ForkStateListener = (state: ForkDragState) => void;

/**
 * Interface for fork operations store
 */
export interface IForkStore {
  /**
   * Get current fork drag state
   */
  getState(): ForkDragState;

  /**
   * Start a fork drag operation
   * @param sourceNodeId - The node ID being forked
   * @param handleType - The handle type that initiated the drag
   */
  startDrag(sourceNodeId: string, handleType: 'source' | 'target'): void;

  /**
   * Cancel the current fork drag
   */
  cancelDrag(): void;

  /**
   * Subscribe to fork state changes
   * @param listener - Callback invoked when state changes
   * @returns Unsubscribe function
   */
  subscribe(listener: ForkStateListener): () => void;
}

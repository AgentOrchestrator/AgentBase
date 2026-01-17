/**
 * Fork Store Implementation
 *
 * Manages fork drag state using observer pattern.
 * View components subscribe to state changes.
 */

import type { ForkDragState, ForkStateListener, IForkStore } from './IForkStore';

/**
 * Default initial state
 */
const initialState: ForkDragState = {
  isDragging: false,
  sourceNodeId: null,
  sourceHandleType: null,
};

/**
 * Fork store implementation with observer pattern
 */
export class ForkStore implements IForkStore {
  private state: ForkDragState = { ...initialState };
  private listeners: Set<ForkStateListener> = new Set();

  /**
   * Get current fork drag state
   */
  getState(): ForkDragState {
    return { ...this.state };
  }

  /**
   * Start a fork drag operation
   */
  startDrag(sourceNodeId: string, handleType: 'source' | 'target'): void {
    this.state = {
      isDragging: true,
      sourceNodeId,
      sourceHandleType: handleType,
    };
    this.notifyListeners();
  }

  /**
   * Cancel the current fork drag
   */
  cancelDrag(): void {
    this.state = { ...initialState };
    this.notifyListeners();
  }

  /**
   * Subscribe to fork state changes
   */
  subscribe(listener: ForkStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const currentState = this.getState();
    this.listeners.forEach((listener) => {
      listener(currentState);
    });
  }
}

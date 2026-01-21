import { create } from 'zustand';

/**
 * Keyboard Modifiers Store
 *
 * Tracks keyboard modifier states for canvas interactions:
 * - Cmd/Ctrl key for enabling node dragging
 * - Shift key for snap-to-edge behavior
 *
 * Note: This store does not add its own event listeners.
 * The component should call enableNodeDrag/disableNodeDrag/setShiftPressed
 * from its existing keyboard event handlers to avoid duplicate listeners.
 */

// =============================================================================
// Types
// =============================================================================

interface KeyboardModifiersState {
  /** Whether node drag is enabled (Cmd/Ctrl held) */
  isNodeDragEnabled: boolean;
  /** Whether shift key is pressed (for snap-to-edge) */
  isShiftPressed: boolean;
}

interface KeyboardModifiersActions {
  /** Enable node drag */
  enableNodeDrag: () => void;
  /** Disable node drag */
  disableNodeDrag: () => void;
  /** Set shift pressed state */
  setShiftPressed: (pressed: boolean) => void;
}

export type KeyboardModifiersStore = KeyboardModifiersState & KeyboardModifiersActions;

/**
 * Return type for the useKeyboardModifiers hook (backwards compatibility)
 */
export type UseKeyboardModifiersReturn = KeyboardModifiersStore;

// =============================================================================
// Store
// =============================================================================

export const useKeyboardModifiers = create<KeyboardModifiersStore>((set) => ({
  // Initial state
  isNodeDragEnabled: false,
  isShiftPressed: false,

  // Actions
  enableNodeDrag: () => set({ isNodeDragEnabled: true }),
  disableNodeDrag: () => set({ isNodeDragEnabled: false }),
  setShiftPressed: (pressed) => set({ isShiftPressed: pressed }),
}));

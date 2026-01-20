import { useCallback, useState } from 'react';

/**
 * Return type for the useKeyboardModifiers hook
 */
export interface UseKeyboardModifiersReturn {
  /** Whether node drag is enabled (Cmd/Ctrl held) */
  isNodeDragEnabled: boolean;
  /** Whether shift key is pressed (for snap-to-edge) */
  isShiftPressed: boolean;
  /** Enable node drag */
  enableNodeDrag: () => void;
  /** Disable node drag */
  disableNodeDrag: () => void;
  /** Set shift pressed state */
  setShiftPressed: (pressed: boolean) => void;
}

/**
 * Hook for tracking keyboard modifier states for canvas interactions
 *
 * Provides state and methods for:
 * - Cmd/Ctrl key for enabling node dragging
 * - Shift key for snap-to-edge behavior
 *
 * Note: This hook does not add its own event listeners.
 * The component should call enableNodeDrag/disableNodeDrag/setShiftPressed
 * from its existing keyboard event handlers to avoid duplicate listeners.
 */
export function useKeyboardModifiers(): UseKeyboardModifiersReturn {
  const [isNodeDragEnabled, setIsNodeDragEnabled] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);

  const enableNodeDrag = useCallback(() => {
    setIsNodeDragEnabled(true);
  }, []);

  const disableNodeDrag = useCallback(() => {
    setIsNodeDragEnabled(false);
  }, []);

  const setShiftPressed = useCallback((pressed: boolean) => {
    setIsShiftPressed(pressed);
  }, []);

  return {
    isNodeDragEnabled,
    isShiftPressed,
    enableNodeDrag,
    disableNodeDrag,
    setShiftPressed,
  };
}

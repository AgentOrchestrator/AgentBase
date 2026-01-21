import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { create } from 'zustand';
import { useSidebarState } from '../../sidebar/hooks/useSidebarState';

/**
 * Linear Panel Store
 *
 * Manages Linear panel state:
 * - Collapsed state for the Linear panel
 * - Resize dragging state
 *
 * The resize functionality uses the sidebar width from useSidebarState.
 */

// =============================================================================
// Types
// =============================================================================

interface LinearPanelState {
  /** Whether the Linear panel is collapsed */
  isCollapsed: boolean;
  /** Whether a resize is in progress */
  isResizing: boolean;
}

interface LinearPanelActions {
  /** Toggle the collapsed state */
  toggleCollapsed: () => void;
  /** Set the collapsed state */
  setCollapsed: (collapsed: boolean) => void;
  /** Set the resizing state */
  setResizing: (resizing: boolean) => void;
}

export type LinearPanelStore = LinearPanelState & LinearPanelActions;

// =============================================================================
// Store
// =============================================================================

export const useLinearPanelStore = create<LinearPanelStore>((set) => ({
  // Initial state
  isCollapsed: false,
  isResizing: false,

  // Actions
  toggleCollapsed: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
  setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
  setResizing: (resizing) => set({ isResizing: resizing }),
}));

// =============================================================================
// Wrapper Hook (with resize handling)
// =============================================================================

/**
 * Return type for the useLinearPanel hook
 */
export interface UseLinearPanelReturn {
  /** Whether the Linear panel is collapsed */
  isCollapsed: boolean;
  /** Toggle the collapsed state */
  toggleCollapsed: () => void;
  /** Set the collapsed state */
  setCollapsed: (collapsed: boolean) => void;
  /** Whether a resize is in progress */
  isResizing: boolean;
  /** Handler to start resizing (attach to resize handle mousedown) */
  handleResizeStart: (e: React.MouseEvent) => void;
}

/**
 * Input for the useLinearPanel hook (backwards compatibility)
 */
export interface UseLinearPanelInput {
  /** Current sidebar width (from useSidebarState) */
  sidebarWidth: number;
  /** Function to set sidebar width (from useSidebarState) */
  setSidebarWidth: (width: number) => void;
}

/**
 * Hook for managing Linear panel collapse and resize state
 *
 * Can be called with or without parameters:
 * - Without parameters: uses useSidebarState internally
 * - With parameters: uses provided sidebarWidth/setSidebarWidth (backwards compatibility)
 */
export function useLinearPanel(input?: UseLinearPanelInput): UseLinearPanelReturn {
  // Get sidebar state - either from input or from store
  const sidebarStore = useSidebarState();
  const sidebarWidth = input?.sidebarWidth ?? sidebarStore.sidebarWidth;
  const setSidebarWidth = input?.setSidebarWidth ?? sidebarStore.setSidebarWidth;

  // Get panel state from store
  const { isCollapsed, isResizing, toggleCollapsed, setCollapsed, setResizing } =
    useLinearPanelStore();

  // Refs for resize handling
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(0);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setResizing(true);
      resizeStartXRef.current = e.clientX;
      resizeStartWidthRef.current = sidebarWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [sidebarWidth, setResizing]
  );

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;
      const deltaX = e.clientX - resizeStartXRef.current;
      const newWidth = resizeStartWidthRef.current + deltaX;
      setSidebarWidth(newWidth);
    },
    [isResizing, setSidebarWidth]
  );

  const handleResizeEnd = useCallback(() => {
    setResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [setResizing]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  return {
    isCollapsed,
    toggleCollapsed,
    setCollapsed,
    isResizing,
    handleResizeStart,
  };
}

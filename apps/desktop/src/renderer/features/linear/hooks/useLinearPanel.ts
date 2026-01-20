import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

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
 * Input for the useLinearPanel hook
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
 * Manages:
 * - Collapsed state for the Linear panel
 * - Resize dragging for the sidebar
 *
 * The resize functionality updates the sidebar width via the provided
 * setSidebarWidth function from useSidebarState.
 */
export function useLinearPanel(input: UseLinearPanelInput): UseLinearPanelReturn {
  const { sidebarWidth, setSidebarWidth } = input;

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(0);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
  }, []);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      resizeStartXRef.current = e.clientX;
      resizeStartWidthRef.current = sidebarWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [sidebarWidth]
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
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

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

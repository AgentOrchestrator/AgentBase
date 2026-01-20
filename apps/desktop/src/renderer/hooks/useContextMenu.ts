import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Context menu position state
 */
export type ContextMenuPosition = {
  x: number;
  y: number;
} | null;

/**
 * Return type for the useContextMenu hook
 */
export interface UseContextMenuReturn {
  /** Current context menu position, or null if closed */
  contextMenu: ContextMenuPosition;
  /** Ref to attach to the context menu element for click-outside detection */
  contextMenuRef: React.RefObject<HTMLDivElement | null>;
  /** Handler for pane context menu event (right-click) */
  onPaneContextMenu: (event: React.MouseEvent | MouseEvent) => void;
  /** Handler for pane click event (closes context menu) */
  onPaneClick: () => void;
  /** Close the context menu */
  closeContextMenu: () => void;
}

/**
 * Hook for managing context menu state
 *
 * Manages:
 * - Context menu position (or null if closed)
 * - Click-outside detection to close menu
 * - Event handlers for opening/closing
 */
export function useContextMenu(): UseContextMenuReturn {
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as HTMLElement)) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [contextMenu]);

  return {
    contextMenu,
    contextMenuRef,
    onPaneContextMenu,
    onPaneClick,
    closeContextMenu,
  };
}

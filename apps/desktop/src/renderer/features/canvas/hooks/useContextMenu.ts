import type React from 'react';
import { useEffect, useRef } from 'react';
import { create } from 'zustand';

/**
 * Context Menu Store
 *
 * Manages context menu state:
 * - Context menu position (or null if closed)
 *
 * Note: Click-outside detection is handled by the useContextMenu wrapper hook,
 * not in the store itself, since it requires a DOM ref.
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Context menu position state
 */
export type ContextMenuPosition = {
  x: number;
  y: number;
} | null;

interface ContextMenuState {
  /** Current context menu position, or null if closed */
  contextMenu: ContextMenuPosition;
}

interface ContextMenuActions {
  /** Open context menu at position */
  openContextMenu: (x: number, y: number) => void;
  /** Close the context menu */
  closeContextMenu: () => void;
}

export type ContextMenuStore = ContextMenuState & ContextMenuActions;

// =============================================================================
// Store
// =============================================================================

export const useContextMenuStore = create<ContextMenuStore>((set) => ({
  // Initial state
  contextMenu: null,

  // Actions
  openContextMenu: (x, y) => set({ contextMenu: { x, y } }),
  closeContextMenu: () => set({ contextMenu: null }),
}));

// =============================================================================
// Wrapper Hook (with click-outside detection)
// =============================================================================

/**
 * Return type for the useContextMenu hook
 */
export interface UseContextMenuReturn {
  /** Current context menu position, or null if closed */
  contextMenu: ContextMenuPosition;
  /** Ref to attach to the context menu element for click-outside detection */
  contextMenuRef: React.RefObject<HTMLDivElement>;
  /** Handler for pane context menu event (right-click) */
  onPaneContextMenu: (event: React.MouseEvent | MouseEvent) => void;
  /** Handler for pane click event (closes context menu) */
  onPaneClick: () => void;
  /** Close the context menu */
  closeContextMenu: () => void;
}

/**
 * Hook for managing context menu state with click-outside detection
 *
 * This wraps the Zustand store and adds:
 * - A ref for the context menu element
 * - Click-outside detection effect
 * - Event handlers for opening/closing
 */
export function useContextMenu(): UseContextMenuReturn {
  const { contextMenu, openContextMenu, closeContextMenu } = useContextMenuStore();
  const contextMenuRef = useRef<HTMLDivElement>(null!);

  const onPaneContextMenu = (event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    openContextMenu(event.clientX, event.clientY);
  };

  const onPaneClick = () => {
    closeContextMenu();
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as HTMLElement)) {
        closeContextMenu();
      }
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [contextMenu, closeContextMenu]);

  return {
    contextMenu,
    contextMenuRef,
    onPaneContextMenu,
    onPaneClick,
    closeContextMenu,
  };
}

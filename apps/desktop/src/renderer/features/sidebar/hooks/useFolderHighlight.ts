import type { Node } from '@xyflow/react';
import { create } from 'zustand';

/**
 * Folder Highlight Store
 *
 * Manages folder highlight state in the canvas:
 * - Assigns unique colors to each folder when highlighting is enabled
 * - Provides color lookup for sidebar and node styling
 * - Shuffles colors randomly for visual variety
 */

// =============================================================================
// Constants
// =============================================================================

const HIGHLIGHT_COLORS = ['#F24F1F', '#FF7362', '#A259FF', '#1ABCFE', '#0ECF84', '#F5C348'];

// =============================================================================
// Types
// =============================================================================

interface FolderHighlightState {
  /** Whether highlight-all mode is active */
  isHighlightAllActive: boolean;
  /** Map of folder paths to their assigned colors */
  folderColors: Map<string, string>;
  /** Set of currently highlighted folder paths */
  highlightedFolders: Set<string>;
}

interface FolderHighlightActions {
  /** Toggle highlight-all mode on/off */
  toggleHighlightAll: (folderPathMap: Record<string, string>) => void;
  /** Get the highlight color for a specific folder path. Caller must filter null/undefined. */
  getHighlightColor: (folderPath: string) => string | undefined;
}

export type FolderHighlightStore = FolderHighlightState & FolderHighlightActions;

/**
 * Return type for the useFolderHighlight wrapper hook (backwards compatibility)
 * Note: toggleHighlightAll has no parameters in the wrapper since folderPathMap is bound
 */
export interface UseFolderHighlightReturn {
  isHighlightAllActive: boolean;
  folderColors: Map<string, string>;
  highlightedFolders: Set<string>;
  toggleHighlightAll: () => void;
  /** Get the highlight color for a specific folder path. Caller must filter null/undefined. */
  getHighlightColor: (folderPath: string) => string | undefined;
}

// =============================================================================
// Store
// =============================================================================

export const useFolderHighlightStore = create<FolderHighlightStore>((set, get) => ({
  // Initial state
  isHighlightAllActive: false,
  folderColors: new Map<string, string>(),
  highlightedFolders: new Set<string>(),

  // Actions
  toggleHighlightAll: (folderPathMap) => {
    const { isHighlightAllActive } = get();

    if (isHighlightAllActive) {
      // Turn off: clear all highlights
      set({
        isHighlightAllActive: false,
        highlightedFolders: new Set<string>(),
        folderColors: new Map<string, string>(),
      });
    } else {
      // Turn on: highlight all folders with unique colors
      const allFolderPaths = Object.values(folderPathMap).filter(Boolean) as string[];
      const newHighlightedFolders = new Set<string>(allFolderPaths);
      const newFolderColors = new Map<string, string>();

      // Shuffle colors for visual variety
      const shuffledColors = [...HIGHLIGHT_COLORS].sort(() => Math.random() - 0.5);
      allFolderPaths.forEach((folderPath, index) => {
        newFolderColors.set(folderPath, shuffledColors[index % HIGHLIGHT_COLORS.length]);
      });

      set({
        isHighlightAllActive: true,
        highlightedFolders: newHighlightedFolders,
        folderColors: newFolderColors,
      });
    }
  },

  getHighlightColor: (folderPath) => get().folderColors.get(folderPath),
}));

// =============================================================================
// Wrapper Hook (for backwards compatibility with parameter)
// =============================================================================

/**
 * Hook for managing folder highlight state in the canvas
 *
 * @param folderPathMap - Map of folder names to their paths
 * @deprecated Use useFolderHighlightStore directly and pass folderPathMap to toggleHighlightAll
 */
export function useFolderHighlight(
  folderPathMap: Record<string, string>
): UseFolderHighlightReturn {
  const store = useFolderHighlightStore();

  // Return store with bound toggleHighlightAll
  return {
    ...store,
    toggleHighlightAll: () => store.toggleHighlightAll(folderPathMap),
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Utility function to apply highlight styles to nodes
 * Called from Canvas.tsx useEffect
 *
 * IMPORTANT: Only returns new node objects when styles actually change
 * to prevent infinite render loops from reference changes.
 */
export function applyHighlightStylesToNodes(
  nodes: Node[],
  highlightedFolders: Set<string>,
  folderColors: Map<string, string>
): Node[] {
  let hasChanges = false;

  const newNodes = nodes.map((node) => {
    if (node.type !== 'agent') return node;

    const agentData = node.data as { workspacePath?: string };
    const projectPath = agentData.workspacePath || null;
    const isHighlighted = projectPath && highlightedFolders.has(projectPath);
    const highlightColor = projectPath ? folderColors.get(projectPath) : null;

    const currentStyle = (node.style || {}) as Record<string, unknown>;
    const currentBoxShadow = currentStyle.boxShadow as string | undefined;
    const currentBorderRadius = currentStyle.borderRadius as string | undefined;

    if (isHighlighted && highlightColor) {
      const expectedBoxShadow = `0 0 0 3px ${highlightColor}`;
      const expectedBorderRadius = '12px';

      // Check if style already matches - if so, return same node
      if (currentBoxShadow === expectedBoxShadow && currentBorderRadius === expectedBorderRadius) {
        return node;
      }

      hasChanges = true;
      return {
        ...node,
        style: {
          ...currentStyle,
          boxShadow: expectedBoxShadow,
          borderRadius: expectedBorderRadius,
        },
      };
    } else {
      // Check if there are highlight styles to remove
      if (currentBoxShadow === undefined && currentBorderRadius === undefined) {
        return node; // No highlight styles present, return same node
      }

      // Only create new object if we're actually removing styles
      const { boxShadow, borderRadius, ...restStyle } = currentStyle;
      if (boxShadow !== undefined || borderRadius !== undefined) {
        hasChanges = true;
        return { ...node, style: restStyle };
      }

      return node;
    }
  });

  // Return original array if nothing changed (prevents unnecessary re-renders)
  return hasChanges ? newNodes : nodes;
}

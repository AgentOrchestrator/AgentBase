import type { Node } from '@xyflow/react';
import { useCallback, useState } from 'react';

const HIGHLIGHT_COLORS = ['#F24F1F', '#FF7362', '#A259FF', '#1ABCFE', '#0ECF84', '#F5C348'];

/**
 * Return type for the useFolderHighlight hook
 */
export interface UseFolderHighlightReturn {
  /** Whether highlight-all mode is active */
  isHighlightAllActive: boolean;
  /** Map of folder paths to their assigned colors */
  folderColors: Map<string, string>;
  /** Set of currently highlighted folder paths */
  highlightedFolders: Set<string>;
  /** Toggle highlight-all mode on/off */
  toggleHighlightAll: () => void;
  /** Get the highlight color for a specific folder path */
  getHighlightColor: (folderPath: string | null | undefined) => string | null;
}

/**
 * Hook for managing folder highlight state in the canvas
 *
 * Features:
 * - Assigns unique colors to each folder when highlighting is enabled
 * - Provides color lookup for sidebar and node styling
 * - Shuffles colors randomly for visual variety
 *
 * @param folderPathMap - Map of folder names to their paths
 */
export function useFolderHighlight(
  folderPathMap: Record<string, string>
): UseFolderHighlightReturn {
  const [isHighlightAllActive, setIsHighlightAllActive] = useState(false);
  const [highlightedFolders, setHighlightedFolders] = useState<Set<string>>(new Set());
  const [folderColors, setFolderColors] = useState<Map<string, string>>(new Map());

  const toggleHighlightAll = useCallback(() => {
    if (isHighlightAllActive) {
      // Turn off: clear all highlights
      setIsHighlightAllActive(false);
      setHighlightedFolders(new Set());
      setFolderColors(new Map());
    } else {
      // Turn on: highlight all folders with unique colors
      setIsHighlightAllActive(true);
      const allFolderPaths = Object.values(folderPathMap).filter(Boolean) as string[];
      const newHighlightedFolders = new Set<string>(allFolderPaths);
      const newFolderColors = new Map<string, string>();

      // Shuffle colors for visual variety
      const shuffledColors = [...HIGHLIGHT_COLORS].sort(() => Math.random() - 0.5);
      allFolderPaths.forEach((folderPath, index) => {
        newFolderColors.set(folderPath, shuffledColors[index % HIGHLIGHT_COLORS.length]);
      });

      setHighlightedFolders(newHighlightedFolders);
      setFolderColors(newFolderColors);
    }
  }, [isHighlightAllActive, folderPathMap]);

  const getHighlightColor = useCallback(
    (folderPath: string | null | undefined): string | null => {
      if (!folderPath) return null;
      return folderColors.get(folderPath) || null;
    },
    [folderColors]
  );

  return {
    isHighlightAllActive,
    folderColors,
    highlightedFolders,
    toggleHighlightAll,
    getHighlightColor,
  };
}

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

import { useCallback, useState } from 'react';

/**
 * Return type for the useSidebarState hook
 */
export interface UseSidebarStateReturn {
  /** Whether the sidebar is collapsed */
  isSidebarCollapsed: boolean;
  /** Set of collapsed project names */
  collapsedProjects: Set<string>;
  /** Set of collapsed branch keys (format: `${project}:${branch}`) */
  collapsedBranches: Set<string>;
  /** Sidebar width in pixels */
  sidebarWidth: number;
  /** Set the sidebar width */
  setSidebarWidth: (width: number) => void;
  /** Toggle the sidebar collapsed state */
  toggleSidebar: () => void;
  /** Toggle a project's collapsed state */
  toggleProject: (projectName: string) => void;
  /** Toggle a branch's collapsed state */
  toggleBranch: (branchKey: string) => void;
}

const DEFAULT_SIDEBAR_WIDTH = 256;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 600;

/**
 * Hook for managing sidebar collapse state
 *
 * Manages:
 * - Overall sidebar collapse
 * - Individual project collapse states
 * - Individual branch collapse states (keyed by `${project}:${branch}`)
 * - Sidebar width for resizing
 */
export function useSidebarState(): UseSidebarStateReturn {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(new Set());
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  const toggleProject = useCallback((projectName: string) => {
    setCollapsedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectName)) {
        newSet.delete(projectName);
      } else {
        newSet.add(projectName);
      }
      return newSet;
    });
  }, []);

  const toggleBranch = useCallback((branchKey: string) => {
    setCollapsedBranches((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(branchKey)) {
        newSet.delete(branchKey);
      } else {
        newSet.add(branchKey);
      }
      return newSet;
    });
  }, []);

  const handleSetSidebarWidth = useCallback((width: number) => {
    const clampedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, width));
    setSidebarWidth(clampedWidth);
  }, []);

  return {
    isSidebarCollapsed,
    collapsedProjects,
    collapsedBranches,
    sidebarWidth,
    setSidebarWidth: handleSetSidebarWidth,
    toggleSidebar,
    toggleProject,
    toggleBranch,
  };
}

export { MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH };

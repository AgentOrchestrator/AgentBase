import { useState, useCallback } from 'react';

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
  /** Toggle the sidebar collapsed state */
  toggleSidebar: () => void;
  /** Toggle a project's collapsed state */
  toggleProject: (projectName: string) => void;
  /** Toggle a branch's collapsed state */
  toggleBranch: (branchKey: string) => void;
}

/**
 * Hook for managing sidebar collapse state
 *
 * Manages:
 * - Overall sidebar collapse
 * - Individual project collapse states
 * - Individual branch collapse states (keyed by `${project}:${branch}`)
 */
export function useSidebarState(): UseSidebarStateReturn {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(new Set());

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

  return {
    isSidebarCollapsed,
    collapsedProjects,
    collapsedBranches,
    toggleSidebar,
    toggleProject,
    toggleBranch,
  };
}

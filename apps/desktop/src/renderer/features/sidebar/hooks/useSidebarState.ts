import { create } from 'zustand';

/**
 * Sidebar State Store
 *
 * Manages sidebar collapse state:
 * - Overall sidebar collapse
 * - Individual project collapse states
 * - Individual branch collapse states (keyed by `${project}:${branch}`)
 * - Sidebar width for resizing
 */

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_SIDEBAR_WIDTH = 256;
export const MIN_SIDEBAR_WIDTH = 200;
export const MAX_SIDEBAR_WIDTH = 600;

// =============================================================================
// Types
// =============================================================================

interface SidebarState {
  /** Whether the sidebar is collapsed */
  isSidebarCollapsed: boolean;
  /** Set of collapsed project names */
  collapsedProjects: Set<string>;
  /** Set of collapsed branch keys (format: `${project}:${branch}`) */
  collapsedBranches: Set<string>;
  /** Sidebar width in pixels */
  sidebarWidth: number;
}

interface SidebarActions {
  /** Set the sidebar width (clamped to min/max) */
  setSidebarWidth: (width: number) => void;
  /** Toggle the sidebar collapsed state */
  toggleSidebar: () => void;
  /** Toggle a project's collapsed state */
  toggleProject: (projectName: string) => void;
  /** Toggle a branch's collapsed state */
  toggleBranch: (branchKey: string) => void;
}

export type SidebarStore = SidebarState & SidebarActions;

/**
 * Return type for the useSidebarState hook (backwards compatibility)
 */
export type UseSidebarStateReturn = SidebarStore;

// =============================================================================
// Store
// =============================================================================

export const useSidebarState = create<SidebarStore>((set) => ({
  // Initial state
  isSidebarCollapsed: false,
  collapsedProjects: new Set<string>(),
  collapsedBranches: new Set<string>(),
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,

  // Actions
  setSidebarWidth: (width) => {
    const clampedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, width));
    set({ sidebarWidth: clampedWidth });
  },

  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  toggleProject: (projectName) =>
    set((state) => {
      const newSet = new Set(state.collapsedProjects);
      if (newSet.has(projectName)) {
        newSet.delete(projectName);
      } else {
        newSet.add(projectName);
      }
      return { collapsedProjects: newSet };
    }),

  toggleBranch: (branchKey) =>
    set((state) => {
      const newSet = new Set(state.collapsedBranches);
      if (newSet.has(branchKey)) {
        newSet.delete(branchKey);
      } else {
        newSet.add(branchKey);
      }
      return { collapsedBranches: newSet };
    }),
}));

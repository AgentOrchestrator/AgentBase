/**
 * Recent Workspace Types
 *
 * Types for tracking recently opened workspace paths.
 */

/**
 * A recently opened workspace entry.
 */
export interface RecentWorkspace {
  /** Absolute path to the workspace directory */
  path: string;
  /** Display name (defaults to directory basename) */
  name: string;
  /** Unix timestamp (ms) when last opened */
  lastOpenedAt: number;
  /** Unix timestamp (ms) when first added */
  createdAt: number;
}

/**
 * Options for adding a workspace to the recent list.
 */
export interface AddWorkspaceOptions {
  /** Custom display name (defaults to directory basename) */
  name?: string;
}

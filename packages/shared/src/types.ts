// Shared types that can be used across the monorepo
// Add common interfaces, types, and constants here

export interface BaseConfig {
  // Add shared configuration types
}

/**
 * Git repository information
 * Used to display branch, status, and sync state in the UI
 */
export interface GitInfo {
  /** Current branch name */
  branch: string;
  /** Remote name (e.g., 'origin') */
  remote?: string;
  /** Working directory status */
  status: 'clean' | 'dirty' | 'unknown';
  /** Commits ahead of remote */
  ahead: number;
  /** Commits behind remote */
  behind: number;
}

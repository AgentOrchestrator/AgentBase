/**
 * Linear Store Interface
 *
 * Observable store for managing Linear integration state.
 * Follows the same Observer pattern as INodeStore and IForkStore.
 */

// =============================================================================
// Type Definitions (moved from Canvas.tsx)
// =============================================================================

export type LinearProject = {
  id: string;
  name: string;
};

export type LinearMilestone = {
  id: string;
  name: string;
  project?: LinearProject;
};

export type LinearWorkflowState = {
  id: string;
  name: string;
  color: string;
  type?: string;
};

export type LinearIssue = {
  id: string;
  title: string;
  identifier: string;
  description?: string;
  state: LinearWorkflowState;
  priority: number;
  assignee?: {
    name: string;
    avatarUrl?: string;
  };
  project?: LinearProject;
  projectMilestone?: LinearMilestone;
  createdAt: string;
  updatedAt: string;
};

/**
 * Milestone option with computed label for display
 */
export type MilestoneOption = {
  id: string;
  name: string;
  label: string;
  projectId?: string;
};

// =============================================================================
// Filter State
// =============================================================================

export type LinearFilterState = {
  selectedProjectId: string; // 'all' | 'none' | project ID
  selectedMilestoneId: string; // 'all' | 'none' | milestone ID
  selectedStatusId: string; // 'all' | status ID
};

// =============================================================================
// Store State
// =============================================================================

export type LinearState = {
  // Connection state
  apiKey: string;
  isConnected: boolean;
  workspaceName: string;
  isLoading: boolean;

  // Data
  issues: LinearIssue[];
  projects: LinearProject[];

  // Filter state
  filters: LinearFilterState;

  // Computed/derived options (for dropdowns)
  projectOptions: LinearProject[];
  milestoneOptions: MilestoneOption[];
  statusOptions: LinearWorkflowState[];
  visibleMilestoneOptions: MilestoneOption[];
  filteredIssues: LinearIssue[];

  // Boolean helpers
  hasUnassignedProject: boolean;
  hasUnassignedMilestone: boolean;
};

// =============================================================================
// Observer Pattern
// =============================================================================

/**
 * Callback for Linear state changes
 */
export type LinearStateListener = (state: LinearState) => void;

// =============================================================================
// Store Interface
// =============================================================================

/**
 * Interface for Linear state management
 */
export interface ILinearStore {
  /**
   * Get the current state snapshot
   */
  getState(): LinearState;

  // =========================================================================
  // Connection Actions
  // =========================================================================

  /**
   * Connect to Linear with an API key
   * Stores key in localStorage and updates connection state
   */
  connect(apiKey: string): void;

  /**
   * Disconnect from Linear
   * Clears localStorage and resets state
   */
  disconnect(): void;

  /**
   * Initialize from localStorage on app start
   * Returns true if a stored key was found and connection restored
   */
  initFromStorage(): boolean;

  // =========================================================================
  // Data Actions
  // =========================================================================

  /**
   * Set issues data (called after fetch)
   */
  setIssues(issues: LinearIssue[]): void;

  /**
   * Set projects data (called after fetch)
   */
  setProjects(projects: LinearProject[]): void;

  /**
   * Set workspace name
   */
  setWorkspaceName(name: string): void;

  /**
   * Set loading state
   */
  setLoading(isLoading: boolean): void;

  // =========================================================================
  // Filter Actions
  // =========================================================================

  /**
   * Set a filter value
   */
  setFilter<K extends keyof LinearFilterState>(filterKey: K, value: LinearFilterState[K]): void;

  /**
   * Reset all filters to defaults
   */
  resetFilters(): void;

  // =========================================================================
  // Observer Pattern
  // =========================================================================

  /**
   * Subscribe to state changes
   * @returns Unsubscribe function
   */
  subscribe(listener: LinearStateListener): () => void;
}

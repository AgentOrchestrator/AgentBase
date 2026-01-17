/**
 * Linear Store Implementation
 *
 * Manages Linear integration state using observer pattern.
 * Handles connection state, issues/projects data, and filtering.
 */

import type {
  ILinearStore,
  LinearFilterState,
  LinearIssue,
  LinearProject,
  LinearState,
  LinearStateListener,
  LinearWorkflowState,
  MilestoneOption,
} from './ILinearStore';

const STORAGE_KEY = 'linear_api_key';

const DEFAULT_FILTERS: LinearFilterState = {
  selectedProjectId: 'all',
  selectedMilestoneId: 'all',
  selectedStatusId: 'all',
};

/**
 * Linear store implementation with observer pattern
 */
export class LinearStore implements ILinearStore {
  // Core state
  private apiKey: string = '';
  private isConnected: boolean = false;
  private workspaceName: string = '';
  private isLoading: boolean = false;
  private issues: LinearIssue[] = [];
  private projects: LinearProject[] = [];
  private filters: LinearFilterState = { ...DEFAULT_FILTERS };

  // Observer pattern
  private listeners: Set<LinearStateListener> = new Set();

  // =========================================================================
  // Computed Properties (derived from state)
  // =========================================================================

  /**
   * Get unique projects from both linearProjects and issues, sorted by name
   */
  private computeProjectOptions(): LinearProject[] {
    const map = new Map<string, LinearProject>();

    // Add from projects list
    this.projects.forEach((project) => {
      if (project.id) {
        map.set(project.id, project);
      }
    });

    // Add from issues
    this.issues.forEach((issue) => {
      if (issue.project?.id) {
        map.set(issue.project.id, issue.project);
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get unique milestones from issues with computed labels
   */
  private computeMilestoneOptions(): MilestoneOption[] {
    const map = new Map<string, MilestoneOption>();

    this.issues.forEach((issue) => {
      if (issue.projectMilestone?.id) {
        const milestone = issue.projectMilestone;
        const label = milestone.project?.name
          ? `${milestone.project.name} / ${milestone.name}`
          : milestone.name;

        map.set(milestone.id, {
          id: milestone.id,
          name: milestone.name,
          label,
          projectId: milestone.project?.id,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * Get unique workflow states from issues
   */
  private computeStatusOptions(): LinearWorkflowState[] {
    const map = new Map<string, LinearWorkflowState>();

    this.issues.forEach((issue) => {
      if (issue.state?.id) {
        map.set(issue.state.id, issue.state);
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get milestone options filtered by selected project
   */
  private computeVisibleMilestoneOptions(): MilestoneOption[] {
    const milestones = this.computeMilestoneOptions();

    if (this.filters.selectedProjectId === 'all') {
      return milestones;
    }
    if (this.filters.selectedProjectId === 'none') {
      return [];
    }
    return milestones.filter((milestone) => milestone.projectId === this.filters.selectedProjectId);
  }

  /**
   * Check if any issues have no project assigned
   */
  private computeHasUnassignedProject(): boolean {
    return this.issues.some((issue) => !issue.project);
  }

  /**
   * Check if any issues have no milestone assigned
   */
  private computeHasUnassignedMilestone(): boolean {
    return this.issues.some((issue) => !issue.projectMilestone);
  }

  /**
   * Apply all filters to issues
   */
  private computeFilteredIssues(): LinearIssue[] {
    return this.issues.filter((issue) => {
      // Project filter
      if (this.filters.selectedProjectId === 'none' && issue.project) {
        return false;
      }
      if (
        this.filters.selectedProjectId !== 'all' &&
        this.filters.selectedProjectId !== 'none' &&
        issue.project?.id !== this.filters.selectedProjectId
      ) {
        return false;
      }

      // Milestone filter
      if (this.filters.selectedMilestoneId === 'none' && issue.projectMilestone) {
        return false;
      }
      if (
        this.filters.selectedMilestoneId !== 'all' &&
        this.filters.selectedMilestoneId !== 'none' &&
        issue.projectMilestone?.id !== this.filters.selectedMilestoneId
      ) {
        return false;
      }

      // Status filter
      if (
        this.filters.selectedStatusId !== 'all' &&
        issue.state?.id !== this.filters.selectedStatusId
      ) {
        return false;
      }

      return true;
    });
  }

  // =========================================================================
  // State Snapshot
  // =========================================================================

  /**
   * Get the current state snapshot with all computed properties
   */
  getState(): LinearState {
    return {
      // Connection state
      apiKey: this.apiKey,
      isConnected: this.isConnected,
      workspaceName: this.workspaceName,
      isLoading: this.isLoading,

      // Data
      issues: this.issues,
      projects: this.projects,

      // Filters
      filters: { ...this.filters },

      // Computed options
      projectOptions: this.computeProjectOptions(),
      milestoneOptions: this.computeMilestoneOptions(),
      statusOptions: this.computeStatusOptions(),
      visibleMilestoneOptions: this.computeVisibleMilestoneOptions(),
      filteredIssues: this.computeFilteredIssues(),

      // Boolean helpers
      hasUnassignedProject: this.computeHasUnassignedProject(),
      hasUnassignedMilestone: this.computeHasUnassignedMilestone(),
    };
  }

  // =========================================================================
  // Connection Actions
  // =========================================================================

  /**
   * Connect to Linear with an API key
   */
  connect(apiKey: string): void {
    if (!apiKey.trim()) {
      return;
    }

    this.apiKey = apiKey.trim();
    this.isConnected = true;
    localStorage.setItem(STORAGE_KEY, this.apiKey);

    this.notifyListeners();
  }

  /**
   * Disconnect from Linear
   */
  disconnect(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.apiKey = '';
    this.isConnected = false;
    this.workspaceName = '';
    this.projects = [];
    this.issues = [];
    this.filters = { ...DEFAULT_FILTERS };

    this.notifyListeners();
  }

  /**
   * Initialize from localStorage on app start
   */
  initFromStorage(): boolean {
    const storedKey = localStorage.getItem(STORAGE_KEY);
    if (storedKey) {
      this.apiKey = storedKey;
      this.isConnected = true;
      this.notifyListeners();
      return true;
    }
    return false;
  }

  // =========================================================================
  // Data Actions
  // =========================================================================

  /**
   * Set issues data
   */
  setIssues(issues: LinearIssue[]): void {
    this.issues = issues;
    this.validateFilters();
    this.notifyListeners();
  }

  /**
   * Set projects data
   */
  setProjects(projects: LinearProject[]): void {
    this.projects = projects;
    this.notifyListeners();
  }

  /**
   * Set workspace name
   */
  setWorkspaceName(name: string): void {
    this.workspaceName = name;
    this.notifyListeners();
  }

  /**
   * Set loading state
   */
  setLoading(isLoading: boolean): void {
    this.isLoading = isLoading;
    this.notifyListeners();
  }

  // =========================================================================
  // Filter Actions
  // =========================================================================

  /**
   * Set a filter value
   */
  setFilter<K extends keyof LinearFilterState>(filterKey: K, value: LinearFilterState[K]): void {
    this.filters[filterKey] = value;

    // When project changes, validate milestone filter
    if (filterKey === 'selectedProjectId') {
      this.validateMilestoneFilter();
    }

    this.notifyListeners();
  }

  /**
   * Reset all filters to defaults
   */
  resetFilters(): void {
    this.filters = { ...DEFAULT_FILTERS };
    this.notifyListeners();
  }

  // =========================================================================
  // Filter Validation (auto-reset invalid filters)
  // =========================================================================

  /**
   * Validate all filters and reset invalid ones
   */
  private validateFilters(): void {
    this.validateProjectFilter();
    this.validateMilestoneFilter();
    this.validateStatusFilter();
  }

  /**
   * Reset project filter if selected project no longer exists
   */
  private validateProjectFilter(): void {
    const projectOptions = this.computeProjectOptions();
    if (
      this.filters.selectedProjectId !== 'all' &&
      this.filters.selectedProjectId !== 'none' &&
      !projectOptions.some((project) => project.id === this.filters.selectedProjectId)
    ) {
      this.filters.selectedProjectId = 'all';
    }
  }

  /**
   * Reset milestone filter if selected milestone no longer visible
   */
  private validateMilestoneFilter(): void {
    const visibleMilestones = this.computeVisibleMilestoneOptions();
    if (
      this.filters.selectedMilestoneId !== 'all' &&
      this.filters.selectedMilestoneId !== 'none' &&
      !visibleMilestones.some((m) => m.id === this.filters.selectedMilestoneId)
    ) {
      this.filters.selectedMilestoneId = 'all';
    }
  }

  /**
   * Reset status filter if selected status no longer exists
   */
  private validateStatusFilter(): void {
    const statusOptions = this.computeStatusOptions();
    if (
      this.filters.selectedStatusId !== 'all' &&
      !statusOptions.some((state) => state.id === this.filters.selectedStatusId)
    ) {
      this.filters.selectedStatusId = 'all';
    }
  }

  // =========================================================================
  // Observer Pattern
  // =========================================================================

  /**
   * Subscribe to state changes
   */
  subscribe(listener: LinearStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      listener(state);
    });
  }
}

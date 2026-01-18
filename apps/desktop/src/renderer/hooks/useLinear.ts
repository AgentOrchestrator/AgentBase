/**
 * useLinear Hook
 *
 * React integration hook for the Linear store.
 * Subscribes to LinearStore and re-renders on changes.
 * Handles initialization from localStorage and fetch triggers.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { linearService } from '../services/LinearService';
import { linearStore } from '../stores';
import type {
  LinearFilterState,
  LinearIssue,
  LinearProject,
  LinearState,
  LinearWorkflowState,
  MilestoneOption,
} from '../stores/ILinearStore';

// =============================================================================
// Return Type
// =============================================================================

export type UseLinearReturn = {
  // Connection state
  apiKey: string;
  isConnected: boolean;
  workspaceName: string;
  isLoading: boolean;

  // Data
  issues: LinearIssue[];
  projects: LinearProject[];

  // Filters
  selectedProjectId: string;
  selectedMilestoneId: string;
  selectedStatusId: string;

  // Computed options (for dropdowns)
  projectOptions: LinearProject[];
  milestoneOptions: MilestoneOption[];
  statusOptions: LinearWorkflowState[];
  visibleMilestoneOptions: MilestoneOption[];
  filteredIssues: LinearIssue[];

  // Boolean helpers
  hasUnassignedProject: boolean;
  hasUnassignedMilestone: boolean;

  // Actions
  connect: (apiKey: string) => void;
  disconnect: () => void;
  setFilter: <K extends keyof LinearFilterState>(filterKey: K, value: LinearFilterState[K]) => void;
  resetFilters: () => void;

  // Fetch actions
  fetchIssues: () => Promise<void>;
  fetchProjects: () => Promise<void>;
  createTicket: (
    title: string,
    description?: string
  ) => Promise<{
    success: boolean;
    issue?: { id: string; identifier: string; title: string; url: string };
    error?: string;
  }>;
};

// =============================================================================
// Hook Implementation
// =============================================================================

export function useLinear(): UseLinearReturn {
  // Subscribe to store state
  const [state, setState] = useState<LinearState>(() => linearStore.getState());
  const hasAttemptedInitialFetch = useRef(false);

  // Subscribe to store changes
  useEffect(() => {
    const unsubscribe = linearStore.subscribe((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, []);

  // Initialize from localStorage on mount
  useEffect(() => {
    linearStore.initFromStorage();
  }, []);

  // =========================================================================
  // Actions
  // =========================================================================

  const connect = useCallback((apiKey: string) => {
    linearStore.connect(apiKey);
  }, []);

  const disconnect = useCallback(() => {
    linearStore.disconnect();
  }, []);

  const setFilter = useCallback(
    <K extends keyof LinearFilterState>(filterKey: K, value: LinearFilterState[K]) => {
      linearStore.setFilter(filterKey, value);
    },
    []
  );

  const resetFilters = useCallback(() => {
    linearStore.resetFilters();
  }, []);

  // =========================================================================
  // Fetch Actions
  // =========================================================================

  const fetchIssues = useCallback(async () => {
    const currentState = linearStore.getState();
    if (!currentState.apiKey) {
      return;
    }

    linearStore.setLoading(true);

    try {
      const result = await linearService.fetchIssues(currentState.apiKey);

      if (result.success) {
        linearStore.setIssues(result.issues);
        if (result.workspaceName) {
          linearStore.setWorkspaceName(result.workspaceName);
        }
      } else {
        console.error('[useLinear] Failed to fetch issues:', result.error);
      }
    } finally {
      linearStore.setLoading(false);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    const currentState = linearStore.getState();
    if (!currentState.apiKey) {
      return;
    }

    try {
      const result = await linearService.fetchProjects(currentState.apiKey);

      if (result.success) {
        linearStore.setProjects(result.projects);
      } else {
        console.error('[useLinear] Failed to fetch projects:', result.error);
      }
    } catch (error) {
      console.error('[useLinear] Error fetching projects:', error);
    }
  }, []);

  // Reset fetch attempt flag when disconnected
  useEffect(() => {
    if (!state.isConnected) {
      hasAttemptedInitialFetch.current = false;
    }
  }, [state.isConnected]);

  // Automatically fetch issues and workspace name when connected (only once on initial connection)
  useEffect(() => {
    if (
      state.isConnected &&
      state.apiKey &&
      !state.isLoading &&
      !hasAttemptedInitialFetch.current
    ) {
      // Only fetch if we don't have workspace name yet (indicates we haven't fetched successfully)
      if (!state.workspaceName) {
        hasAttemptedInitialFetch.current = true;
        fetchIssues();
        fetchProjects();
      } else {
        // If we already have workspace name, mark as attempted to avoid refetching
        hasAttemptedInitialFetch.current = true;
      }
    }
  }, [
    state.isConnected,
    state.apiKey,
    state.workspaceName,
    state.isLoading,
    fetchIssues,
    fetchProjects,
  ]);

  const createTicket = useCallback(
    async (title: string, description?: string) => {
      const currentState = linearStore.getState();
      if (!currentState.apiKey) {
        return {
          success: false,
          error: 'Please connect to Linear first',
        };
      }

      const result = await linearService.createTicket(currentState.apiKey, title, description);

      // If successful, refresh issues list
      if (result.success) {
        // Fire and forget - don't await
        fetchIssues();
      }

      return result;
    },
    [fetchIssues]
  );

  // =========================================================================
  // Return Value
  // =========================================================================

  return useMemo(
    () => ({
      // Connection state
      apiKey: state.apiKey,
      isConnected: state.isConnected,
      workspaceName: state.workspaceName,
      isLoading: state.isLoading,

      // Data
      issues: state.issues,
      projects: state.projects,

      // Filters (flattened for easier access)
      selectedProjectId: state.filters.selectedProjectId,
      selectedMilestoneId: state.filters.selectedMilestoneId,
      selectedStatusId: state.filters.selectedStatusId,

      // Computed options
      projectOptions: state.projectOptions,
      milestoneOptions: state.milestoneOptions,
      statusOptions: state.statusOptions,
      visibleMilestoneOptions: state.visibleMilestoneOptions,
      filteredIssues: state.filteredIssues,

      // Boolean helpers
      hasUnassignedProject: state.hasUnassignedProject,
      hasUnassignedMilestone: state.hasUnassignedMilestone,

      // Actions
      connect,
      disconnect,
      setFilter,
      resetFilters,

      // Fetch actions
      fetchIssues,
      fetchProjects,
      createTicket,
    }),
    [state, connect, disconnect, setFilter, resetFilters, fetchIssues, fetchProjects, createTicket]
  );
}

// =============================================================================
// Re-export types for convenience
// =============================================================================

export type {
  LinearFilterState,
  LinearIssue,
  LinearMilestone,
  LinearProject,
  LinearWorkflowState,
  MilestoneOption,
} from '../stores/ILinearStore';

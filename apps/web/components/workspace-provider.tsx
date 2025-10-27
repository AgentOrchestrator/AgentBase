"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  role: string;
  created_at: string;
  joined_at: string;
}

interface WorkspaceContextType {
  selectedWorkspace: Workspace | null;
  setSelectedWorkspace: (workspace: Workspace | null) => void;
  workspaces: Workspace[];
  loading: boolean;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [selectedWorkspace, setSelectedWorkspaceState] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshWorkspaces = useCallback(async () => {
    try {
      const response = await fetch('/api/workspaces');
      if (response.ok) {
        const data = await response.json();
        const fetchedWorkspaces = data.workspaces || [];
        setWorkspaces(fetchedWorkspaces);

        // Auto-select first workspace if none selected
        if (!selectedWorkspace && fetchedWorkspaces.length > 0) {
          // Try to load from localStorage first
          const savedWorkspaceId = localStorage.getItem('selectedWorkspaceId');
          const savedWorkspace = fetchedWorkspaces.find((w: Workspace) => w.id === savedWorkspaceId);

          if (savedWorkspace) {
            setSelectedWorkspaceState(savedWorkspace);
          } else {
            // Default to first workspace
            setSelectedWorkspaceState(fetchedWorkspaces[0]);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  const setSelectedWorkspace = useCallback((workspace: Workspace | null) => {
    setSelectedWorkspaceState(workspace);
    if (workspace) {
      localStorage.setItem('selectedWorkspaceId', workspace.id);
    } else {
      localStorage.removeItem('selectedWorkspaceId');
    }
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        selectedWorkspace,
        setSelectedWorkspace,
        workspaces,
        loading,
        refreshWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}

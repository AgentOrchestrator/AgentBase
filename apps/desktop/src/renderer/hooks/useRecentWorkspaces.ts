import { useState, useEffect, useCallback } from 'react';
import type { RecentWorkspaceEntry } from '../../main/preload';

export function useRecentWorkspaces(limit: number = 10) {
  const [workspaces, setWorkspaces] = useState<RecentWorkspaceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!window.recentWorkspaceAPI) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const entries = await window.recentWorkspaceAPI.getRecent(limit);
      setWorkspaces(entries);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recent workspaces');
      console.error('[useRecentWorkspaces] Failed to fetch:', err);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const trackWorkspace = useCallback(
    async (
      path: string,
      name: string,
      gitInfo?: { branch?: string; remote?: string }
    ) => {
      if (!window.recentWorkspaceAPI) return;

      try {
        await window.recentWorkspaceAPI.trackRecent(path, name, gitInfo);
        await refresh();
      } catch (err) {
        console.error('[useRecentWorkspaces] Failed to track:', err);
      }
    },
    [refresh]
  );

  const removeWorkspace = useCallback(
    async (path: string) => {
      if (!window.recentWorkspaceAPI) return;

      try {
        await window.recentWorkspaceAPI.removeRecent(path);
        await refresh();
      } catch (err) {
        console.error('[useRecentWorkspaces] Failed to remove:', err);
      }
    },
    [refresh]
  );

  return {
    workspaces,
    isLoading,
    error,
    refresh,
    trackWorkspace,
    removeWorkspace,
  };
}

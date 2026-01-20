import { useCallback, useEffect, useState } from 'react';

/**
 * Return type for the useGithubUser hook
 */
export interface UseGithubUserReturn {
  /** The GitHub username if fetched successfully */
  username: string | null;
  /** Error message if fetch failed */
  error: string | null;
  /** Whether the fetch is in progress */
  isLoading: boolean;
  /** Refetch the GitHub username */
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching and managing GitHub username state
 *
 * Fetches the GitHub username on mount via the gitAPI.
 * Manages loading, error, and username states.
 */
export function useGithubUser(): UseGithubUserReturn {
  const [username, setUsername] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGithubUsername = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await window.gitAPI?.getGithubUsername();
      if (result?.success && result.username) {
        setUsername(result.username);
        setError(null);
      } else {
        setError(result?.error || 'Failed to get GitHub username');
        setUsername(null);
      }
    } catch (err) {
      const errorMessage = (err as Error).message || 'Unknown error';
      setError(errorMessage);
      setUsername(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGithubUsername();
  }, [fetchGithubUsername]);

  return {
    username,
    error,
    isLoading,
    refetch: fetchGithubUsername,
  };
}

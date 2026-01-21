import { useCallback, useEffect, useState } from 'react';

const AUTO_FORK_STORAGE_KEY = 'auto-fork';

/**
 * Return type for the useAutoFork hook
 */
export interface UseAutoForkReturn {
  /** Whether auto-fork is enabled */
  autoFork: boolean;
  /** Set the auto-fork setting */
  setAutoFork: (value: boolean) => void;
  /** Toggle the auto-fork setting */
  toggleAutoFork: () => void;
}

/**
 * Hook for managing auto-fork setting with localStorage persistence
 *
 * Auto-fork controls whether the fork modal opens when forking from text selection.
 * When disabled, forks are created automatically with random names.
 * Default value is true (show modal).
 */
export function useAutoFork(): UseAutoForkReturn {
  const [autoFork, setAutoForkState] = useState<boolean>(() => {
    const stored = localStorage.getItem(AUTO_FORK_STORAGE_KEY);
    return stored !== null ? stored === 'true' : true;
  });

  // Persist to localStorage when value changes
  useEffect(() => {
    localStorage.setItem(AUTO_FORK_STORAGE_KEY, String(autoFork));
  }, [autoFork]);

  const setAutoFork = useCallback((value: boolean) => {
    setAutoForkState(value);
  }, []);

  const toggleAutoFork = useCallback(() => {
    setAutoForkState((prev) => !prev);
  }, []);

  return {
    autoFork,
    setAutoFork,
    toggleAutoFork,
  };
}

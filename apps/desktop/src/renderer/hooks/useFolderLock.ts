import { useState, useEffect, useCallback } from 'react';

/**
 * Return type for the useFolderLock hook
 */
export interface UseFolderLockReturn {
  /** Currently locked folder path */
  lockedFolderPath: string | null;
  /** Currently hovered folder path */
  hoveredFolderPath: string | null;
  /** Set the locked folder path */
  setLockedFolderPath: (path: string | null) => void;
  /** Set the hovered folder path */
  setHoveredFolderPath: (path: string | null) => void;
}

/**
 * Hook for managing folder lock state in the canvas sidebar
 *
 * Features:
 * - Clears lock when no folders exist in hierarchy
 * - Auto-locks first folder if none is locked
 * - Validates locked folder still exists
 *
 * @param agentHierarchy - The agent hierarchy organized by project/branch
 * @param folderPathMap - Map of folder names to their paths
 */
export function useFolderLock(
  agentHierarchy: Record<string, Record<string, unknown[]>>,
  folderPathMap: Record<string, string>
): UseFolderLockReturn {
  const [lockedFolderPath, setLockedFolderPath] = useState<string | null>(null);
  const [hoveredFolderPath, setHoveredFolderPath] = useState<string | null>(null);

  // Auto-lock the first folder that appears, and clear lock if no folders exist
  useEffect(() => {
    const folderNames = Object.keys(agentHierarchy);

    if (folderNames.length === 0) {
      // Clear lock if no folders exist
      setLockedFolderPath(null);
    } else if (!lockedFolderPath) {
      // Auto-lock first folder if none is locked
      const firstFolderName = folderNames[0];
      const firstFolderPath = folderPathMap[firstFolderName];
      if (firstFolderPath) {
        setLockedFolderPath(firstFolderPath);
      }
    } else {
      // Validate that locked folder still exists
      const lockedFolderName = Object.keys(folderPathMap).find(
        (name) => folderPathMap[name] === lockedFolderPath
      );
      if (!lockedFolderName || !agentHierarchy[lockedFolderName]) {
        // Locked folder no longer exists, clear it
        setLockedFolderPath(null);
      }
    }
  }, [agentHierarchy, folderPathMap, lockedFolderPath]);

  const handleSetLockedFolderPath = useCallback((path: string | null) => {
    setLockedFolderPath(path);
  }, []);

  const handleSetHoveredFolderPath = useCallback((path: string | null) => {
    setHoveredFolderPath(path);
  }, []);

  return {
    lockedFolderPath,
    hoveredFolderPath,
    setLockedFolderPath: handleSetLockedFolderPath,
    setHoveredFolderPath: handleSetHoveredFolderPath,
  };
}

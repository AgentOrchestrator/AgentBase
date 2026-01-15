import { useEffect, useRef, useCallback } from 'react';
import type {
  CodingAgentType,
  SessionFileChangeEvent,
} from '@agent-orchestrator/shared';

/**
 * Options for the useSessionFileWatcher hook
 */
interface UseSessionFileWatcherOptions {
  /** Agent type to watch */
  agentType: CodingAgentType;
  /** Session ID to filter for (optional - if not provided, all sessions trigger callback) */
  sessionId?: string;
  /** Callback when session file changes */
  onSessionChange: (event: SessionFileChangeEvent) => void;
  /** Whether watching is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Hook to watch for session file changes and trigger reloads.
 * Enables real-time synchronization between terminal and chat views.
 *
 * @example
 * ```tsx
 * useSessionFileWatcher({
 *   agentType: 'claude_code',
 *   sessionId: currentSessionId,
 *   onSessionChange: (event) => {
 *     if (event.type === 'updated') {
 *       loadSessionHistory();
 *     }
 *   },
 *   enabled: !!currentSessionId,
 * });
 * ```
 */
export function useSessionFileWatcher({
  agentType,
  sessionId,
  onSessionChange,
  enabled = true,
}: UseSessionFileWatcherOptions): void {
  // Keep callback ref updated to avoid stale closures
  const onSessionChangeRef = useRef(onSessionChange);
  useEffect(() => {
    onSessionChangeRef.current = onSessionChange;
  }, [onSessionChange]);

  // Handle incoming file change events
  const handleFileChange = useCallback(
    (event: SessionFileChangeEvent) => {
      // Filter by sessionId if specified
      if (sessionId && event.sessionId !== sessionId) {
        return;
      }

      // Filter by agentType
      if (event.agentType !== agentType) {
        return;
      }

      console.log('[useSessionFileWatcher] Session file changed:', event);
      onSessionChangeRef.current(event);
    },
    [sessionId, agentType]
  );

  // Set up watcher
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const api = window.sessionWatcherAPI;
    if (!api) {
      console.warn('[useSessionFileWatcher] sessionWatcherAPI not available');
      return;
    }

    // Start watching
    api.watch(agentType).catch((error: unknown) => {
      console.error('[useSessionFileWatcher] Failed to start watching:', error);
    });

    // Subscribe to events
    const cleanup = api.onSessionFileChanged(handleFileChange);

    return () => {
      cleanup();
      // Note: We don't unwatch on cleanup because other components may still need it.
      // The watcher will be cleaned up when the app quits.
    };
  }, [enabled, agentType, handleFileChange]);
}

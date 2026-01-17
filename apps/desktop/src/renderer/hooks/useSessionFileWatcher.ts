import type { CodingAgentType, SessionFileChangeEvent } from '@agent-orchestrator/shared';
import { useCallback, useEffect, useRef } from 'react';

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
  /** Debounce window in ms to deduplicate rapid events (default: 100) */
  debounceMs?: number;
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
  debounceMs = 100,
}: UseSessionFileWatcherOptions): void {
  // Keep callback ref updated to avoid stale closures
  const onSessionChangeRef = useRef(onSessionChange);
  useEffect(() => {
    onSessionChangeRef.current = onSessionChange;
  }, [onSessionChange]);

  // Deduplication: track last processed event to filter duplicates
  const lastEventRef = useRef<{ sessionId: string; type: string; timestamp: number } | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle incoming file change events with deduplication
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

      // Deduplicate: skip if same event within debounce window
      const lastEvent = lastEventRef.current;
      if (
        lastEvent &&
        lastEvent.sessionId === event.sessionId &&
        lastEvent.type === event.type &&
        event.timestamp - lastEvent.timestamp < debounceMs
      ) {
        return;
      }

      // Clear any pending debounced callback
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Update last event tracking
      lastEventRef.current = {
        sessionId: event.sessionId,
        type: event.type,
        timestamp: event.timestamp,
      };

      // Debounce the callback to coalesce rapid events
      debounceTimerRef.current = setTimeout(() => {
        console.log('[useSessionFileWatcher] Session file changed:', event);
        onSessionChangeRef.current(event);
      }, debounceMs);
    },
    [sessionId, agentType, debounceMs]
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
      // Clear any pending debounced callback
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      // Note: We don't unwatch on cleanup because other components may still need it.
      // The watcher will be cleaned up when the app quits.
    };
  }, [enabled, agentType, handleFileChange]);
}

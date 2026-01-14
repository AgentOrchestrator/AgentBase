/**
 * useSessionIdMatcher Hook
 *
 * Matches agent nodes to conversation JSON files by timestamp proximity.
 * Watches for new sessions and updates the agent node with the sessionId when found.
 */

import { useEffect, useRef } from 'react';

interface SessionSummary {
  id: string;
  agentType: string;
  createdAt: string;
  updatedAt: string;
  timestamp: string;
  projectPath?: string;
  projectName?: string;
  messageCount: number;
}

interface UseSessionIdMatcherOptions {
  /** Agent node creation timestamp */
  createdAt?: number;
  /** Workspace path to filter sessions by */
  workspacePath?: string;
  /** Agent ID for this node */
  agentId: string;
  /** Callback when sessionId is found */
  onSessionIdFound: (sessionId: string) => void;
  /** Whether matching is enabled (e.g., only when workspace is selected) */
  enabled?: boolean;
}

/**
 * Normalize project path for comparison
 * Converts paths to a consistent format for matching
 */
function normalizePath(path: string): string {
  return path.replace(/\/$/, '').toLowerCase();
}

/**
 * Check if two paths match (handles different path formats)
 */
function pathsMatch(path1?: string, path2?: string): boolean {
  if (!path1 || !path2) return false;
  return normalizePath(path1) === normalizePath(path2);
}

/**
 * Match sessions to agent node by timestamp proximity
 */
function findMatchingSession(
  sessions: SessionSummary[],
  agentCreatedAt: number,
  workspacePath?: string
): SessionSummary | null {
  console.log('[findMatchingSession] Starting match', {
    sessionCount: sessions.length,
    agentCreatedAt: new Date(agentCreatedAt).toISOString(),
    workspacePath,
  });

  if (sessions.length === 0) {
    console.log('[findMatchingSession] No sessions to match');
    return null;
  }

  // Filter by workspace path if provided
  let candidateSessions = sessions;
  if (workspacePath) {
    console.log('[findMatchingSession] Filtering by workspace path:', workspacePath);
    candidateSessions = sessions.filter((session) => {
      const matches = pathsMatch(session.projectPath, workspacePath);
      console.log('[findMatchingSession] Session path match:', {
        sessionPath: session.projectPath,
        workspacePath,
        matches,
      });
      return matches;
    });
    console.log(`[findMatchingSession] Found ${candidateSessions.length} sessions matching workspace path`);
  }

  // If no workspace-filtered matches, use all sessions (fallback)
  if (candidateSessions.length === 0) {
    console.log('[findMatchingSession] No workspace matches, using all sessions as fallback');
    candidateSessions = sessions;
  }

  // Find session with closest timestamp to agent creation
  // Allow up to 60 seconds difference (30s before to 30s after)
  // Sessions are typically created AFTER agent starts, so we need a window on both sides
  const TIME_WINDOW_MS = 60 * 1000; // 60 seconds total window (30s before + 30s after)
  let bestMatch: SessionSummary | null = null;
  let minTimeDiff = Infinity;

  console.log('[findMatchingSession] Checking timestamp proximity (window:', TIME_WINDOW_MS, 'ms = 30s before + 30s after)');
  for (const session of candidateSessions) {
    // Use updatedAt (file modification time) as it's more accurate for when the file was created
    const sessionTime = new Date(session.updatedAt).getTime();
    const timeDiff = Math.abs(sessionTime - agentCreatedAt);
    const timeDiffSeconds = Math.round(timeDiff / 1000);
    const isAfter = sessionTime > agentCreatedAt;

    console.log('[findMatchingSession] Checking session:', {
      id: session.id,
      sessionTime: new Date(sessionTime).toISOString(),
      agentCreatedAt: new Date(agentCreatedAt).toISOString(),
      timeDiffMs: timeDiff,
      timeDiffSeconds,
      isAfter: isAfter ? 'after' : 'before',
      withinWindow: timeDiff <= TIME_WINDOW_MS,
    });

    // Prefer sessions within the time window (30s before to 30s after agent creation)
    if (timeDiff <= TIME_WINDOW_MS && timeDiff < minTimeDiff) {
      bestMatch = session;
      minTimeDiff = timeDiff;
      console.log('[findMatchingSession] New best match:', {
        id: session.id,
        timeDiffSeconds,
        isAfter: isAfter ? 'after' : 'before',
      });
    }
  }

  // If no close match found, use the most recent session as fallback
  if (!bestMatch && candidateSessions.length > 0) {
    console.log('[findMatchingSession] No close match, using most recent session as fallback');
    // Sort by updatedAt descending (most recent first)
    const sorted = [...candidateSessions].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    bestMatch = sorted[0];
    console.log('[findMatchingSession] Fallback match:', {
      id: bestMatch.id,
      updatedAt: bestMatch.updatedAt,
    });
  }

  if (bestMatch) {
    console.log('[findMatchingSession] ✅ Final match:', {
      id: bestMatch.id,
      projectPath: bestMatch.projectPath,
      updatedAt: bestMatch.updatedAt,
      timeDiff: Math.abs(new Date(bestMatch.updatedAt).getTime() - agentCreatedAt),
    });
  } else {
    console.log('[findMatchingSession] ❌ No match found');
  }

  return bestMatch;
}

/**
 * Hook to match agent nodes to conversation session IDs
 */
export function useSessionIdMatcher({
  createdAt,
  workspacePath,
  agentId,
  onSessionIdFound,
  enabled = true,
}: UseSessionIdMatcherOptions): void {
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const matchedSessionIdRef = useRef<string | null>(null);
  const lastCheckTimeRef = useRef<number>(0);

  useEffect(() => {
    console.log('[useSessionIdMatcher] Hook called', {
      enabled,
      createdAt,
      workspacePath,
      agentId,
      alreadyMatched: !!matchedSessionIdRef.current,
    });

    // Don't run if disabled, no createdAt, or already matched
    if (!enabled) {
      console.log('[useSessionIdMatcher] Disabled - skipping');
      return;
    }

    if (!createdAt) {
      console.log('[useSessionIdMatcher] No createdAt timestamp - skipping');
      return;
    }

    if (matchedSessionIdRef.current) {
      console.log('[useSessionIdMatcher] Already matched:', matchedSessionIdRef.current);
      return;
    }

    console.log('[useSessionIdMatcher] Starting session matching for agent:', agentId, {
      createdAt: new Date(createdAt).toISOString(),
      workspacePath,
    });

    // Don't start polling immediately - wait a bit for the conversation to start
    const initialDelay = 2000; // 2 seconds

    const startPolling = () => {
      console.log('[useSessionIdMatcher] Starting polling after initial delay');
      // Clear any existing interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      // Poll every 2 seconds for up to 60 seconds (to allow time for conversation to start)
      const maxAttempts = 30;
      let attempts = 0;

      pollingIntervalRef.current = setInterval(async () => {
        attempts++;
        console.log(`[useSessionIdMatcher] Polling attempt ${attempts}/${maxAttempts}`);

        // Stop after max attempts
        if (attempts > maxAttempts) {
          console.log('[useSessionIdMatcher] Max attempts reached - stopping');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          return;
        }

        // Skip if already matched
        if (matchedSessionIdRef.current) {
          console.log('[useSessionIdMatcher] Already matched during polling:', matchedSessionIdRef.current);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          return;
        }

        try {
          const codingAgentAPI = (window as unknown as {
            codingAgentAPI?: {
              listSessionSummaries: (
                agentType: string,
                filter?: { lookbackDays?: number; sinceTimestamp?: number }
              ) => Promise<SessionSummary[]>;
            };
          }).codingAgentAPI;

          if (!codingAgentAPI) {
            console.warn('[useSessionIdMatcher] Coding agent API not available');
            return;
          }

          // Look for sessions created around the time of agent creation
          // Use 30 second buffer before agent creation to catch any timing edge cases
          // Sessions are typically created AFTER agent starts, but we want to be safe
          const sinceTimestamp = createdAt - 30000; // 30 second buffer before agent creation
          console.log('[useSessionIdMatcher] Fetching sessions since:', new Date(sinceTimestamp).toISOString(), {
            agentCreatedAt: new Date(createdAt).toISOString(),
            bufferSeconds: 30,
          });

          const sessions = await codingAgentAPI.listSessionSummaries('claude_code', {
            lookbackDays: 1, // Only look at recent sessions
            sinceTimestamp,
          });

          console.log(`[useSessionIdMatcher] Found ${sessions.length} sessions:`, sessions.map(s => ({
            id: s.id,
            projectPath: s.projectPath,
            updatedAt: s.updatedAt,
            timestamp: s.timestamp,
          })));

          // Find matching session
          const match = findMatchingSession(sessions, createdAt, workspacePath);

          if (match) {
            console.log('[useSessionIdMatcher] ✅ Match found!', {
              sessionId: match.id,
              projectPath: match.projectPath,
              updatedAt: match.updatedAt,
              timeDiff: Math.abs(new Date(match.updatedAt).getTime() - createdAt),
            });
            matchedSessionIdRef.current = match.id;
            onSessionIdFound(match.id);

            // Stop polling once matched
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
          } else {
            console.log('[useSessionIdMatcher] No match found in this polling cycle');
          }
        } catch (error) {
          console.error('[useSessionIdMatcher] Error fetching sessions:', error);
        }
      }, 2000); // Poll every 2 seconds
    };

    // Start polling after initial delay
    const timeoutId = setTimeout(startPolling, initialDelay);

    return () => {
      console.log('[useSessionIdMatcher] Cleaning up');
      clearTimeout(timeoutId);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [enabled, createdAt, workspacePath, agentId, onSessionIdFound]);

  // Reset matched session ID when agentId changes
  useEffect(() => {
    matchedSessionIdRef.current = null;
  }, [agentId]);
}

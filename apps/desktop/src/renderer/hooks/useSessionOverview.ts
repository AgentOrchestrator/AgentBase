/**
 * useSessionOverview Hook
 *
 * Unified hook for session overview data management.
 * Consolidates title, most recent message, status, and summary retrieval.
 * Replaces individual sync mechanisms (useAutoTitleFromSession, direct status subscriptions).
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { CodingAgentType, CodingAgentMessage } from '@agent-orchestrator/shared';
import type { CodingAgentStatusInfo } from '../../../types/coding-agent-status';
import type { IAgentService } from '../context/node-services/types';
import { useSessionFileWatcher } from './useSessionFileWatcher';
import { createStatusService } from '../services/status';

// =============================================================================
// Types
// =============================================================================

export interface UseSessionOverviewOptions {
  /** Session ID to watch */
  sessionId?: string;
  /** Workspace path for session lookup */
  workspacePath?: string;
  /** Agent service for fetching session data and generating summary */
  agentService: IAgentService;
  /** Agent type for file watching */
  agentType: string;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
}

export interface SessionOverviewState {
  /** Title extracted from first user message */
  title: string | null;
  /** Most recent user message content */
  mostRecentUserMessage: string | null;
  /** Current agent status (from status service) */
  status: CodingAgentStatusInfo | null;
  /** AI-generated summary of agent purpose (max 10 words) */
  summary: string | null;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Whether initial data has been loaded */
  isLoaded: boolean;
}

export interface UseSessionOverviewReturn extends SessionOverviewState {
  /** Manually reload session data */
  reload: () => Promise<void>;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_TITLE_LENGTH = 50;
const SUMMARY_MAX_WORDS = 10;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract title from the first user message.
 */
function extractTitle(messages: CodingAgentMessage[]): string | null {
  const userMessages = messages.filter((m) => m.role === 'user');
  const firstUserMessage = userMessages[0];
  if (!firstUserMessage?.content) return null;

  const content = firstUserMessage.content.trim();
  return content.length > MAX_TITLE_LENGTH
    ? content.slice(0, MAX_TITLE_LENGTH) + '...'
    : content;
}

/**
 * Extract most recent user message.
 */
function extractMostRecentUserMessage(messages: CodingAgentMessage[]): string | null {
  const userMessages = messages.filter((m) => m.role === 'user');
  const lastUserMessage = userMessages[userMessages.length - 1];
  return lastUserMessage?.content?.trim() ?? null;
}

/**
 * Build prompt for summary generation.
 */
function buildSummaryPrompt(userMessages: CodingAgentMessage[]): string {
  const first2Messages = userMessages.slice(0, 2);
  const messagesText = first2Messages
    .map((m) => m.content?.trim())
    .filter(Boolean)
    .join(' | ');

  return `Summarize the purpose of this coding task in exactly ${SUMMARY_MAX_WORDS} words or fewer. Be concise and specific. Only output the summary, nothing else.

User messages:
${messagesText}`;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Unified hook for session overview data.
 *
 * Manages:
 * - Title (from first user message)
 * - Most recent user message
 * - Status (via IStatusService)
 * - Summary (AI-generated, separate session)
 *
 * Listens to FileWatcher events and reloads on session file changes.
 */
export function useSessionOverview({
  sessionId,
  workspacePath,
  agentService,
  agentType,
  enabled = true,
}: UseSessionOverviewOptions): UseSessionOverviewReturn {
  // State
  const [title, setTitle] = useState<string | null>(null);
  const [mostRecentUserMessage, setMostRecentUserMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<CodingAgentStatusInfo | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Refs for preventing concurrent operations
  const isLoadingRef = useRef(false);
  const isSummaryGeneratingRef = useRef(false);
  const loadedSessionIdRef = useRef<string | null>(null);
  const summaryGeneratedForRef = useRef<string | null>(null);

  // Create status service (memoized to avoid recreating on each render)
  // Returns null if sessionId/workspacePath not available yet
  const statusService = useMemo(() => {
    if (!sessionId || !workspacePath) {
      return null;
    }
    return createStatusService(agentService, sessionId, workspacePath);
  }, [agentService, sessionId, workspacePath]);

  // Refs to keep latest values without causing re-renders
  const agentServiceRef = useRef(agentService);
  const sessionIdRef = useRef(sessionId);
  const workspacePathRef = useRef(workspacePath);
  const enabledRef = useRef(enabled);
  const statusServiceRef = useRef(statusService);

  // Keep refs in sync
  useEffect(() => {
    agentServiceRef.current = agentService;
    sessionIdRef.current = sessionId;
    workspacePathRef.current = workspacePath;
    enabledRef.current = enabled;
    statusServiceRef.current = statusService;
  });

  // =========================================================================
  // Load Session Data
  // =========================================================================

  const loadSessionData = useCallback(async () => {
    const currentSessionId = sessionIdRef.current;
    const currentWorkspacePath = workspacePathRef.current;
    const currentEnabled = enabledRef.current;
    const currentAgentService = agentServiceRef.current;

    if (!currentSessionId || !currentWorkspacePath || !currentEnabled) {
      return;
    }

    // Prevent concurrent loads
    if (isLoadingRef.current) {
      return;
    }

    isLoadingRef.current = true;
    setIsLoading(true);

    try {
      const session = await currentAgentService.getSession(currentSessionId, currentWorkspacePath, {
        roles: ['user', 'assistant'],
      });

      if (session?.messages) {
        const messages = session.messages as CodingAgentMessage[];

        // Extract title from first user message
        const extractedTitle = extractTitle(messages);
        setTitle(extractedTitle);

        // Extract most recent user message
        const recentMessage = extractMostRecentUserMessage(messages);
        setMostRecentUserMessage(recentMessage);

        // Update last activity timestamp for idle detection
        if (messages.length > 0) {
          const latestMsg = messages[messages.length - 1];
          const latestTimestamp = new Date(latestMsg.timestamp).getTime();
          statusServiceRef.current?.setLastActivity(latestTimestamp);
        }

        // Track loaded session
        loadedSessionIdRef.current = currentSessionId;
      }

      setIsLoaded(true);
    } catch (error) {
      console.error('[useSessionOverview] Failed to load session data:', error);
      setIsLoaded(true); // Mark as loaded to avoid retry loops
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, []); // No dependencies - uses refs

  // =========================================================================
  // Generate Summary
  // =========================================================================

  const generateSummary = useCallback(async () => {
    const currentSessionId = sessionIdRef.current;
    const currentWorkspacePath = workspacePathRef.current;
    const currentEnabled = enabledRef.current;
    const currentAgentService = agentServiceRef.current;

    if (!currentSessionId || !currentWorkspacePath || !currentEnabled) {
      return;
    }

    // Prevent duplicate generation for same session
    if (summaryGeneratedForRef.current === currentSessionId) {
      return;
    }

    // Prevent concurrent generation
    if (isSummaryGeneratingRef.current) {
      return;
    }

    isSummaryGeneratingRef.current = true;

    try {
      // Fetch session to get user messages
      const session = await currentAgentService.getSession(currentSessionId, currentWorkspacePath, {
        roles: ['user'],
      });

      if (!session?.messages || session.messages.length === 0) {
        return;
      }

      const userMessages = session.messages as CodingAgentMessage[];

      // Need at least 1 user message for summary
      if (userMessages.length === 0) {
        return;
      }

      // Build prompt from first 2 user messages
      const prompt = buildSummaryPrompt(userMessages);

      // Generate summary using a separate session ID to avoid polluting chat history
      const summarySessionId = crypto.randomUUID();

      console.log('[useSessionOverview] Generating summary for session:', currentSessionId);

      const response = await currentAgentService.sendMessage(
        prompt,
        currentWorkspacePath,
        summarySessionId
      );

      if (response?.content) {
        // Clean up the summary - take first line, trim whitespace
        const cleanSummary = response.content
          .split('\n')[0]
          .trim()
          .slice(0, 100); // Safety limit

        setSummary(cleanSummary);
        summaryGeneratedForRef.current = currentSessionId;

        console.log('[useSessionOverview] Summary generated:', cleanSummary);
      }
    } catch (error) {
      console.error('[useSessionOverview] Failed to generate summary:', error);
    } finally {
      isSummaryGeneratingRef.current = false;
    }
  }, []); // No dependencies - uses refs

  // =========================================================================
  // Status Subscription
  // =========================================================================

  useEffect(() => {
    if (!enabled || !statusService) {
      return;
    }

    // Get initial status
    const initialStatus = statusService.getStatus(agentService.agentId);
    setStatus(initialStatus);

    // Refresh last activity timestamp for time-based idle detection
    void statusService.refreshLastActivity();

    // Subscribe to status changes
    const unsubscribe = statusService.onStatusChange(
      (_agentId, _oldStatus, newStatus) => {
        setStatus(newStatus);
      }
    );

    return unsubscribe;
  }, [statusService, agentService.agentId, enabled]);

  // =========================================================================
  // Initial Load
  // =========================================================================

  useEffect(() => {
    if (!enabled || !sessionId || !workspacePath) {
      return;
    }

    // Track if effect is still mounted (handles React Strict Mode double-invoke)
    let isMounted = true;

    // Reset state if session changes
    if (loadedSessionIdRef.current !== sessionId) {
      setIsLoaded(false);
      loadedSessionIdRef.current = null;
    }

    // Only load if still mounted and not already loading
    if (isMounted && !isLoadingRef.current) {
      void loadSessionData();
    }

    return () => {
      isMounted = false;
    };
  }, [enabled, sessionId, workspacePath, loadSessionData]);

  // =========================================================================
  // Summary Generation (triggered after initial load)
  // =========================================================================

  useEffect(() => {
    if (!isLoaded || !sessionId || summaryGeneratedForRef.current === sessionId) {
      return;
    }

    // Track if effect is still mounted (handles React Strict Mode double-invoke)
    let isMounted = true;

    // Delay summary generation slightly to prioritize UI updates
    const timeoutId = setTimeout(() => {
      // Only proceed if still mounted and not already generating
      if (isMounted && !isSummaryGeneratingRef.current) {
        void generateSummary();
      }
    }, 1000);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [isLoaded, sessionId, generateSummary]);

  // =========================================================================
  // FileWatcher Integration
  // =========================================================================

  // Stable callback for file watcher - uses refs internally
  const handleSessionChange = useCallback(
    (event: { type: string }) => {
      if (event.type === 'created' || event.type === 'updated') {
        console.log('[useSessionOverview] Session file changed, reloading:', event.type);
        // Reset loaded ref to force reload
        loadedSessionIdRef.current = null;
        setIsLoaded(false);
        void loadSessionData();
      }
    },
    [loadSessionData]
  );

  useSessionFileWatcher({
    agentType: agentType as CodingAgentType,
    sessionId,
    onSessionChange: handleSessionChange,
    enabled: enabled && !!sessionId,
    debounceMs: 300,
  });

  // =========================================================================
  // Manual Reload
  // =========================================================================

  const reload = useCallback(async () => {
    loadedSessionIdRef.current = null;
    setIsLoaded(false);
    await loadSessionData();
  }, [loadSessionData]);

  // =========================================================================
  // Return
  // =========================================================================

  return {
    title,
    mostRecentUserMessage,
    status,
    summary,
    isLoading,
    isLoaded,
    reload,
  };
}

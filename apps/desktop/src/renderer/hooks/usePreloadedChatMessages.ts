/**
 * usePreloadedChatMessages Hook
 *
 * Preloads chat messages at the AgentNode level so they're ready
 * when switching to chat view. This eliminates the delay when toggling views.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CodingAgentMessage } from '@agent-orchestrator/shared';
import type { IAgentService } from '../context/node-services';

export interface UsePreloadedChatMessagesOptions {
  /** Session ID to load messages for */
  sessionId: string | undefined;
  /** Workspace path for session lookup */
  workspacePath: string | undefined;
  /** Agent service for fetching session data */
  agentService: IAgentService;
  /** Whether preloading is enabled (default: true) */
  enabled?: boolean;
}

export interface UsePreloadedChatMessagesReturn {
  /** Preloaded messages (empty array if not loaded yet) */
  messages: CodingAgentMessage[];
  /** Whether messages are currently loading */
  isLoading: boolean;
  /** Whether messages have been loaded at least once */
  isLoaded: boolean;
  /** Update messages (for when chat view adds new messages) */
  setMessages: (messages: CodingAgentMessage[]) => void;
  /** Reload messages from session file */
  reload: () => Promise<void>;
}

/**
 * Hook that preloads chat messages when the node mounts,
 * regardless of which view is active.
 */
export function usePreloadedChatMessages({
  sessionId,
  workspacePath,
  agentService,
  enabled = true,
}: UsePreloadedChatMessagesOptions): UsePreloadedChatMessagesReturn {
  const [messages, setMessages] = useState<CodingAgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const loadedSessionIdRef = useRef<string | null>(null);

  const loadMessages = useCallback(async () => {
    if (!sessionId || !workspacePath || !enabled) {
      return;
    }

    // Skip if already loaded for this session
    if (loadedSessionIdRef.current === sessionId && isLoaded) {
      return;
    }

    setIsLoading(true);

    try {
      const session = await agentService.getSession(sessionId, workspacePath, {
        roles: ['user', 'assistant'],
      });

      if (session?.messages) {
        setMessages(session.messages as CodingAgentMessage[]);
        loadedSessionIdRef.current = sessionId;
      }
      setIsLoaded(true);
    } catch (err) {
      console.error('[usePreloadedChatMessages] Failed to load messages:', err);
      setIsLoaded(true); // Mark as loaded even on error to avoid retry loops
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, workspacePath, agentService, enabled, isLoaded]);

  // Load messages on mount and when session changes
  useEffect(() => {
    if (!enabled || !sessionId || !workspacePath) {
      return;
    }

    // Reset loaded state if session changes
    if (loadedSessionIdRef.current !== sessionId) {
      setIsLoaded(false);
      loadedSessionIdRef.current = null;
    }

    void loadMessages();
  }, [enabled, sessionId, workspacePath, loadMessages]);

  const reload = useCallback(async () => {
    loadedSessionIdRef.current = null;
    setIsLoaded(false);
    await loadMessages();
  }, [loadMessages]);

  return {
    messages,
    isLoading,
    isLoaded,
    setMessages,
    reload,
  };
}

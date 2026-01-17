/**
 * useAutoTitleFromSession
 *
 * Hook that watches session file changes and automatically updates the node title
 * to the last user message in the session.
 */

import type { CodingAgentType } from '@agent-orchestrator/shared';
import { useCallback, useEffect, useRef } from 'react';
import type { IAgentService } from '../context';
import { useSessionFileWatcher } from './useSessionFileWatcher';

interface UseAutoTitleFromSessionOptions {
  /** Session ID to watch */
  sessionId?: string;
  /** Workspace path for session lookup */
  workspacePath?: string;
  /** Agent service for loading sessions */
  agentService: IAgentService;
  /** Agent type */
  agentType: string;
  /** Callback to update title */
  onTitleChange: (newTitle: string) => void;
}

const MAX_TITLE_LENGTH = 50;

/**
 * Hook to automatically update node title from the last user message in session.
 * Watches for session file changes and updates title whenever the file is created or updated.
 */
export function useAutoTitleFromSession({
  sessionId,
  workspacePath,
  agentService,
  agentType,
  onTitleChange,
}: UseAutoTitleFromSessionOptions): void {
  const hasCheckedRef = useRef(false);
  const currentTitleRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);

  // Function to extract and update title from session
  const updateTitleFromSession = useCallback(async () => {
    if (!sessionId || !workspacePath) {
      return;
    }

    // Prevent concurrent loads
    if (isLoadingRef.current) {
      return;
    }
    isLoadingRef.current = true;

    try {
      console.log('[useAutoTitleFromSession] Loading session for title update:', {
        sessionId,
        workspacePath,
      });

      const session = await agentService.getSession(sessionId, workspacePath, {
        roles: ['user'],
      });

      if (session?.messages && session.messages.length > 0) {
        // Get all user messages and take the last one
        const userMessages = session.messages.filter((m) => m.role === 'user');
        const lastUserMessage = userMessages[userMessages.length - 1];

        if (lastUserMessage?.content) {
          const content = lastUserMessage.content.trim();
          const newTitle =
            content.length > MAX_TITLE_LENGTH
              ? `${content.slice(0, MAX_TITLE_LENGTH)}...`
              : content;

          // Only call onTitleChange if title actually changed
          if (newTitle !== currentTitleRef.current) {
            console.log('[useAutoTitleFromSession] Updating title from session:', {
              sessionId,
              newTitle,
              previousTitle: currentTitleRef.current,
              messageCount: session.messages.length,
              userMessageCount: userMessages.length,
            });
            currentTitleRef.current = newTitle;
            onTitleChange(newTitle);
          } else {
            console.log('[useAutoTitleFromSession] Title unchanged, skipping update');
          }
        } else {
          console.log('[useAutoTitleFromSession] Last user message has no content');
        }
      } else {
        console.log('[useAutoTitleFromSession] No messages found in session');
      }
    } catch (error) {
      // Session not found yet, will retry on next event
      console.log('[useAutoTitleFromSession] Session not found yet:', error);
    } finally {
      isLoadingRef.current = false;
    }
  }, [sessionId, workspacePath, agentService, onTitleChange]);

  // Check on initial mount if session already exists
  useEffect(() => {
    if (!sessionId || !workspacePath || hasCheckedRef.current) {
      return;
    }

    // Small delay to ensure agent service is ready
    const timeoutId = setTimeout(() => {
      hasCheckedRef.current = true;
      console.log('[useAutoTitleFromSession] Initial check for existing session');
      void updateTitleFromSession();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [sessionId, workspacePath, updateTitleFromSession]);

  // Watch for session file changes (deduplication handled by useSessionFileWatcher)
  useSessionFileWatcher({
    agentType: agentType as CodingAgentType,
    sessionId: sessionId ?? undefined,
    onSessionChange: useCallback(
      (event) => {
        // Update title on both created and updated events
        if (event.type === 'created' || event.type === 'updated') {
          console.log('[useAutoTitleFromSession] Session file changed, updating title:', {
            type: event.type,
            sessionId: event.sessionId,
            filePath: event.filePath,
          });
          // Reset check flag so we always update
          hasCheckedRef.current = false;
          void updateTitleFromSession();
        }
      },
      [updateTitleFromSession]
    ),
    enabled: !!sessionId && !!workspacePath,
    debounceMs: 300,
  });
}

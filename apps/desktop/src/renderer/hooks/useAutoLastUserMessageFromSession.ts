/**
 * useAutoLastUserMessageFromSession
 *
 * Hook that watches session file changes and automatically updates the node lastUserMessage
 * to the last user message in the session.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { CodingAgentType } from '@agent-orchestrator/shared';
import { useSessionFileWatcher } from './useSessionFileWatcher';
import type { IAgentService } from '../context';

interface UseAutoLastUserMessageFromSessionOptions {
  /** Session ID to watch */
  sessionId?: string;
  /** Workspace path for session lookup */
  workspacePath?: string;
  /** Agent service for loading sessions */
  agentService: IAgentService;
  /** Agent type */
  agentType: string;
  /** Callback to update lastUserMessage */
  onLastUserMessageChange: (newLastUserMessage: string) => void;
}

const MAX_LAST_USER_MESSAGE_LENGTH = 200;

/**
 * Hook to automatically update node lastUserMessage from the last user message in session.
 * Watches for session file changes and updates lastUserMessage whenever the file is created or updated.
 */
export function useAutoLastUserMessageFromSession({
  sessionId,
  workspacePath,
  agentService,
  agentType,
  onLastUserMessageChange,
}: UseAutoLastUserMessageFromSessionOptions): void {
  const hasCheckedRef = useRef(false);

  // Function to extract and update lastUserMessage from session
  const updateLastUserMessageFromSession = useCallback(async () => {
    if (!sessionId || !workspacePath) {
      return;
    }

    try {
      console.log('[useAutoLastUserMessageFromSession] Loading session for lastUserMessage update:', {
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
          const newLastUserMessage =
            content.length > MAX_LAST_USER_MESSAGE_LENGTH
              ? content.slice(0, MAX_LAST_USER_MESSAGE_LENGTH) + '...'
              : content;

          console.log('[useAutoLastUserMessageFromSession] Updating lastUserMessage from session:', {
            sessionId,
            newLastUserMessage: newLastUserMessage.substring(0, 50) + '...',
            messageCount: session.messages.length,
            userMessageCount: userMessages.length,
          });
          onLastUserMessageChange(newLastUserMessage);
        } else {
          console.log('[useAutoLastUserMessageFromSession] Last user message has no content');
        }
      } else {
        console.log('[useAutoLastUserMessageFromSession] No messages found in session');
      }
    } catch (error) {
      // Session not found yet, will retry on next event
      console.log('[useAutoLastUserMessageFromSession] Session not found yet:', error);
    }
  }, [sessionId, workspacePath, agentService, onLastUserMessageChange]);

  // Check on initial mount if session already exists
  useEffect(() => {
    if (!sessionId || !workspacePath || hasCheckedRef.current) {
      return;
    }

    // Small delay to ensure agent service is ready
    const timeoutId = setTimeout(() => {
      hasCheckedRef.current = true;
      console.log('[useAutoLastUserMessageFromSession] Initial check for existing session');
      void updateLastUserMessageFromSession();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [sessionId, workspacePath, updateLastUserMessageFromSession]);

  // Watch for session file changes
  useSessionFileWatcher({
    agentType: agentType as CodingAgentType,
    sessionId: sessionId ?? undefined,
    onSessionChange: useCallback(
      (event) => {
        // Update lastUserMessage on both created and updated events
        if (event.type === 'created' || event.type === 'updated') {
          console.log('[useAutoLastUserMessageFromSession] Session file changed, updating lastUserMessage:', {
            type: event.type,
            sessionId: event.sessionId,
            filePath: event.filePath,
          });
          // Reset check flag so we always update
          hasCheckedRef.current = false;
          void updateLastUserMessageFromSession();
        }
      },
      [updateLastUserMessageFromSession]
    ),
    enabled: !!sessionId && !!workspacePath,
  });
}

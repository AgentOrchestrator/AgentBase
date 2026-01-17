/**
 * useAutoSummaryFromSession
 *
 * Hook that watches session file changes and automatically updates the node summary
 * to the last assistant message in the session.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { CodingAgentType } from '@agent-orchestrator/shared';
import { useSessionFileWatcher } from './useSessionFileWatcher';
import type { IAgentService } from '../context';

interface UseAutoSummaryFromSessionOptions {
  /** Session ID to watch */
  sessionId?: string;
  /** Workspace path for session lookup */
  workspacePath?: string;
  /** Agent service for loading sessions */
  agentService: IAgentService;
  /** Agent type */
  agentType: string;
  /** Callback to update summary */
  onSummaryChange: (newSummary: string) => void;
}

const MAX_SUMMARY_LENGTH = 200;

/**
 * Hook to automatically update node summary from the last assistant message in session.
 * Watches for session file changes and updates summary whenever the file is created or updated.
 */
export function useAutoSummaryFromSession({
  sessionId,
  workspacePath,
  agentService,
  agentType,
  onSummaryChange,
}: UseAutoSummaryFromSessionOptions): void {
  const hasCheckedRef = useRef(false);

  // Keep callback ref updated to avoid stale closures (same pattern as useSessionFileWatcher)
  const onSummaryChangeRef = useRef(onSummaryChange);
  useEffect(() => {
    onSummaryChangeRef.current = onSummaryChange;
  }, [onSummaryChange]);

  // Function to extract and update summary from session
  const updateSummaryFromSession = useCallback(async () => {
    if (!sessionId || !workspacePath) {
      return;
    }

    try {
      console.log('[useAutoSummaryFromSession] Loading session for summary update:', {
        sessionId,
        workspacePath,
      });

      const session = await agentService.getSession(sessionId, workspacePath, {
        roles: ['assistant'],
      });

      console.log('[useAutoSummaryFromSession] Session loaded:', {
        sessionId,
        hasMessages: !!session?.messages,
        messageCount: session?.messages?.length ?? 0,
        allRoles: session?.messages?.map((m) => m.role) ?? [],
      });

      if (session?.messages && session.messages.length > 0) {
        // Get all assistant messages and take the last one
        const assistantMessages = session.messages.filter((m) => m.role === 'assistant');
        const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];

        console.log('[useAutoSummaryFromSession] Assistant messages:', {
          assistantMessageCount: assistantMessages.length,
          lastMessageContent: lastAssistantMessage?.content?.substring(0, 100) ?? 'NO CONTENT',
          lastMessageRole: lastAssistantMessage?.role ?? 'NO ROLE',
        });

        if (lastAssistantMessage?.content) {
          const content = lastAssistantMessage.content.trim();
          const newSummary =
            content.length > MAX_SUMMARY_LENGTH
              ? content.slice(0, MAX_SUMMARY_LENGTH) + '...'
              : content;

          console.log('[useAutoSummaryFromSession] Updating summary from session:', {
            sessionId,
            newSummary: newSummary.substring(0, 50) + '...',
            messageCount: session.messages.length,
            assistantMessageCount: assistantMessages.length,
          });
          // Use ref to always call the latest callback
          onSummaryChangeRef.current(newSummary);
        } else {
          console.log('[useAutoSummaryFromSession] Last assistant message has no content');
        }
      } else {
        console.log('[useAutoSummaryFromSession] No messages found in session');
      }
    } catch (error) {
      // Session not found yet, will retry on next event
      console.log('[useAutoSummaryFromSession] Session not found yet:', error);
    }
  }, [sessionId, workspacePath, agentService]); // Removed onSummaryChange - using ref instead

  // Check on initial mount if session already exists
  useEffect(() => {
    if (!sessionId || !workspacePath || hasCheckedRef.current) {
      return;
    }

    // Small delay to ensure agent service is ready
    const timeoutId = setTimeout(() => {
      hasCheckedRef.current = true;
      console.log('[useAutoSummaryFromSession] Initial check for existing session');
      void updateSummaryFromSession();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [sessionId, workspacePath, updateSummaryFromSession]);

  // Watch for session file changes
  useSessionFileWatcher({
    agentType: agentType as CodingAgentType,
    sessionId: sessionId ?? undefined,
    onSessionChange: useCallback(
      (event) => {
        // Update summary on both created and updated events
        if (event.type === 'created' || event.type === 'updated') {
          console.log('[useAutoSummaryFromSession] Session file changed, updating summary:', {
            type: event.type,
            sessionId: event.sessionId,
            filePath: event.filePath,
          });
          // Reset check flag so we always update
          hasCheckedRef.current = false;
          void updateSummaryFromSession();
        }
      },
      [updateSummaryFromSession]
    ),
    enabled: !!sessionId && !!workspacePath,
  });
}

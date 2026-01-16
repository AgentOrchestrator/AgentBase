/**
 * useChatSession Hook
 *
 * Encapsulates chat logic for AgentChatNode.
 * Handles message sending, streaming, and history loading via IAgentService.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { CodingAgentType } from '../../../../main/services/coding-agent';
import type { CodingAgentMessage } from '@agent-orchestrator/shared';
import { useSessionFileWatcher } from '../../../hooks/useSessionFileWatcher';
import type { IAgentService } from '../../../context/node-services';

interface UseChatSessionOptions {
  agentType: string;
  sessionId?: string;
  currentMessages?: CodingAgentMessage[];
  autoLoadHistory?: boolean;
  onMessagesUpdate: (messages: CodingAgentMessage[]) => void;
  onSessionCreated: (sessionId: string) => void;
  onError: (error: string) => void;
  /** Agent service for all session operations (required) */
  agentService: IAgentService;
}

export function useChatSession({
  agentType,
  sessionId,
  currentMessages,
  autoLoadHistory = true,
  onMessagesUpdate,
  onSessionCreated,
  onError,
  agentService,
}: UseChatSessionOptions) {

  const [isStreaming, setIsStreaming] = useState(false);
  const messagesRef = useRef<CodingAgentMessage[]>([]);
  const loadedSessionIdRef = useRef<string | null>(null);
  const isLoadingHistoryRef = useRef(false);

  const resolvedAgentType = agentType as CodingAgentType;

  useEffect(() => {
    if (currentMessages) {
      messagesRef.current = currentMessages;
    }
  }, [currentMessages]);

  const publishMessages = useCallback(
    (nextMessages: CodingAgentMessage[], sessionOverride?: string) => {
      messagesRef.current = nextMessages;
      const resolvedSessionId = sessionOverride ?? sessionId ?? null;
      if (resolvedSessionId) {
        loadedSessionIdRef.current = resolvedSessionId;
      }
      onMessagesUpdate([...nextMessages]);
    },
    [onMessagesUpdate, sessionId]
  );

  const loadSessionHistory = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    if (isLoadingHistoryRef.current) {
      return;
    }

    isLoadingHistoryRef.current = true;

    try {
      const session = await agentService.getSession(sessionId, { roles: ['user', 'assistant'] });

      if (session?.messages) {
        // Cast messages to shared type (adapter type is compatible but uses string for messageType)
        publishMessages(session.messages as CodingAgentMessage[], sessionId);
      }
      // If session not found, don't show error - sendMessage will create a new session
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      isLoadingHistoryRef.current = false;
    }
  }, [agentService, sessionId, onError, publishMessages]);

  useEffect(() => {
    if (!autoLoadHistory || !sessionId) {
      return;
    }

    if (loadedSessionIdRef.current === sessionId) {
      return;
    }

    if (currentMessages && currentMessages.length > 0 && !loadedSessionIdRef.current) {
      loadedSessionIdRef.current = sessionId;
      return;
    }

    void loadSessionHistory();
  }, [autoLoadHistory, sessionId, currentMessages?.length, loadSessionHistory]);

  // Watch for external changes to the session file (e.g., from terminal view)
  // This enables real-time synchronization between terminal and chat views
  useSessionFileWatcher({
    agentType: resolvedAgentType,
    sessionId: sessionId ?? undefined,
    onSessionChange: useCallback(
      (event) => {
        // Only reload on updates (not creates/deletes), and not while we're streaming
        if (event.type === 'updated' && !isStreaming) {
          console.log('[useChatSession] Session file updated externally, reloading history');
          void loadSessionHistory();
        }
      },
      [isStreaming, loadSessionHistory]
    ),
    enabled: autoLoadHistory && !!sessionId,
  });

  const sendMessage = useCallback(async (prompt: string) => {
    setIsStreaming(true);

    // Add user message
    const userMessage: CodingAgentMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
      messageType: 'user',
    };
    messagesRef.current = [...messagesRef.current, userMessage];
    publishMessages([...messagesRef.current]);

    // Create placeholder assistant message
    let assistantContent = '';
    const assistantMessage: CodingAgentMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      messageType: 'assistant',
    };
    messagesRef.current = [...messagesRef.current, assistantMessage];
    publishMessages([...messagesRef.current]);

    try {
      let result;

      const handleChunk = (chunk: string) => {
        assistantContent += chunk;
        // Update last message with new content
        const updatedMessages = [
          ...messagesRef.current.slice(0, -1),
          { ...assistantMessage, content: assistantContent },
        ];
        publishMessages(updatedMessages);
      };

      // Check if session is active and resume or start new
      const isActive = sessionId ? await agentService.isSessionActive(sessionId) : false;

      if (isActive && sessionId) {
        // Resume existing session
        result = await agentService.resumeSessionStreaming(sessionId, prompt, handleChunk);
      } else {
        // Start new session
        result = await agentService.sendMessageStreaming(prompt, handleChunk);

        // Capture session ID from response
        if (result.sessionId) {
          loadedSessionIdRef.current = result.sessionId;
          onSessionCreated(result.sessionId);
        }
      }

      // Final update with complete content
      const finalMessages = [
        ...messagesRef.current.slice(0, -1),
        { ...assistantMessage, content: result?.content || assistantContent },
      ];
      publishMessages(finalMessages);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to send message');
      // Remove incomplete assistant message on error
      messagesRef.current = messagesRef.current.slice(0, -1);
      publishMessages([...messagesRef.current]);
    } finally {
      setIsStreaming(false);
    }
  }, [agentService, sessionId, publishMessages, onSessionCreated, onError]);

  return {
    sendMessage,
    isStreaming,
  };
}

/**
 * useChatSession Hook
 *
 * Encapsulates chat logic for AgentChatNode.
 * Handles message sending, streaming, and history loading via codingAgentAPI.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { CodingAgentAPI, CodingAgentType } from '../../../../main/services/coding-agent';
import type { CodingAgentMessage } from '@agent-orchestrator/shared';

interface UseChatSessionOptions {
  agentId?: string;
  agentType: string;
  sessionId?: string;
  workspacePath?: string;
  currentMessages?: CodingAgentMessage[];
  autoLoadHistory?: boolean;
  onMessagesUpdate: (messages: CodingAgentMessage[]) => void;
  onSessionCreated: (sessionId: string) => void;
  onError: (error: string) => void;
}

export function useChatSession({
  agentId,
  agentType,
  sessionId,
  workspacePath,
  currentMessages,
  autoLoadHistory = true,
  onMessagesUpdate,
  onSessionCreated,
  onError,
}: UseChatSessionOptions) {
  console.log('useChatSession called with sessionId:', sessionId);

  const [isStreaming, setIsStreaming] = useState(false);
  const messagesRef = useRef<CodingAgentMessage[]>([]);
  const loadedSessionIdRef = useRef<string | null>(null);
  const isLoadingHistoryRef = useRef(false);

  const codingAgentAPI = (window as unknown as { codingAgentAPI?: CodingAgentAPI }).codingAgentAPI;
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
    if (!codingAgentAPI) {
      onError('Coding agent API not available');
      return;
    }

    if (!sessionId) {
      return;
    }

    if (isLoadingHistoryRef.current) {
      return;
    }

    isLoadingHistoryRef.current = true;

    try {
      const session = await codingAgentAPI.getSession(
        resolvedAgentType,
        sessionId,
        { roles: ['user', 'assistant'] }
      );

      if (session?.messages) {
        publishMessages(session.messages, sessionId);
      } else {
        onError('Session not found');
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      isLoadingHistoryRef.current = false;
    }
  }, [codingAgentAPI, resolvedAgentType, sessionId, onError, publishMessages]);

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

  const sendMessage = useCallback(async (prompt: string) => {
    if (!codingAgentAPI) {
      onError('Coding agent API not available');
      return;
    }

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

      if (sessionId) {
        // Continue existing session
        result = await codingAgentAPI.continueSessionStreaming(
          resolvedAgentType,
          { type: 'id', value: sessionId },
          prompt,
          handleChunk,
          { workingDirectory: workspacePath, agentId }
        );
      } else {
        // Start new session
        result = await codingAgentAPI.generateStreaming(
          resolvedAgentType,
          { prompt, workingDirectory: workspacePath, agentId },
          handleChunk
        );

        // Capture session ID
        if (result.sessionId) {
          loadedSessionIdRef.current = result.sessionId;
          onSessionCreated(result.sessionId);
        }
      }

      // Final update with complete content
      const finalMessages = [
        ...messagesRef.current.slice(0, -1),
        { ...assistantMessage, content: result.content || assistantContent },
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
  }, [codingAgentAPI, agentId, agentType, sessionId, workspacePath, publishMessages, onSessionCreated, onError]);

  return {
    sendMessage,
    isStreaming,
  };
}

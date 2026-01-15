/**
 * useChatSession Hook
 *
 * Encapsulates chat logic for AgentChatNode.
 * Handles message sending, streaming, and history loading via codingAgentAPI.
 */

import { useState, useCallback, useRef } from 'react';
import type { CodingAgentAPI, CodingAgentType } from '../../../../main/services/coding-agent';
import type { CodingAgentMessage } from '@agent-orchestrator/shared';

interface UseChatSessionOptions {
  agentType: string;
  sessionId?: string;
  workspacePath?: string;
  onMessagesUpdate: (messages: CodingAgentMessage[]) => void;
  onSessionCreated: (sessionId: string) => void;
  onError: (error: string) => void;
}

export function useChatSession({
  agentType,
  sessionId,
  workspacePath,
  onMessagesUpdate,
  onSessionCreated,
  onError,
}: UseChatSessionOptions) {
  console.log('useChatSession called with sessionId:', sessionId);

  const [isStreaming, setIsStreaming] = useState(false);
  const messagesRef = useRef<CodingAgentMessage[]>([]);

  const codingAgentAPI = (window as unknown as { codingAgentAPI?: CodingAgentAPI }).codingAgentAPI;
  const resolvedAgentType = agentType as CodingAgentType;

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
    onMessagesUpdate([...messagesRef.current]);

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
    onMessagesUpdate([...messagesRef.current]);

    try {
      let result;

      const handleChunk = (chunk: string) => {
        assistantContent += chunk;
        // Update last message with new content
        const updatedMessages = [
          ...messagesRef.current.slice(0, -1),
          { ...assistantMessage, content: assistantContent },
        ];
        messagesRef.current = updatedMessages;
        onMessagesUpdate([...updatedMessages]);
      };

      if (sessionId) {
        // Continue existing session
        result = await codingAgentAPI.continueSessionStreaming(
          resolvedAgentType,
          { type: 'id', value: sessionId },
          prompt,
          handleChunk,
          { workingDirectory: workspacePath }
        );
      } else {
        // Start new session
        result = await codingAgentAPI.generateStreaming(
          resolvedAgentType,
          { prompt, workingDirectory: workspacePath },
          handleChunk
        );

        // Capture session ID
        if (result.sessionId) {
          onSessionCreated(result.sessionId);
        }
      }

      // Final update with complete content
      const finalMessages = [
        ...messagesRef.current.slice(0, -1),
        { ...assistantMessage, content: result.content || assistantContent },
      ];
      messagesRef.current = finalMessages;
      onMessagesUpdate([...finalMessages]);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to send message');
      // Remove incomplete assistant message on error
      messagesRef.current = messagesRef.current.slice(0, -1);
      onMessagesUpdate([...messagesRef.current]);
    } finally {
      setIsStreaming(false);
    }
  }, [codingAgentAPI, agentType, sessionId, workspacePath, onMessagesUpdate, onSessionCreated, onError]);

  return {
    sendMessage,
    isStreaming,
  };
}

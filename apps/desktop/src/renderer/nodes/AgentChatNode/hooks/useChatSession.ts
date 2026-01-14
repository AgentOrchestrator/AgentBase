/**
 * useChatSession Hook
 *
 * Encapsulates chat logic for AgentChatNode.
 * Handles message sending, streaming, and history loading via codingAgentAPI.
 */

import { useState, useCallback, useRef } from 'react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  messageType?: string;
}

interface UseChatSessionOptions {
  agentType: string;
  sessionId?: string;
  workspacePath?: string;
  onMessagesUpdate: (messages: ChatMessage[]) => void;
  onSessionCreated: (sessionId: string) => void;
  onError: (error: string) => void;
}

interface CodingAgentAPI {
  generateStreaming: (
    agentType: string,
    request: { prompt: string; workingDirectory?: string },
    onChunk: (chunk: string) => void
  ) => Promise<{ content: string; sessionId?: string }>;
  continueSessionStreaming: (
    agentType: string,
    identifier: { type: string; value: string },
    prompt: string,
    onChunk: (chunk: string) => void,
    options?: { workingDirectory?: string }
  ) => Promise<{ content: string; sessionId?: string }>;
}

export function useChatSession({
  agentType,
  sessionId,
  workspacePath,
  onMessagesUpdate,
  onSessionCreated,
  onError,
}: UseChatSessionOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesRef = useRef<ChatMessage[]>([]);

  const codingAgentAPI = (window as unknown as { codingAgentAPI?: CodingAgentAPI }).codingAgentAPI;

  const sendMessage = useCallback(async (prompt: string) => {
    if (!codingAgentAPI) {
      onError('Coding agent API not available');
      return;
    }

    setIsStreaming(true);

    // Add user message
    const userMessage: ChatMessage = {
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
    const assistantMessage: ChatMessage = {
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
          agentType,
          { type: 'id', value: sessionId },
          prompt,
          handleChunk,
          { workingDirectory: workspacePath }
        );
      } else {
        // Start new session
        result = await codingAgentAPI.generateStreaming(
          agentType,
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

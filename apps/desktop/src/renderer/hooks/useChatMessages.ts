/**
 * useChatMessages Hook
 *
 * Unified hook for chat message management:
 * - Loads messages on mount
 * - Watches for external file changes (FileWatcher)
 * - Handles message sending with streaming support
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CodingAgentMessage, CodingAgentType } from '@agent-orchestrator/shared';
import type { IAgentService } from '../context/node-services';
import { useSessionFileWatcher } from './useSessionFileWatcher';

export interface UseChatMessagesOptions {
  /** Session ID to load messages for */
  sessionId: string | undefined;
  /** Workspace path for session lookup */
  workspacePath: string | undefined;
  /** Agent service for fetching session data */
  agentService: IAgentService;
  /** Agent type for file watching */
  agentType: string;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
  /** Callback when session is created (useful for first message) */
  onSessionCreated?: (sessionId: string) => void;
}

export interface UseChatMessagesReturn {
  /** Current messages */
  messages: CodingAgentMessage[];
  /** Whether messages are currently loading */
  isLoading: boolean;
  /** Whether messages have been loaded at least once */
  isLoaded: boolean;
  /** Whether a message is currently being streamed */
  isStreaming: boolean;
  /** Update messages directly */
  setMessages: (messages: CodingAgentMessage[]) => void;
  /** Reload messages from session file */
  reload: () => Promise<void>;
  /** Send a message and stream the response */
  sendMessage: (prompt: string) => Promise<void>;
}

/**
 * Unified hook for chat message management.
 * Handles loading, file watching, and message sending.
 */
export function useChatMessages({
  sessionId,
  workspacePath,
  agentService,
  agentType,
  enabled = true,
  onError,
  onSessionCreated,
}: UseChatMessagesOptions): UseChatMessagesReturn {
  const [messages, setMessages] = useState<CodingAgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const loadedSessionIdRef = useRef<string | null>(null);
  const messagesRef = useRef<CodingAgentMessage[]>([]);
  const isLoadingRef = useRef(false);
  const streamingEndTimeRef = useRef<number | null>(null);
  const STREAMING_COOLDOWN_MS = 2000; // Prevent file watcher reloads for 2s after streaming ends

  // Keep messagesRef in sync with state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const loadMessages = useCallback(async () => {
    if (!sessionId || !workspacePath || !enabled) {
      return;
    }

    // Prevent concurrent loads
    if (isLoadingRef.current) {
      return;
    }

    // Skip if already loaded for this session (initial load only)
    if (loadedSessionIdRef.current === sessionId && isLoaded) {
      return;
    }

    isLoadingRef.current = true;
    setIsLoading(true);

    try {
      const session = await agentService.getSession(sessionId, workspacePath, {
        roles: ['user', 'assistant'],
      });

      if (session?.messages) {
        const loadedMessages = session.messages as CodingAgentMessage[];
        setMessages(loadedMessages);
        messagesRef.current = loadedMessages;
        loadedSessionIdRef.current = sessionId;
      }
      setIsLoaded(true);
    } catch (err) {
      console.error('[useChatMessages] Failed to load messages:', err);
      setIsLoaded(true); // Mark as loaded even on error to avoid retry loops
    } finally {
      isLoadingRef.current = false;
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

  // Watch for external changes to the session file (e.g., from terminal view)
  // This enables real-time synchronization between terminal and chat views
  // Deduplication handled by useSessionFileWatcher
  useSessionFileWatcher({
    agentType: agentType as CodingAgentType,
    sessionId,
    onSessionChange: useCallback(
      (event) => {
        // Only reload on updates (not creates/deletes), and not while streaming
        // Also prevent reloads immediately after streaming ends (cooldown period)
        const timeSinceStreamingEnd = streamingEndTimeRef.current
          ? Date.now() - streamingEndTimeRef.current
          : Infinity;
        const isInCooldown = timeSinceStreamingEnd < STREAMING_COOLDOWN_MS;

        if (event.type === 'updated' && !isStreaming && !isInCooldown) {
          console.log('[useChatMessages] Session file updated externally, reloading');
          loadedSessionIdRef.current = null;
          setIsLoaded(false);
          void loadMessages();
        } else if (isInCooldown) {
          console.log('[useChatMessages] Skipping reload - still in streaming cooldown period');
        }
      },
      [loadMessages, isStreaming]
    ),
    enabled: enabled && !!sessionId,
    debounceMs: 300,
  });

  // Send a message and stream the response
  const sendMessage = useCallback(async (prompt: string) => {
    if (!sessionId || !workspacePath) {
      onError?.('Session ID and workspace path are required');
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
    const withUserMessage = [...messagesRef.current, userMessage];
    messagesRef.current = withUserMessage;
    setMessages(withUserMessage);

    // Create placeholder assistant message
    let assistantContent = '';
    const assistantMessage: CodingAgentMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      messageType: 'assistant',
    };
    const withAssistantMessage = [...messagesRef.current, assistantMessage];
    messagesRef.current = withAssistantMessage;
    setMessages(withAssistantMessage);

    try {
      const handleChunk = (chunk: string) => {
        assistantContent += chunk;
        // Update last message with new content
        const updatedMessages = [
          ...messagesRef.current.slice(0, -1),
          { ...assistantMessage, content: assistantContent },
        ];
        messagesRef.current = updatedMessages;
        setMessages(updatedMessages);
      };

      // Stateless API - adapter handles create vs continue based on session file existence
      const result = await agentService.sendMessageStreaming(prompt, workspacePath, sessionId, handleChunk);

      // Notify caller of session (useful for first message)
      onSessionCreated?.(sessionId);

      // After streaming completes, reload messages from file to get full contentBlocks
      // This ensures we have thinking blocks, tool_use blocks, etc. that weren't available during streaming
      // Wait a bit for the file to be fully written
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        const session = await agentService.getSession(sessionId, workspacePath, {
          roles: ['user', 'assistant'],
        });

        if (session?.messages) {
          const loadedMessages = session.messages as CodingAgentMessage[];
          messagesRef.current = loadedMessages;
          setMessages(loadedMessages);
          loadedSessionIdRef.current = sessionId;
        } else {
          // Fallback: use the streamed content if reload fails
          const finalMessages = [
            ...messagesRef.current.slice(0, -1),
            { ...assistantMessage, content: result?.content || assistantContent },
          ];
          messagesRef.current = finalMessages;
          setMessages(finalMessages);
        }
      } catch (reloadErr) {
        console.warn('[useChatMessages] Failed to reload messages after streaming, using streamed content:', reloadErr);
        // Fallback: use the streamed content if reload fails
        const finalMessages = [
          ...messagesRef.current.slice(0, -1),
          { ...assistantMessage, content: result?.content || assistantContent },
        ];
        messagesRef.current = finalMessages;
        setMessages(finalMessages);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to send message');
      // Remove incomplete assistant message on error
      const rollbackMessages = messagesRef.current.slice(0, -1);
      messagesRef.current = rollbackMessages;
      setMessages(rollbackMessages);
    } finally {
      setIsStreaming(false);
      streamingEndTimeRef.current = Date.now();
    }
  }, [agentService, sessionId, workspacePath, onSessionCreated, onError]);

  return {
    messages,
    isLoading,
    isLoaded,
    isStreaming,
    setMessages,
    reload,
    sendMessage,
  };
}

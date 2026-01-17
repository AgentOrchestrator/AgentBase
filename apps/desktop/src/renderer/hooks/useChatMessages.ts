/**
 * useChatMessages Hook
 *
 * Unified hook for chat message management:
 * - Loads messages on mount
 * - Watches for external file changes (FileWatcher)
 * - Handles message sending with streaming support
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  CodingAgentMessage,
  CodingAgentType,
  StreamingChunk,
  StreamingContentBlock,
  AgentContentBlock,
  AgentTextBlock,
  AgentThinkingBlock,
  AgentToolUseBlock,
} from '@agent-orchestrator/shared';
import type { IAgentService } from '../context/node-services';
import { useSessionFileWatcher } from './useSessionFileWatcher';

/**
 * Convert streaming content blocks to AgentContentBlock array
 * Sorts by index and maps to the appropriate block type
 */
function convertStreamingToContentBlocks(
  blocks: Map<number, StreamingContentBlock>
): AgentContentBlock[] {
  return Array.from(blocks.values())
    .sort((a, b) => a.index - b.index)
    .map((block): AgentContentBlock | null => {
      if (block.type === 'thinking' && block.thinking) {
        return {
          type: 'thinking',
          thinking: block.thinking,
        } satisfies AgentThinkingBlock;
      }
      if (block.type === 'tool_use' && block.id && block.name) {
        // Safe parse of accumulated JSON
        let input: Record<string, unknown> = {};
        if (block.input) {
          try {
            input = JSON.parse(block.input);
          } catch {
            input = { _partial: true, _raw: block.input };
          }
        }
        return {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input,
        } satisfies AgentToolUseBlock;
      }
      if (block.type === 'text' && block.text) {
        return {
          type: 'text',
          text: block.text,
        } satisfies AgentTextBlock;
      }
      return null;
    })
    .filter((block): block is AgentContentBlock => block !== null);
}

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
        if (event.type === 'updated' && !isStreaming) {
          console.log('[useChatMessages] Session file updated externally, reloading');
          loadedSessionIdRef.current = null;
          setIsLoaded(false);
          void loadMessages();
        }
      },
      [loadMessages, isStreaming]
    ),
    enabled: enabled && !!sessionId,
    debounceMs: 300,
  });

  // Send a message and stream the response with structured content blocks
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
    const assistantMessage: CodingAgentMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      contentBlocks: [],
      timestamp: new Date().toISOString(),
      messageType: 'assistant',
    };
    const withAssistantMessage = [...messagesRef.current, assistantMessage];
    messagesRef.current = withAssistantMessage;
    setMessages(withAssistantMessage);

    // Track streaming content blocks by index
    const streamingBlocks = new Map<number, StreamingContentBlock>();

    // Helper to update assistant message with current state
    const updateAssistantMessage = () => {
      const contentBlocks = convertStreamingToContentBlocks(streamingBlocks);
      // Build plain text content from text blocks for backward compatibility
      const textContent = contentBlocks
        .filter((b): b is AgentTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n');

      const updatedMessages = [
        ...messagesRef.current.slice(0, -1),
        { ...assistantMessage, content: textContent, contentBlocks },
      ];
      messagesRef.current = updatedMessages;
      setMessages(updatedMessages);
    };

    try {
      const handleStructuredChunk = (chunk: StreamingChunk) => {
        if (chunk.type === 'block_start' && chunk.blockType && chunk.block) {
          // Initialize new block
          streamingBlocks.set(chunk.index, {
            index: chunk.index,
            type: chunk.blockType,
            id: chunk.block.id,
            name: chunk.block.name,
            text: chunk.blockType === 'text' ? '' : undefined,
            thinking: chunk.blockType === 'thinking' ? '' : undefined,
            input: chunk.blockType === 'tool_use' ? '' : undefined,
            isComplete: false,
          });
          updateAssistantMessage();
        } else if (chunk.type === 'block_delta' && chunk.delta) {
          const block = streamingBlocks.get(chunk.index);
          if (block) {
            // Append delta content to appropriate field
            if (chunk.delta.text !== undefined) {
              block.text = (block.text || '') + chunk.delta.text;
            }
            if (chunk.delta.thinking !== undefined) {
              block.thinking = (block.thinking || '') + chunk.delta.thinking;
            }
            if (chunk.delta.inputJson !== undefined) {
              block.input = (block.input || '') + chunk.delta.inputJson;
            }
            updateAssistantMessage();
          }
        } else if (chunk.type === 'block_stop') {
          const block = streamingBlocks.get(chunk.index);
          if (block) {
            block.isComplete = true;
            updateAssistantMessage();
          }
        }
      };

      // Use structured streaming API
      const result = await agentService.sendMessageStreamingStructured(
        prompt,
        workspacePath,
        sessionId,
        handleStructuredChunk
      );

      // Notify caller of session (useful for first message)
      onSessionCreated?.(sessionId);

      // Final update with complete content from result
      const finalContentBlocks = convertStreamingToContentBlocks(streamingBlocks);
      const finalTextContent = finalContentBlocks
        .filter((b): b is AgentTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n');

      const finalMessages = [
        ...messagesRef.current.slice(0, -1),
        {
          ...assistantMessage,
          content: result?.content || finalTextContent,
          contentBlocks: finalContentBlocks,
        },
      ];
      messagesRef.current = finalMessages;
      setMessages(finalMessages);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to send message');
      // Keep partial content on error if we have any blocks
      if (streamingBlocks.size > 0) {
        const partialBlocks = convertStreamingToContentBlocks(streamingBlocks);
        const partialContent = partialBlocks
          .filter((b): b is AgentTextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n');
        const errorMessages = [
          ...messagesRef.current.slice(0, -1),
          {
            ...assistantMessage,
            content: partialContent || 'Error: Response incomplete',
            contentBlocks: partialBlocks,
          },
        ];
        messagesRef.current = errorMessages;
        setMessages(errorMessages);
      } else {
        // Remove incomplete assistant message on error if no content
        const rollbackMessages = messagesRef.current.slice(0, -1);
        messagesRef.current = rollbackMessages;
        setMessages(rollbackMessages);
      }
    } finally {
      setIsStreaming(false);
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

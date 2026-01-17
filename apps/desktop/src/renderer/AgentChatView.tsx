/**
 * AgentChatView
 *
 * Chat view component for AgentNode that uses the SDK-based chat.
 * Provides streaming conversation with Claude Code.
 * Displays messages exactly like ConversationNode.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { marked } from 'marked';
import { useReactFlow } from '@xyflow/react';
import { useChatSession } from './nodes/AgentChatNode/hooks/useChatSession';
import { useAgentService } from './context';
import { TextSelectionButton } from './components/TextSelectionButton';
import type { AgentChatMessage } from './types/agent-node';
import type { AgentContentBlock } from '@agent-orchestrator/shared';
import './AgentChatView.css';

// Configure marked for tight spacing
marked.setOptions({
  gfm: true,
  breaks: false,
});

interface AgentChatViewProps {
  /** Session ID (required for chat operations) */
  sessionId: string;
  agentType: string;
  /** Workspace path (required for chat operations) */
  workspacePath: string;
  initialMessages?: AgentChatMessage[];
  initialPrompt?: string;
  onMessagesChange: (messages: AgentChatMessage[]) => void;
  onSessionCreated?: (sessionId: string) => void;
  isSessionReady?: boolean;
  selected?: boolean;
  /** Node ID for fork events */
  nodeId: string;
}

// Represents a displayable item for assistant messages (matches ConversationNode)
type DisplayItem =
  | { type: 'text'; content: { text: string }; key: string }
  | { type: 'thinking'; content: { thinking: string }; key: string }
  | { type: 'tool_summary'; toolType: 'read' | 'edit' | 'grep' | 'glob'; count: number; key: string };

export default function AgentChatView({
  sessionId,
  agentType,
  workspacePath,
  initialMessages = [],
  initialPrompt,
  onMessagesChange,
  onSessionCreated,
  isSessionReady = true,
  selected = false,
  nodeId,
}: AgentChatViewProps) {
  const [messages, setMessages] = useState<AgentChatMessage[]>(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [textSelection, setTextSelection] = useState<{
    text: string;
    /** Y position in content coordinates (accounts for scroll) */
    contentY: number;
    /** Message ID from the selected message (for fork filtering) */
    messageId?: string;
  } | null>(null);
  const [isCommandPressed, setIsCommandPressed] = useState(false);
  const hasSentInitialPrompt = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { getViewport } = useReactFlow();

  // Get agentService from context
  const agentService = useAgentService();

  const {
    sendMessage,
    isStreaming,
  } = useChatSession({
    agentType,
    sessionId,
    workspacePath,
    currentMessages: messages,
    onMessagesUpdate: useCallback((newMessages: AgentChatMessage[]) => {
      setMessages(newMessages);
      onMessagesChange(newMessages);
    }, [onMessagesChange]),
    onSessionCreated: useCallback((newSessionId: string) => {
      onSessionCreated?.(newSessionId);
    }, [onSessionCreated]),
    onError: setError,
    agentService,
  });

  // Sync messages from props
  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages, messages.length]);

  // Auto-send initial prompt when session is ready and no messages exist
  useEffect(() => {
    // Don't send if there are already messages (from initialMessages or previous conversation)
    const hasExistingMessages = messages.length > 0 || initialMessages.length > 0;
    
    if (
      isSessionReady &&
      initialPrompt &&
      initialPrompt.trim() &&
      !hasSentInitialPrompt.current &&
      !hasExistingMessages &&
      !isStreaming
    ) {
      hasSentInitialPrompt.current = true;
      sendMessage(initialPrompt.trim()).catch((err) => {
        console.error('[AgentChatView] Failed to send initial prompt:', err);
        hasSentInitialPrompt.current = false; // Allow retry on error
      });
    }
  }, [isSessionReady, initialPrompt, messages.length, initialMessages.length, isStreaming, sendMessage]);

  // Reset hasSentInitialPrompt if initialPrompt changes (shouldn't happen, but safety check)
  useEffect(() => {
    if (!initialPrompt) {
      hasSentInitialPrompt.current = false;
    }
  }, [initialPrompt]);

  // Auto-scroll to bottom
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      const timeoutId = setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [messages]);

  // Detect Command/Ctrl key press for cursor change
  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    const handleKeyDown = (event: KeyboardEvent) => {
      const modifierKey = isMac ? event.metaKey : event.ctrlKey;
      if (modifierKey) {
        setIsCommandPressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const modifierKey = isMac ? event.metaKey : event.ctrlKey;
      if (!modifierKey) {
        setIsCommandPressed(false);
      }
    };

    // Also handle when key is released outside the window
    const handleBlur = () => {
      setIsCommandPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Convert a viewport Y coordinate to content coordinates (accounts for zoom and scroll)
  const viewportYToContentY = useCallback((clientY: number): number => {
    if (!messagesContainerRef.current) return 0;

    const viewport = getViewport();
    const zoom = viewport.zoom;

    // Get the content element's bounding rect (already accounts for React Flow zoom transform)
    const contentRect = messagesContainerRef.current.getBoundingClientRect();
    const scrollTop = messagesContainerRef.current.scrollTop;

    // Calculate Y position relative to content container
    // When React Flow zooms, it applies a CSS transform to the node
    // getBoundingClientRect() returns coordinates in viewport space (already transformed)
    // clientY is also in viewport space
    // scrollTop is in content space (not transformed)
    //
    // The visible content area is scaled by zoom, so:
    // - (clientY - contentRect.top) gives position in the visible viewport (scaled by zoom)
    // - Divide by zoom to convert from viewport-scaled to content coordinates
    // - Add scrollTop to get absolute position in the scrollable content
    const viewportRelativeY = clientY - contentRect.top;
    const contentRelativeY = viewportRelativeY / zoom;
    return contentRelativeY + scrollTop;
  }, [getViewport]);

  // Find the message ID from the current selection by walking up the DOM tree
  const findMessageIdFromSelection = useCallback((): string | undefined => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return undefined;

    const range = selection.getRangeAt(0);
    let node: Node | null = range.commonAncestorContainer;

    // Walk up the DOM tree to find element with data-message-id
    while (node && node !== messagesContainerRef.current) {
      if (node instanceof Element) {
        const messageId = node.getAttribute('data-message-id');
        if (messageId) return messageId;
      }
      node = node.parentNode;
    }
    return undefined;
  }, []);

  // Detect text selection and calculate position from selection bounds
  const handleSelectionChange = useCallback(() => {
    if (!messagesContainerRef.current) {
      setTextSelection(null);
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setTextSelection(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();

    // Check if selection is within our content container
    if (!messagesContainerRef.current.contains(range.commonAncestorContainer)) {
      setTextSelection(null);
      return;
    }

    // If no meaningful text is selected, hide button
    if (!selectedText || selectedText.length === 0) {
      setTextSelection(null);
      return;
    }

    // Get the bounding rect of the selection to snap button to the selected line
    const selectionRect = range.getBoundingClientRect();
    // Use the bottom of the selection (end of selected text)
    const contentY = viewportYToContentY(selectionRect.bottom);

    // Extract message ID from the selected message element
    const messageId = findMessageIdFromSelection();

    setTextSelection({
      text: selectedText,
      contentY,
      messageId,
    });
  }, [viewportYToContentY, findMessageIdFromSelection]);

  // Handle scroll events when node is selected
  // Only prevent canvas scrolling when node is selected (clicked)
  // This matches the behavior of other nodes like UserMessageNode and AssistantMessageNode
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !selected) return;

    const handleWheel = (e: WheelEvent) => {
      // Always prevent canvas scrolling when node is selected
      // This prevents the "snap" effect when reaching boundaries
      e.stopPropagation();
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [selected]);

  // Listen for selection changes to position button at selected text
  useEffect(() => {
    const handleMouseUp = () => {
      // Small delay to ensure selection is updated
      setTimeout(handleSelectionChange, 10);
    };

    // Listen for selection changes
    document.addEventListener('selectionchange', handleSelectionChange);
    // Listen for mouseup to catch selection end
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleSelectionChange]);

  const handleSend = async () => {
    if (!isSessionReady || !inputValue.trim() || isStreaming) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setError(null);

    await sendMessage(userMessage);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Get tool type (matches ConversationNode exactly)
  const getToolType = (toolName: string): 'read' | 'edit' | 'grep' | 'glob' | null => {
    if (toolName === 'Read') return 'read';
    if (toolName === 'Edit' || toolName === 'Write') return 'edit';
    if (toolName === 'Grep') return 'grep';
    if (toolName === 'Glob') return 'glob';
    return null; // Skip TodoWrite and other tools
  };

  // Process content blocks into display items (matches ConversationNode logic)
  const processContentBlocks = (contentBlocks: AgentContentBlock[]): DisplayItem[] => {
    const items: DisplayItem[] = [];
    let currentToolType: 'read' | 'edit' | 'grep' | 'glob' | null = null;
    let currentToolCount = 0;
    let itemIndex = 0;

    const flushToolGroup = () => {
      if (currentToolType && currentToolCount > 0) {
        items.push({
          type: 'tool_summary',
          toolType: currentToolType,
          count: currentToolCount,
          key: `tool-summary-${itemIndex++}`
        });
        currentToolType = null;
        currentToolCount = 0;
      }
    };

    for (const block of contentBlocks) {
      if (block.type === 'text') {
        flushToolGroup();
        if (block.text) {
          items.push({ type: 'text', content: { text: block.text }, key: `text-${itemIndex++}` });
        }
      } else if (block.type === 'thinking') {
        flushToolGroup();
        items.push({ type: 'thinking', content: { thinking: block.thinking }, key: `thinking-${itemIndex++}` });
      } else if (block.type === 'redacted_thinking') {
        flushToolGroup();
        items.push({ type: 'thinking', content: { thinking: 'Thinking redacted' }, key: `thinking-${itemIndex++}` });
      } else if (block.type === 'tool_use' || block.type === 'server_tool_use') {
        const toolType = getToolType(block.name);
        if (toolType) {
          if (currentToolType === toolType) {
            currentToolCount++;
          } else {
            flushToolGroup();
            currentToolType = toolType;
            currentToolCount = 1;
          }
        }
        // Skip web_search_tool_result and other tools
      }
    }

    flushToolGroup();
    return items;
  };

  // Render display item (matches ConversationNode exactly)
  const renderDisplayItem = (item: DisplayItem) => {
    if (item.type === 'text') {
      const html = marked.parse(item.content.text) as string;
      return (
        <div
          key={item.key}
          className="conversation-assistant-text-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    if (item.type === 'thinking') {
      return (
        <div 
          key={item.key} 
          className="conversation-thinking-content"
        >
          <span className="thinking-label">Thinking:</span>
          <span className="thinking-text">{item.content.thinking}</span>
        </div>
      );
    }

    if (item.type === 'tool_summary') {
      let label = '';
      if (item.toolType === 'read') {
        label = `Read ${item.count} file${item.count > 1 ? 's' : ''}`;
      } else if (item.toolType === 'edit') {
        label = `Edited ${item.count} file${item.count > 1 ? 's' : ''}`;
      } else if (item.toolType === 'grep') {
        label = 'Scanning the code';
      } else if (item.toolType === 'glob') {
        label = 'Gathering files';
      }

      return (
        <div 
          key={item.key} 
          className="conversation-tool-summary"
        >
          {label}
        </div>
      );
    }

    return null;
  };

  const renderUserMessage = (msg: AgentChatMessage) => {
    return (
      <div key={msg.id} className="conversation-user-message" data-message-id={msg.id}>
        <div className="conversation-user-content">
          {msg.content}
        </div>
      </div>
    );
  };

  const renderAssistantMessage = (msg: AgentChatMessage) => {
    const isLastMessage = msg === messages[messages.length - 1];
    const showCursor = isStreaming && isLastMessage && msg.role === 'assistant';

    // If we have content blocks, process them like ConversationNode
    if (msg.contentBlocks && msg.contentBlocks.length > 0) {
      const displayItems = processContentBlocks(msg.contentBlocks);
      return (
        <div key={msg.id} className="conversation-assistant-message" data-message-id={msg.id}>
          <div className="conversation-assistant-content">
            {displayItems.map(item => renderDisplayItem(item))}
            {showCursor && (
              <span className="agent-chat-view-cursor">▊</span>
            )}
          </div>
        </div>
      );
    }

    // Fallback to plain text content
    const html = marked.parse(msg.content) as string;
    return (
      <div key={msg.id} className="conversation-assistant-message" data-message-id={msg.id}>
        <div className="conversation-assistant-content">
          <div
            className="conversation-assistant-text-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {showCursor && (
            <span className="agent-chat-view-cursor">▊</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="agent-chat-view">
      {/* Messages */}
      <div 
        className={`conversation-content ${isCommandPressed ? 'command-pressed' : ''}`}
        ref={messagesContainerRef}
      >
        {messages.length === 0 && (
          <div className="agent-chat-view-empty">
            {isSessionReady
              ? 'Start a conversation with Claude Code'
              : 'Waiting for session to be ready...'}
          </div>
        )}
        {messages.map((msg) => {
          if (msg.role === 'user') {
            return renderUserMessage(msg);
          } else {
            return renderAssistantMessage(msg);
          }
        })}
        <div ref={messagesEndRef} />
        
        {/* Plus button - appears when text is selected, snaps to selection */}
        {textSelection && (
          <TextSelectionButton
            text={textSelection.text}
            mouseY={textSelection.contentY}
            rightOffset={12}
            nodeId={nodeId}
            sessionId={sessionId}
            messageId={textSelection.messageId}
          />
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="agent-chat-view-error">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="agent-chat-view-input-area">
        <div className="agent-chat-view-input-container">
          <textarea
            ref={inputRef}
            className="agent-chat-view-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a follow up..."
            disabled={!isSessionReady || isStreaming}
            rows={1}
          />
          <button
            className="agent-chat-view-send"
            onClick={handleSend}
            disabled={!isSessionReady || !inputValue.trim() || isStreaming}
            type="button"
            aria-label="Send"
          >
            <span className="agent-chat-view-send-icon">↑</span>
          </button>
        </div>
      </div>
    </div>
  );
}

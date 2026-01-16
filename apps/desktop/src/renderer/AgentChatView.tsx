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
import type { AgentChatMessage } from './types/agent-node';
import type { AgentContentBlock } from '@agent-orchestrator/shared';
import './AgentChatView.css';

// Configure marked for tight spacing
marked.setOptions({
  gfm: true,
  breaks: false,
});

interface AgentChatViewProps {
  sessionId?: string;
  agentType: string;
  initialMessages?: AgentChatMessage[];
  onMessagesChange: (messages: AgentChatMessage[]) => void;
  onSessionCreated?: (sessionId: string) => void;
  isSessionReady?: boolean;
  selected?: boolean;
}

// Represents a displayable item for assistant messages (matches ConversationNode)
type DisplayItem =
  | { type: 'text'; content: { text: string }; key: string }
  | { type: 'thinking'; content: { thinking: string }; key: string }
  | { type: 'tool_summary'; toolType: 'read' | 'edit' | 'grep' | 'glob'; count: number; key: string };

export default function AgentChatView({
  sessionId,
  agentType,
  initialMessages = [],
  onMessagesChange,
  onSessionCreated,
  isSessionReady = true,
  selected = false,
}: AgentChatViewProps) {
  const [messages, setMessages] = useState<AgentChatMessage[]>(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [textSelection, setTextSelection] = useState<{
    text: string;
    position: { top: number; right: number };
  } | null>(null);
  const [mouseY, setMouseY] = useState<number | null>(null);
  const [isCommandPressed, setIsCommandPressed] = useState(false);

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

  // Update button position based on mouse Y coordinate
  const updateButtonPositionFromMouse = useCallback((clientY: number) => {
    if (!messagesContainerRef.current) return;

    const viewport = getViewport();
    const zoom = viewport.zoom;
    
    // Get the content element's bounding rect (already accounts for React Flow zoom transform)
    const contentRect = messagesContainerRef.current.getBoundingClientRect();
    const scrollTop = messagesContainerRef.current.scrollTop;
    
    // Calculate mouse Y position relative to content container
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
    const absoluteY = contentRelativeY + scrollTop;
    
    setMouseY(absoluteY);
  }, [getViewport]);

  // Detect text selection
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

    // Keep the selection text, position will be updated by mouse movement
    setTextSelection({
      text: selectedText,
      position: { top: 0, right: 12 }, // Top will be overridden by mouseY
    });
  }, []);

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

  // Track mouse movement and update button position
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Track mouse Y position when within the content area
      if (messagesContainerRef.current) {
        const contentRect = messagesContainerRef.current.getBoundingClientRect();
        // Check if mouse is over the content area
        if (
          e.clientX >= contentRect.left &&
          e.clientX <= contentRect.right &&
          e.clientY >= contentRect.top &&
          e.clientY <= contentRect.bottom
        ) {
          updateButtonPositionFromMouse(e.clientY);
        }
      }
    };

    const handleMouseUp = () => {
      // Small delay to ensure selection is updated
      setTimeout(handleSelectionChange, 10);
    };

    // Listen for selection changes
    document.addEventListener('selectionchange', handleSelectionChange);
    // Track mouse movement
    document.addEventListener('mousemove', handleMouseMove);
    // Listen for mouseup to catch selection end
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleSelectionChange, updateButtonPositionFromMouse]);

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
      <div key={msg.id} className="conversation-user-message">
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
        <div key={msg.id} className="conversation-assistant-message">
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
      <div key={msg.id} className="conversation-assistant-message">
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
        
        {/* Plus button - appears when text is selected, follows mouse */}
        {textSelection && mouseY !== null && (
          <div
            className="conversation-message-plus-button"
            style={{
              top: `${mouseY}px`,
              right: `${textSelection.position.right}px`,
            }}
          >
            +
          </div>
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

/**
 * AgentChatView
 *
 * Chat view component for AgentNode that uses the SDK-based chat.
 * Provides streaming conversation with Claude Code.
 * Displays messages exactly like ConversationNode.
 */

import type { AgentContentBlock } from '@agent-orchestrator/shared';
import { useReactFlow } from '@xyflow/react';
import { marked } from 'marked';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TextSelectionButton } from './components/TextSelectionButton';
import { useAgentService } from './context';
import { useChatMessages } from './hooks/useChatMessages';
import type { AgentChatMessage } from './types/agent-node';
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
  initialPrompt?: string;
  /** Initial text to populate in the input field (not auto-sent) */
  initialInputText?: string;
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
  | {
      type: 'tool_summary';
      toolType: 'read' | 'edit' | 'grep' | 'glob';
      count: number;
      key: string;
    };

export default function AgentChatView({
  sessionId,
  agentType,
  workspacePath,
  initialPrompt,
  initialInputText,
  onSessionCreated,
  isSessionReady = true,
  selected = false,
  nodeId,
}: AgentChatViewProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Track the initial input text for display (cleared after first message)
  const [attachedText, setAttachedText] = useState<string | undefined>(initialInputText);
  const hasSentFirstMessage = useRef(false);
  const [textSelection, setTextSelection] = useState<{
    text: string;
    /** Y position in content coordinates (accounts for scroll) */
    contentY: number;
    /** Message ID from the selected message (for fork filtering) */
    messageId?: string;
  } | null>(null);
  const [isCommandPressed, setIsCommandPressed] = useState(false);
  const [stickyUserMessageId, setStickyUserMessageId] = useState<string | null>(null);
  const [_stickyMessageTop, setStickyMessageTop] = useState<number>(0);
  const hasSentInitialPrompt = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputAreaRef = useRef<HTMLDivElement>(null);
  const { getViewport } = useReactFlow();

  // Get agentService from context
  const agentService = useAgentService();

  // Use unified chat messages hook - handles loading, file watching, and sending
  const { messages, isLoaded, isStreaming, sendMessage } = useChatMessages({
    sessionId,
    workspacePath,
    agentService,
    agentType,
    enabled: isSessionReady,
    onError: setError,
    onSessionCreated,
  });

  // Set attached text from initialInputText prop (only if we haven't sent a message yet)
  useEffect(() => {
    if (initialInputText && !hasSentFirstMessage.current) {
      setAttachedText(initialInputText);
    }
  }, [initialInputText]);

  // Auto-send initial prompt only once when session is brand new (no existing messages)
  useEffect(() => {
    // Skip if already sent, no prompt, or currently streaming
    if (hasSentInitialPrompt.current || !initialPrompt?.trim() || isStreaming || !isSessionReady) {
      return;
    }

    // Skip if we already have messages loaded (session has history)
    if (messages.length > 0) {
      return;
    }

    // Wait for initial load to complete before deciding to send
    if (!isLoaded) {
      return;
    }

    // isLoaded is true and messages.length is 0, so this is a new session - send initial prompt
    hasSentInitialPrompt.current = true;
    sendMessage(initialPrompt.trim()).catch((err: unknown) => {
      console.error('[AgentChatView] Failed to send initial prompt:', err);
      hasSentInitialPrompt.current = false;
    });
  }, [isSessionReady, initialPrompt, messages.length, isStreaming, sendMessage, isLoaded]);

  // Auto-scroll to bottom
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      const timeoutId = setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, []);

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
  const viewportYToContentY = useCallback(
    (clientY: number): number => {
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
    },
    [getViewport]
  );

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

  // Track which user message is currently sticky using scroll position
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const updateStickyMessage = () => {
      const userMessages = Array.from(
        container.querySelectorAll('.conversation-user-message')
      ) as HTMLElement[];
      if (userMessages.length === 0) {
        setStickyUserMessageId(null);
        setStickyMessageTop(0);
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const stickyThreshold = containerRect.top + 50; // Account for padding

      // Find the user message that is currently at the sticky position
      // Check from bottom to top to get the most recent one that's sticky
      let currentStickyId: string | null = null;
      let stickyTop = 0;
      let stickyMessage: HTMLElement | null = null;

      for (let i = userMessages.length - 1; i >= 0; i--) {
        const userMsg = userMessages[i];
        const rect = userMsg.getBoundingClientRect();
        const messageId = userMsg.getAttribute('data-message-id');

        // Check if this message is in the sticky zone (at or near the top)
        if (rect.top <= stickyThreshold && rect.bottom > stickyThreshold) {
          currentStickyId = messageId;
          stickyMessage = userMsg;
          break;
        }
      }

      // Calculate forehead height based on sticky message position
      if (stickyMessage) {
        const stickyRect = stickyMessage.getBoundingClientRect();
        // The forehead is positioned absolutely at top: 0 of agent-chat-view
        // When sticky, the message is visually at the top of the visible content area
        // The conversation-content has padding-top: 40px, so sticky messages appear at ~40px from agent-chat-view top
        // Calculate visual position relative to agent-chat-view (the parent container)
        const agentChatView = container.closest('.agent-chat-view');
        if (agentChatView) {
          const agentRect = agentChatView.getBoundingClientRect();
          const visualTop = stickyRect.top - agentRect.top;
          // Extend to bottom of sticky message to ensure full coverage
          stickyTop = visualTop + stickyRect.height;
        } else {
          // Fallback: use container-relative position
          const visualTop = stickyRect.top - containerRect.top;
          stickyTop = visualTop + stickyRect.height;
        }
      } else if (userMessages.length > 0) {
        // Fallback: use first user message if none is sticky
        const firstUserMsg = userMessages[0];
        const firstRect = firstUserMsg.getBoundingClientRect();
        const agentChatView = container.closest('.agent-chat-view');
        if (agentChatView) {
          const agentRect = agentChatView.getBoundingClientRect();
          stickyTop = firstRect.top - agentRect.top + firstRect.height;
        } else {
          stickyTop = firstRect.top - containerRect.top + firstRect.height;
        }
      }

      setStickyUserMessageId(currentStickyId);
      setStickyMessageTop(stickyTop);
    };

    // Initial check
    updateStickyMessage();

    // Update on scroll
    container.addEventListener('scroll', updateStickyMessage);
    // Also update when messages change
    const timeoutId = setTimeout(updateStickyMessage, 100);

    return () => {
      container.removeEventListener('scroll', updateStickyMessage);
      clearTimeout(timeoutId);
    };
  }, []);

  const handleSend = async () => {
    if (!isSessionReady || !inputValue.trim() || isStreaming) return;

    const userInput = inputValue.trim();
    let messageToSend = userInput;

    // If this is the first message and we have attached text, prepend it
    if (!hasSentFirstMessage.current && attachedText) {
      messageToSend = `${attachedText}\n\n${userInput}`;
      setAttachedText(undefined); // Clear box immediately
      hasSentFirstMessage.current = true;
    }

    setInputValue('');
    setError(null);

    await sendMessage(messageToSend);
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
          key: `tool-summary-${itemIndex++}`,
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
        items.push({
          type: 'thinking',
          content: { thinking: block.thinking },
          key: `thinking-${itemIndex++}`,
        });
      } else if (block.type === 'redacted_thinking') {
        flushToolGroup();
        items.push({
          type: 'thinking',
          content: { thinking: 'Thinking redacted' },
          key: `thinking-${itemIndex++}`,
        });
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
        <div key={item.key} className="conversation-thinking-content">
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
        <div key={item.key} className="conversation-tool-summary">
          {label}
        </div>
      );
    }

    return null;
  };

  const renderUserMessage = (msg: AgentChatMessage, msgIndex: number) => {
    const isSticky = stickyUserMessageId === msg.id;

    // Find the index of the sticky message
    const stickyIndex = stickyUserMessageId
      ? messages.findIndex((m) => m.id === stickyUserMessageId)
      : -1;

    // Only fade out messages that come BEFORE (are older than) the sticky one
    const shouldFade = stickyIndex !== -1 && msgIndex < stickyIndex;

    return (
      <div
        key={msg.id}
        className={`conversation-user-message ${isSticky ? 'sticky-active' : ''} ${shouldFade ? 'sticky-fade' : ''}`}
        data-message-id={msg.id}
      >
        <div className="conversation-user-content">{msg.content}</div>
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
            {displayItems.map((item) => renderDisplayItem(item))}
            {showCursor && <span className="agent-chat-view-cursor">▊</span>}
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
          {showCursor && <span className="agent-chat-view-cursor">▊</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="agent-chat-view">
      {/* Forehead - covers everything above the top sticky user message */}
      {stickyUserMessageId && <div className="agent-chat-view-forehead" />}

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
        {messages.map((msg, index) => {
          if (msg.role === 'user') {
            return renderUserMessage(msg, index);
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
      {error && <div className="agent-chat-view-error">{error}</div>}

      {/* Input */}
      <div className="agent-chat-view-input-area" ref={inputAreaRef}>
        {/* Chin - covers everything from 50% of input bar downwards */}
        <div className="agent-chat-view-chin" />

        {/* Attached text display box - shows selected text from parent conversation */}
        {attachedText && (
          <div className="agent-chat-view-attached-text">
            <div className="agent-chat-view-attached-text-content">{attachedText}</div>
          </div>
        )}

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

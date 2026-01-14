/**
 * ConversationNodePresentation
 *
 * Presentation component for ConversationNode.
 * Handles UI rendering, expand/collapse, and message display.
 * Uses useConversationService() hook for data access.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useConversationService, useNodeInitialized } from '../../context';
import type { ChatMessage } from '../../context/node-services';
import './ConversationNode.css';

export interface ConversationNodePresentationProps {
  /** Whether the node is selected */
  selected?: boolean;
  /** Display title */
  title?: string;
  /** Project name */
  projectName?: string;
  /** Message count */
  messageCount?: number;
  /** Timestamp */
  timestamp?: number | string;
  /** Initial expanded state */
  initialExpanded?: boolean;
  /** Callback when expanded state changes */
  onExpandedChange?: (isExpanded: boolean) => void;
}

/**
 * ConversationNodePresentation
 *
 * Renders the conversation node UI with expandable message list.
 * Fetches messages via useConversationService when expanded.
 */
export function ConversationNodePresentation({
  selected = false,
  title,
  projectName,
  messageCount,
  timestamp,
  initialExpanded = false,
  onExpandedChange,
}: ConversationNodePresentationProps) {
  const conversationService = useConversationService();
  const isInitialized = useNodeInitialized();

  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle scroll events when node is selected
  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement || !selected) return;

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
    };

    contentElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      contentElement.removeEventListener('wheel', handleWheel);
    };
  }, [selected]);

  // Subscribe to service state changes
  useEffect(() => {
    if (!isInitialized) return;

    // Subscribe to messages loaded
    const unsubMessages = conversationService.onMessagesLoaded((loadedMessages) => {
      setMessages(loadedMessages);
      setIsLoading(false);
    });

    // Subscribe to errors
    const unsubErrors = conversationService.onError((err) => {
      setError(err);
      setIsLoading(false);
    });

    return () => {
      unsubMessages();
      unsubErrors();
    };
  }, [isInitialized, conversationService]);

  // Load content when expanded (if not already loaded)
  useEffect(() => {
    if (isExpanded && isInitialized && messages.length === 0 && !isLoading && !error) {
      setIsLoading(true);
      conversationService.loadSession({ roles: ['user', 'assistant'] });
    }
  }, [isExpanded, isInitialized, messages.length, isLoading, error, conversationService]);

  // Handle toggle expand
  const handleToggleExpand = useCallback(() => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onExpandedChange?.(newExpanded);
  }, [isExpanded, onExpandedChange]);

  // Format timestamp for display
  const formatTimestamp = (ts?: number | string) => {
    if (!ts) return '';
    const date = typeof ts === 'number' ? new Date(ts) : new Date(ts);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get display title
  const displayTitle =
    title ||
    projectName ||
    (conversationService.sessionId
      ? `Session ${conversationService.sessionId.slice(0, 8)}...`
      : 'Conversation');

  return (
    <div className={`conversation-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} />

      <div className="conversation-node-header" onClick={handleToggleExpand}>
        <div className="conversation-node-title-section">
          <div className="conversation-node-title">{displayTitle}</div>
          <div className="conversation-node-meta">
            {messageCount !== undefined && (
              <span className="conversation-node-meta-item">
                {messageCount} messages
              </span>
            )}
            {timestamp && (
              <span className="conversation-node-meta-item">
                {formatTimestamp(timestamp)}
              </span>
            )}
            {projectName && (
              <span className="conversation-node-meta-item">{projectName}</span>
            )}
          </div>
        </div>
        <span
          className={`conversation-node-expand-icon ${isExpanded ? 'expanded' : ''}`}
        >
          ▼
        </span>
      </div>

      {isExpanded && (
        <div ref={contentRef} className="conversation-node-content">
          {isLoading && (
            <div className="conversation-node-loading">Loading conversation...</div>
          )}

          {error && <div className="conversation-node-error">{error}</div>}

          {!isLoading &&
            !error &&
            messages.map((message) => (
              <div key={message.id} className={`conversation-message ${message.role}`}>
                <div className="conversation-message-role">{message.role}</div>
                <div className="conversation-message-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}

          {!isLoading && !error && messages.length === 0 && (
            <div className="conversation-node-loading">No messages to display</div>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

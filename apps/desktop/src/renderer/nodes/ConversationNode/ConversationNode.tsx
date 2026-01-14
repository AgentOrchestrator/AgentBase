/**
 * ConversationNode
 *
 * Displays a conversation session from the CodingAgent.
 * Uses lazy loading - only fetches full content when expanded.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ConversationNodeData } from '../schemas';
import './ConversationNode.css';

// Types from CodingAgent (simplified for renderer)
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  messageType?: string;
}

interface SessionContent {
  id: string;
  messages: ChatMessage[];
  messageCount: number;
  projectPath?: string;
  projectName?: string;
}

// Type for the coding agent API
interface CodingAgentAPIWithSession {
  getSession: (
    agentType: string,
    sessionId: string,
    filter?: unknown
  ) => Promise<SessionContent | null>;
}

function ConversationNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as ConversationNodeData;
  const {
    sessionId,
    agentType,
    title,
    projectName,
    messageCount,
    timestamp,
    isExpanded: initialExpanded,
  } = nodeData;

  const [isExpanded, setIsExpanded] = useState(initialExpanded ?? false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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

  // Fetch session content when expanded
  const fetchContent = useCallback(async () => {
    // Cast to our extended interface type
    const codingAgentAPI = (window as unknown as { codingAgentAPI?: CodingAgentAPIWithSession }).codingAgentAPI;

    if (!codingAgentAPI) {
      setError('Coding agent API not available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const session = await codingAgentAPI.getSession(
        agentType || 'claude_code',
        sessionId,
        { roles: ['user', 'assistant'] } // Filter to only user and assistant messages
      );

      if (session) {
        // Filter to only text messages (skip tool calls)
        const textMessages = session.messages.filter(
          (m: ChatMessage) => m.messageType === 'assistant' || m.messageType === 'user' || !m.messageType
        );
        setMessages(textMessages);
      } else {
        setError('Session not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, agentType]);

  // Fetch content when expanded
  useEffect(() => {
    if (isExpanded && messages.length === 0 && !isLoading && !error) {
      fetchContent();
    }
  }, [isExpanded, messages.length, isLoading, error, fetchContent]);

  // Dispatch node update for persistence
  const dispatchNodeUpdate = useCallback(
    (updates: Partial<ConversationNodeData>) => {
      const updatedData = { ...nodeData, ...updates };
      window.dispatchEvent(
        new CustomEvent('update-node', {
          detail: { nodeId: id, data: updatedData },
        })
      );
    },
    [id, nodeData]
  );

  const handleToggleExpand = useCallback(() => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    dispatchNodeUpdate({ isExpanded: newExpanded });
  }, [isExpanded, dispatchNodeUpdate]);

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

  // Get display title (with safety check for sessionId)
  const displayTitle = title || projectName || (sessionId ? `Session ${sessionId.slice(0, 8)}...` : 'Conversation');

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
        <span className={`conversation-node-expand-icon ${isExpanded ? 'expanded' : ''}`}>
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
              <div
                key={message.id}
                className={`conversation-message ${message.role}`}
              >
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

export default ConversationNode;

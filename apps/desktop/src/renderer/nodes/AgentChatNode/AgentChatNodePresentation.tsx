/**
 * AgentChatNodePresentation
 *
 * Presentation component for interactive chat with Claude Code.
 * Renders chat UI with messages, input area, and streaming support.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useChatSession } from './hooks/useChatSession';
import './AgentChatNode.css';
import type { CodingAgentMessage } from '@agent-orchestrator/shared';

interface AgentChatNodePresentationProps {
  selected?: boolean;
  sessionId?: string;
  agentType: string;
  workspacePath?: string;
  title?: string;
  initialMessages: CodingAgentMessage[];
  isDraft: boolean;
  initialExpanded?: boolean;
  onMessagesChange: (messages: CodingAgentMessage[]) => void;
  onSessionCreated: (sessionId: string) => void;
  onExpandedChange: (isExpanded: boolean) => void;
}

export function AgentChatNodePresentation({
  selected,
  sessionId,
  agentType,
  workspacePath,
  title,
  initialMessages,
  isDraft,
  initialExpanded = true,
  onMessagesChange,
  onSessionCreated,
  onExpandedChange,
}: AgentChatNodePresentationProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [messages, setMessages] = useState<CodingAgentMessage[]>(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    sendMessage,
    isStreaming,
  } = useChatSession({
    agentType,
    sessionId,
    workspacePath,
    onMessagesUpdate: useCallback((newMessages: CodingAgentMessage[]) => {
      setMessages(newMessages);
      onMessagesChange(newMessages);
    }, [onMessagesChange]),
    onSessionCreated,
    onError: setError,
  });

  // Sync messages from props
  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages, messages.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleToggleExpand = useCallback(() => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onExpandedChange(newExpanded);
  }, [isExpanded, onExpandedChange]);

  const handleSend = async () => {
    if (!inputValue.trim() || isStreaming) return;

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

  const displayTitle = title || (isDraft ? 'New Chat' : `Chat ${sessionId?.slice(0, 8) || ''}`);

  return (
    <div className={`agent-chat-node ${selected ? 'selected' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <Handle type="target" position={Position.Top} className="agent-chat-handle" />

      {/* Header */}
      <div className="agent-chat-header" onClick={handleToggleExpand}>
        <div className="agent-chat-header-left">
          <span className="agent-chat-expand-icon">{isExpanded ? '▼' : '▶'}</span>
          <span className="agent-chat-title">{displayTitle}</span>
        </div>
        <div className="agent-chat-header-right">
          <span className="agent-chat-agent-type">{agentType}</span>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Messages */}
          <div className="agent-chat-messages">
            {messages.length === 0 && (
              <div className="agent-chat-empty">
                Start a conversation with Claude Code
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`agent-chat-message ${msg.role}`}
              >
                <div className="agent-chat-message-role">
                  {msg.role === 'user' ? 'You' : 'Claude'}
                </div>
                <div className="agent-chat-message-content">
                  {msg.content}
                  {isStreaming && msg === messages[messages.length - 1] && msg.role === 'assistant' && (
                    <span className="agent-chat-streaming-cursor">▊</span>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Error */}
          {error && (
            <div className="agent-chat-error">
              {error}
            </div>
          )}

          {/* Input */}
          <div className="agent-chat-input-area">
            <textarea
              ref={inputRef}
              className="agent-chat-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={isStreaming}
              rows={1}
            />
            <button
              className="agent-chat-send-button"
              onClick={handleSend}
              disabled={!inputValue.trim() || isStreaming}
            >
              {isStreaming ? '...' : 'Send'}
            </button>
          </div>
        </>
      )}

      <Handle type="source" position={Position.Bottom} className="agent-chat-handle" />
    </div>
  );
}

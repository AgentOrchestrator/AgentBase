/**
 * AgentChatView
 *
 * Chat view component for AgentNode that uses the SDK-based chat.
 * Provides streaming conversation with Claude Code.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useChatSession } from './nodes/AgentChatNode/hooks/useChatSession';
import type { AgentChatMessage } from './types/agent-node';
import './AgentChatView.css';

interface AgentChatViewProps {
  agentId: string;
  sessionId?: string;
  agentType: string;
  workspacePath?: string;
  initialMessages?: AgentChatMessage[];
  onMessagesChange: (messages: AgentChatMessage[]) => void;
  onSessionCreated?: (sessionId: string) => void;
}

export default function AgentChatView({
  agentId,
  sessionId,
  agentType,
  workspacePath,
  initialMessages = [],
  onMessagesChange,
  onSessionCreated,
}: AgentChatViewProps) {
  const [messages, setMessages] = useState<AgentChatMessage[]>(initialMessages);
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
    onMessagesUpdate: useCallback((newMessages: AgentChatMessage[]) => {
      setMessages(newMessages);
      onMessagesChange(newMessages);
    }, [onMessagesChange]),
    onSessionCreated: useCallback((newSessionId: string) => {
      onSessionCreated?.(newSessionId);
    }, [onSessionCreated]),
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

  return (
    <div className="agent-chat-view">
      {/* Messages */}
      <div className="agent-chat-view-messages">
        {messages.length === 0 && (
          <div className="agent-chat-view-empty">
            Start a conversation with Claude Code
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`agent-chat-view-message ${msg.role}`}
          >
            <div className="agent-chat-view-message-role">
              {msg.role === 'user' ? 'You' : 'Claude'}
            </div>
            <div className="agent-chat-view-message-content">
              {msg.content}
              {isStreaming && msg === messages[messages.length - 1] && msg.role === 'assistant' && (
                <span className="agent-chat-view-cursor">▊</span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="agent-chat-view-error">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="agent-chat-view-input-area">
        <textarea
          ref={inputRef}
          className="agent-chat-view-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={isStreaming}
          rows={1}
        />
        <button
          className="agent-chat-view-send"
          onClick={handleSend}
          disabled={!inputValue.trim() || isStreaming}
        >
          {isStreaming ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

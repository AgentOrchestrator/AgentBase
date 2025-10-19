'use client';

import { useState, useEffect, useRef } from 'react';
import { ChatInterface } from './chat-interface';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Loader2, Settings } from 'lucide-react';
import Link from 'next/link';

interface DefaultProvider {
  id: string;
  provider: string;
  is_active: boolean;
  is_default: boolean;
}

interface MentionedUser {
  id: string;
  email: string;
  display_name: string | null;
  mentionText: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  mentionedUsers?: MentionedUser[];
}

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RightSidebar({ isOpen, onClose }: RightSidebarProps) {
  const [defaultProvider, setDefaultProvider] = useState<DefaultProvider | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingProvider, setFetchingProvider] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'system',
      content:
        'Welcome! Ask me about what your teammates are working on by mentioning them with @. For example: "What is @Max currently working on?"',
      timestamp: new Date().toISOString(),
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchDefaultProvider();
    }
  }, [isOpen]);

  const fetchDefaultProvider = async () => {
    setFetchingProvider(true);
    try {
      const response = await fetch('/api/llm-keys/default');
      if (response.ok) {
        const data = await response.json();
        setDefaultProvider(data.defaultProvider);
      }
    } catch (error) {
      console.error('Error fetching default provider:', error);
    } finally {
      setFetchingProvider(false);
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (
    message: string,
    mentionedUsers: MentionedUser[]
  ) => {
    // Add user message to chat
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      mentionedUsers,
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      // Send to API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          mentionedUsers,
        }),
      });

      const data = await response.json();

      // Add assistant response
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response || data.error || 'No response received',
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);

      // Add error message
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request.',
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <div
        className={`fixed right-0 top-0 h-full bg-[var(--sidebar)] border-l border-[var(--border)] transition-transform duration-300 ease-in-out z-40 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: '320px' }}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-[var(--border)] flex justify-between items-center">
            <h2 className="text-lg font-semibold">Chat</h2>
            <button
              onClick={onClose}
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {fetchingProvider ? (
              <div className="flex items-center justify-center h-full text-[var(--muted-foreground)] text-sm text-center p-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : !defaultProvider ? (
              <div className="flex flex-col items-center justify-center h-full text-[var(--muted-foreground)] text-sm text-center p-4 gap-4">
                <div>
                  <p className="mb-2">No default LLM provider configured</p>
                  <p className="text-xs">Configure your API keys in Settings</p>
                </div>
                <Link
                  href="/settings"
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-[var(--sidebar-accent)] hover:bg-[var(--sidebar-accent)]/80 rounded-lg transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  <span>Go to Settings</span>
                </Link>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 ${
                        msg.role === 'user' ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        {msg.role === 'assistant' ? (
                          <AvatarFallback className="bg-blue-500 text-white text-xs">
                            AI
                          </AvatarFallback>
                        ) : msg.role === 'system' ? (
                          <AvatarFallback className="bg-gray-500 text-white text-xs">
                            ℹ️
                          </AvatarFallback>
                        ) : (
                          <AvatarFallback className="bg-green-500 text-white text-xs">
                            You
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div
                        className={`flex-1 space-y-1 ${
                          msg.role === 'user' ? 'text-right' : ''
                        }`}
                      >
                        <div
                          className={`inline-block max-w-[85%] p-3 rounded-lg text-sm ${
                            msg.role === 'user'
                              ? 'bg-blue-500 text-white'
                              : msg.role === 'system'
                                ? 'bg-[var(--sidebar-accent)] text-[var(--muted-foreground)]'
                                : 'bg-[var(--sidebar-accent)]'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                          {msg.mentionedUsers && msg.mentionedUsers.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-white/20 flex flex-wrap gap-1">
                              {msg.mentionedUsers.map((user) => (
                                <span
                                  key={user.id}
                                  className="inline-flex items-center px-2 py-0.5 bg-white/20 text-xs rounded-full"
                                >
                                  {user.mentionText}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-[var(--muted-foreground)] px-1">
                          {formatTimestamp(msg.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="bg-blue-500 text-white text-xs">
                          AI
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="inline-block p-3 rounded-lg bg-[var(--sidebar-accent)]">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-[var(--border)]">
                  <ChatInterface
                    onSendMessage={handleSendMessage}
                    placeholder="Ask about your teammates... Type @"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Backdrop - only visible on mobile/tablet */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
}

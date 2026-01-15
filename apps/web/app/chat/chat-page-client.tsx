'use client';

import { useState } from 'react';
import { ChatInterface } from '@/components/chat-interface';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import type { MentionedUser, WebChatMessage } from '@agent-orchestrator/shared';

export function ChatPageClient() {
  const [messages, setMessages] = useState<WebChatMessage[]>([
    {
      role: 'system',
      content:
        'Welcome! Ask me about what your teammates are working on by mentioning them with @. For example: "What is @Max currently working on?"',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async (
    message: string,
    mentionedUsers: MentionedUser[]
  ) => {
    // Add user message to chat
    const userMessage: WebChatMessage = {
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
      const assistantMessage: WebChatMessage = {
        role: 'assistant',
        content: data.response || data.error || 'No response received',
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);

      // Add error message
      const errorMessage: WebChatMessage = {
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
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <Card className="h-[calc(100vh-8rem)] flex flex-col">
        <CardHeader>
          <CardTitle>Team Chat</CardTitle>
          <p className="text-sm text-muted-foreground">
            Ask about what your teammates are working on using @ mentions
          </p>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${
                  msg.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  {msg.role === 'assistant' ? (
                    <AvatarFallback className="bg-blue-500 text-white">
                      AI
                    </AvatarFallback>
                  ) : msg.role === 'system' ? (
                    <AvatarFallback className="bg-gray-500 text-white">
                      ℹ️
                    </AvatarFallback>
                  ) : (
                    <AvatarFallback className="bg-green-500 text-white">
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
                    className={`inline-block max-w-[80%] p-3 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : msg.role === 'system'
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                          : 'bg-gray-100 dark:bg-gray-800'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
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
                  <div className="text-xs text-muted-foreground px-1">
                    {formatTimestamp(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="bg-blue-500 text-white">
                    AI
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="inline-block p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="border-t pt-4">
            <ChatInterface
              onSendMessage={handleSendMessage}
              placeholder="Ask about your teammates... Type @ to mention"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

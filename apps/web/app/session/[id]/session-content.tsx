"use client";

import { ChatHistory } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { AgentDisplay } from "@/components/agent-display";
import { UserDisplay } from "@/components/user-display";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

interface UserInfo {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  x_github_name: string | null;
  x_github_avatar_url: string | null;
}

interface SessionContentProps {
  session: ChatHistory;
  messages: any[];
  projectPath: string;
  activeMessage?: any;
  messageRefs?: React.MutableRefObject<Record<number, HTMLElement | null>>;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  userInfo?: UserInfo | null;
}

export function SessionContent({ session, messages, projectPath, activeMessage, messageRefs, scrollContainerRef, userInfo }: SessionContentProps) {
  // State for collapsed/expanded user messages - start with all messages collapsed by default
  const [collapsedMessages, setCollapsedMessages] = useState<Set<number>>(new Set());
  const [messageLineCounts, setMessageLineCounts] = useState<Map<number, number>>(new Map());

  // Function to count lines in text content
  const countLines = (text: string): number => {
    if (!text) return 0;
    // Count newlines and add 1 for the last line
    const newlines = (text.match(/\n/g) || []).length;
    // Also account for text wrapping - rough estimate based on character count
    const estimatedWrappedLines = Math.ceil(text.length / 80); // Assuming ~80 chars per line
    return Math.max(newlines + 1, estimatedWrappedLines);
  };

  // Function to toggle message collapse state
  const toggleMessageCollapse = (messageIndex: number) => {
    setCollapsedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageIndex)) {
        newSet.delete(messageIndex);
      } else {
        newSet.add(messageIndex);
      }
      return newSet;
    });
  };

  // Function to determine the best title for the session
  const getSessionTitle = () => {
    // Priority order: ai_title > conversationName > projectName > ai_summary > fallback
    if (session.ai_title) {
      return session.ai_title;
    }
    if (session.metadata?.conversationName) {
      return session.metadata.conversationName;
    }
    if (session.metadata?.projectName) {
      return session.metadata.projectName;
    }
    if (session.ai_summary) {
      // Truncate AI summary if it's too long
      return session.ai_summary.length > 100
        ? session.ai_summary.substring(0, 100) + '...'
        : session.ai_summary;
    }
    // Fallback to a generic title with date
    return `Session from ${new Date(session.created_at).toLocaleDateString()}`;
  };

  // Function to get relative time (Today, Yesterday, or date)
  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const timeString = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    if (targetDate.getTime() === today.getTime()) {
      return `Today at ${timeString}`;
    } else if (targetDate.getTime() === yesterday.getTime()) {
      return `Yesterday at ${timeString}`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Function to format message timestamp for hover display
  const formatMessageTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const timeString = date.toLocaleTimeString([], { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });

    if (targetDate.getTime() === today.getTime()) {
      // Today: just show time like "9:43 PM"
      return timeString;
    } else if (targetDate.getTime() === yesterday.getTime()) {
      // Yesterday: show "Yesterday at 9:43 PM"
      return `Yesterday at ${timeString}`;
    } else {
      // Older dates: show "Jan 15, 2024 at 9:43 PM"
      const dateString = date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
      return `${dateString} at ${timeString}`;
    }
  };

  // Function to get the timestamp of the last message
  const getLastMessageTimestamp = () => {
    // First try to use the dedicated latest_message_timestamp field
    if (session.latest_message_timestamp) {
      return session.latest_message_timestamp;
    }
    
    // Fallback: find the last message with a timestamp
    if (messages.length > 0) {
      // Look for the last message with a timestamp, starting from the end
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].timestamp) {
          return messages[i].timestamp;
        }
      }
    }
    
    // If no message timestamps found, return null
    return null;
  };

  // Function to calculate active time duration
  const getActiveTime = () => {
    // Find the first message with a timestamp
    let firstMessageTimestamp: string | null = null;
    if (messages.length > 0) {
      for (let i = 0; i < messages.length; i++) {
        if (messages[i].timestamp) {
          firstMessageTimestamp = messages[i].timestamp;
          break;
        }
      }
    }
    
    const lastMessageTimestamp = getLastMessageTimestamp();
    
    // If no first or last message timestamp, return "No messages"
    if (!firstMessageTimestamp || !lastMessageTimestamp) {
      return "No messages";
    }
    
    const firstMessage = new Date(firstMessageTimestamp);
    const lastMessage = new Date(lastMessageTimestamp);
    const diffMs = lastMessage.getTime() - firstMessage.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes} min`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  };

  // Count user messages
  const userMessageCount = messages.filter(msg => msg.role === 'user').length;

  // Calculate line counts for messages on mount and when messages change
  useEffect(() => {
    const newLineCounts = new Map<number, number>();
    const newCollapsedMessages = new Set<number>();
    
    messages.forEach((message, index) => {
      if (message.role === 'user') {
        const lineCount = countLines(message.display);
        newLineCounts.set(index, lineCount);
        
        // Auto-collapse messages with more than 10 lines
        if (lineCount > 10) {
          newCollapsedMessages.add(index);
        }
      }
    });
    
    setMessageLineCounts(newLineCounts);
    setCollapsedMessages(newCollapsedMessages);
  }, [messages]);

  return (
    <div ref={scrollContainerRef} className="relative">
      {/* Sticky user message header - positioned relative to viewport */}
      {activeMessage && (
        <div className="fixed top-0 left-0 right-0 bg-white border-b shadow-lg p-4 z-50">
          <div className="container mx-auto max-w-4xl">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs font-bold text-muted-foreground">
                User (Sticky)
              </span>
              {Object.keys(activeMessage.pastedContents || {}).length > 0 && (
                <span className="text-xs bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded">
                  Has attachments
                </span>
              )}
            </div>
            <div className="text-sm">
              <MarkdownRenderer content={activeMessage.display} />
            </div>
            {activeMessage.pastedContents &&
              Object.keys(activeMessage.pastedContents).length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Pasted Content:
                  </div>
                  <div className="bg-muted/50 rounded p-2 text-xs font-mono overflow-x-auto">
                    {Object.entries(activeMessage.pastedContents).map(
                      ([key, value]) => (
                        <div key={key} className="mb-2 last:mb-0">
                          <div className="font-semibold text-muted-foreground">
                            {key}:
                          </div>
                          <div className="whitespace-pre-wrap break-words">
                            {typeof value === "string"
                              ? value
                              : JSON.stringify(value, null, 2)}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Add top padding when sticky message is active to prevent content overlap */}
      <div className={`container mx-auto py-10 space-y-6 px-24 ${activeMessage ? 'pt-32' : ''}`}>
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to overview
          </Link>
        </div>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">
              {getSessionTitle()}
            </CardTitle>
            {userInfo && (
              <CardDescription>
                <div className="flex items-center gap-2">
                  <span>Session by</span>
                  <UserDisplay 
                    displayName={userInfo.display_name}
                    email={userInfo.email}
                    avatarUrl={userInfo.avatar_url}
                    xGithubName={userInfo.x_github_name}
                    xGithubAvatarUrl={userInfo.x_github_avatar_url}
                    className="text-sm"
                  />
                </div>
              </CardDescription>
            )}
            <AgentDisplay agentType={session.agent_type} />
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div>
                <span className="font-medium">Message Count:</span>{" "}
                {userMessageCount} user message{userMessageCount !== 1 ? 's' : ''}
              </div>
              <div>
                <span className="font-medium">Last Updated:</span>{" "}
                {getLastMessageTimestamp() ? getRelativeTime(getLastMessageTimestamp()!) : "No messages"}
              </div>
              <div>
                <span className="font-medium">Active Time:</span>{" "}
                {getActiveTime()}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card mt-4 shadow-none border-none">
          <CardContent className="p-0">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No messages in this session
              </div>
            ) : (
              <div className="space-y-4 p-6">
                {messages.map((message, index) => {
                  // Check if this is the first assistant message in a consecutive sequence
                  const isFirstAssistantInSequence = message.role === 'assistant' && (
                    index === 0 || messages[index - 1].role !== 'assistant'
                  );
                  
                  // Check if this user message should be collapsible
                  const lineCount = messageLineCounts.get(index) || 0;
                  const isCollapsible = message.role === 'user' && lineCount > 10;
                  const isCollapsed = collapsedMessages.has(index);
                  
                  return (
                  <div
                    key={index}
                    ref={(el) => {
                      if (message.role === 'user' && messageRefs) {
                        messageRefs.current[index] = el;
                      }
                    }}
                    data-message-index={index}
                    className={`group rounded-lg p-4 relative ${
                      message.role === 'assistant' 
                        ? '' 
                        : 'border border-border bg-background'
                    } ${
                      activeMessage && activeMessage === message 
                        ? 'opacity-30' 
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      {message.role === 'user' ? (
                        userInfo ? (
                          <UserDisplay 
                            displayName={userInfo.display_name}
                            email={userInfo.email}
                            avatarUrl={userInfo.avatar_url}
                            xGithubName={userInfo.x_github_name}
                            xGithubAvatarUrl={userInfo.x_github_avatar_url}
                            className="text-xs"
                          />
                        ) : (
                          <span className="text-xs font-bold text-muted-foreground">User</span>
                        )
                      ) : message.role === 'assistant' && isFirstAssistantInSequence ? (
                        <div className="text-xs">
                          <AgentDisplay agentType={session.agent_type} />
                        </div>
                      ) : message.role === 'assistant' ? (
                        <span></span>
                      ) : (
                        <span className="text-xs font-bold text-muted-foreground">Message #{index + 1}</span>
                      )}
                      {Object.keys(message.pastedContents || {}).length > 0 && (
                        <span className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                          Has attachments
                        </span>
                      )}
                    </div>
                    
                    {/* Timestamp overlay - positioned absolutely to not affect layout */}
                    {message.timestamp && (
                      <div className="absolute top-2 right-2 text-xs text-muted-foreground/70 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        {formatMessageTimestamp(message.timestamp)}
                      </div>
                    )}
                    <div className="text-sm">
                      {isCollapsible ? (
                        <div>
                          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                            isCollapsed ? 'max-h-20' : 'max-h-none'
                          }`}>
                            <MarkdownRenderer content={message.display} />
                          </div>
                          {isCollapsed && (
                            <div className="mt-2 text-muted-foreground">
                              <span>...</span>
                            </div>
                          )}
                          <button
                            onClick={() => toggleMessageCollapse(index)}
                            className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <span>{isCollapsed ? 'Show more' : 'Show less'}</span>
                            <svg
                              className={`w-3 h-3 transition-transform duration-200 ${
                                isCollapsed ? 'rotate-0' : 'rotate-180'
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <MarkdownRenderer content={message.display} />
                      )}
                    </div>
                    {message.pastedContents &&
                      Object.keys(message.pastedContents).length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="text-xs font-medium text-muted-foreground mb-2">
                            Pasted Content:
                          </div>
                          <div className="bg-muted/50 rounded p-2 text-xs font-mono overflow-x-auto">
                            {Object.entries(message.pastedContents).map(
                              ([key, value]) => (
                                <div key={key} className="mb-2 last:mb-0">
                                  <div className="font-semibold text-muted-foreground">
                                    {key}:
                                  </div>
                                  <div className="whitespace-pre-wrap break-words text-muted-foreground">
                                    {typeof value === "string"
                                      ? value
                                      : JSON.stringify(value, null, 2)}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

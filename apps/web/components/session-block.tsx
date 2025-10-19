'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChatHistory } from '@/lib/supabase';
import { AgentDisplay } from '@/components/agent-display';
import { UserDisplay } from '@/components/user-display';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { Share2, Sparkles } from 'lucide-react';

/**
 * Format timestamp to show relative time for recent activity
 */
function formatLastActive(timestamp: string, currentTime: Date = new Date()): string {
  const date = new Date(timestamp);
  const now = currentTime;
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Get time components for "at" formatting
  const timeString = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (diffMinutes < 1) {
    return "Just now";
  } else if (diffMinutes < 10) {
    return "Live";
  } else if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return `Yesterday at ${timeString}`;
  } else if (diffDays < 7) {
    return `${diffDays} days ago at ${timeString}`;
  } else {
    return date.toLocaleString();
  }
}

/**
 * Check if timestamp is within 10 minutes (should show Live indicator)
 */
function isLive(timestamp: string, currentTime: Date = new Date()): boolean {
  const date = new Date(timestamp);
  const now = currentTime;
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  return diffMinutes < 10;
}

/**
 * Live indicator component with green dot and glowing effect
 */
function LiveIndicator() {
  return (
    <div className="flex items-center gap-1">
      <span>Live</span>
      <div 
        className="w-2 h-2 rounded-full animate-pulse"
        style={{ 
          backgroundColor: '#3cd158',
          boxShadow: '0 0 8px rgba(60, 209, 88, 0.6), 0 0 16px rgba(60, 209, 88, 0.4)',
          animation: 'livePulse 4s ease-in-out infinite'
        }}
      />
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes livePulse {
            0% {
              opacity: 0.3;
              transform: scale(0.9);
              box-shadow: 0 0 4px rgba(60, 209, 88, 0.3), 0 0 8px rgba(60, 209, 88, 0.2);
            }
            25% {
              opacity: 1;
              transform: scale(1);
              box-shadow: 0 0 8px rgba(60, 209, 88, 0.6), 0 0 16px rgba(60, 209, 88, 0.4);
            }
            75% {
              opacity: 1;
              transform: scale(1);
              box-shadow: 0 0 8px rgba(60, 209, 88, 0.6), 0 0 16px rgba(60, 209, 88, 0.4);
            }
            100% {
              opacity: 0.3;
              transform: scale(0.9);
              box-shadow: 0 0 4px rgba(60, 209, 88, 0.3), 0 0 8px rgba(60, 209, 88, 0.2);
            }
          }
        `
      }} />
    </div>
  );
}

/**
 * Get the latest message timestamp from a chat session
 */
function getLatestMessageTimestamp(session: ChatHistory): string {
  return session.latest_message_timestamp || session.updated_at;
}

interface UserInfo {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  x_github_name: string | null;
  x_github_avatar_url: string | null;
}

interface SessionBlockProps {
  session: ChatHistory;
  isCompact?: boolean;
  className?: string;
  userInfo?: UserInfo;
  isPinned?: boolean;
  isInTop3?: boolean;
}

// Component to display conversation messages in the chin
function ConversationDisplay({ messages, session, height = 384, userInfo }: { messages: any[], session: ChatHistory, height?: number, userInfo?: UserInfo }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change (new messages loaded)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        No messages in this session
      </div>
    );
  }

  return (
    <div 
      ref={scrollRef}
      className="space-y-3 overflow-y-auto pr-2 nowheel"
      style={{
        height: `${height}px`,
        scrollbarWidth: 'thin',
        scrollbarColor: '#cbd5e1 #f1f5f9'
      }}
    >
      {messages.map((message, index) => {
        // Check if this is the first assistant message in a consecutive sequence
        const isFirstAssistantInSequence = message.role === 'assistant' && (
          index === 0 || messages[index - 1].role !== 'assistant'
        );
        
        return (
          <div
            key={index}
            className={`rounded-lg p-3 ${
              message.role === 'assistant' 
                ? '' 
                : 'border border-border bg-card'
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
                <span className="text-xs bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded">
                  Has attachments
                </span>
              )}
            </div>
            
            <div className="text-sm">
              <MarkdownRenderer content={message.display} />
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
        );
      })}
    </div>
  );
}

export function SessionBlock({ session, isCompact = false, className = "", userInfo, isPinned = false, isInTop3 = true }: SessionBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [chinHeight, setChinHeight] = useState(384); // Default height in pixels (24rem = 384px)
  const [isResizing, setIsResizing] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startHeight, setStartHeight] = useState(384);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [generatedTitle, setGeneratedTitle] = useState<string | null>(null);
  const heightRef = useRef(384);
  const messages = Array.isArray(session.messages) ? session.messages : [];
  const messageCount = messages.length;

  // Update current time every minute for live timestamp updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60 * 1000); // 1 minute

    return () => clearInterval(interval);
  }, []);

  // Drag handlers for resizing the chin
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    setStartY(e.clientY);
    setStartHeight(heightRef.current);
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    // Calculate the difference from the start position
    const deltaY = e.clientY - startY;
    const newHeight = Math.max(200, Math.min(1200, startHeight + deltaY));
    heightRef.current = newHeight;
    setChinHeight(newHeight);
  }, [isResizing, startY, startHeight]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Keep heightRef in sync with state
  React.useEffect(() => {
    heightRef.current = chinHeight;
  }, [chinHeight]);

  // Add global event listeners when resizing
  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Handle AI title generation
  const handleGenerateTitle = useCallback(async () => {
    if (isGeneratingTitle) return;

    setIsGeneratingTitle(true);
    try {
      const response = await fetch('/api/sessions/generate-title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId: session.id }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.title) {
          setGeneratedTitle(result.title);
          // Title now updates via state, no page reload needed
        }
      } else {
        console.error('Failed to generate title:', await response.text());
      }
    } catch (error) {
      console.error('Error generating title:', error);
    } finally {
      setIsGeneratingTitle(false);
    }
  }, [session.id, isGeneratingTitle]);

  const calculateActiveTime = () => {
    try {
      // Method 1: Delta between first user message and last total message
      const userMessages = messages.filter(msg => msg.role === 'user');
      if (userMessages.length > 0 && messages.length > 0) {
        const firstUserMessage = userMessages[0];
        const lastMessage = messages[messages.length - 1];
        
        if (firstUserMessage.timestamp && lastMessage.timestamp) {
          const firstTime = new Date(firstUserMessage.timestamp);
          const lastTime = new Date(lastMessage.timestamp);
          const diffMs = lastTime.getTime() - firstTime.getTime();
          const diffMinutes = Math.floor(diffMs / (1000 * 60));
          
          if (diffMinutes > 0) {
            if (diffMinutes < 60) {
              return `${diffMinutes} min`;
            } else {
              const hours = Math.floor(diffMinutes / 60);
              const minutes = diffMinutes % 60;
              return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
            }
          }
        }
      }
      
      // Method 2: Fallback to latest_message_timestamp - created_at
      if (session.latest_message_timestamp) {
        const created = new Date(session.created_at);
        const latest = new Date(session.latest_message_timestamp);
        const diffMs = latest.getTime() - created.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        
        if (diffMinutes > 0) {
          if (diffMinutes < 60) {
            return `${diffMinutes} min`;
          } else {
            const hours = Math.floor(diffMinutes / 60);
            const minutes = diffMinutes % 60;
            return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
          }
        }
      }
      
      return "Error";
    } catch (error) {
      return "Error";
    }
  };

  if (isCompact) {
    const shareCount = (session as any).share_count;

    return (
      <div className={`border rounded-lg p-3 bg-card ${isPinned ? 'border-primary' : 'border-border'} ${className}`}>
        <div className="space-y-2">
          {/* Title with Share Indicator */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-card-foreground truncate">
                    {generatedTitle || session.ai_title || session.metadata?.conversationName || 'Unnamed Conversation'}
                  </span>
                  {!generatedTitle && !session.ai_title && (
                    <button
                      className="hover:bg-sidebar-accent rounded p-0.5 transition-colors flex-shrink-0 disabled:opacity-50"
                      title="Generate AI title"
                      onClick={handleGenerateTitle}
                      disabled={isGeneratingTitle}
                    >
                      <Sparkles className={`h-3 w-3 text-black dark:text-white ${isGeneratingTitle ? 'animate-pulse' : ''}`} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
                {session.metadata?.projectName && (
                  <span className="text-[10px] text-muted-foreground truncate">
                    {session.metadata.projectName}
                  </span>
                )}
              </div>
            </div>
            {shareCount !== undefined && shareCount > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex-shrink-0">
                <Share2 className="h-3 w-3" />
                {shareCount}
              </span>
            )}
          </div>

          {/* Agent Type */}
          {session.agent_type && (
            <div className="text-xs">
              <AgentDisplay agentType={session.agent_type} />
            </div>
          )}

          {/* Structured Summary */}
          {session.ai_summary && (() => {
            try {
              const parsed = JSON.parse(session.ai_summary);
              if (parsed.summary && typeof parsed.summary === 'string') {
                return (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-foreground line-clamp-2">
                      {parsed.summary}
                    </div>
                    {parsed.problems && Array.isArray(parsed.problems) && parsed.problems.length > 0 && (
                      <div className="flex flex-wrap gap-0.5">
                        {parsed.problems.slice(0, 2).map((problem: string, idx: number) => (
                          <span
                            key={idx}
                            className="inline-block text-[10px] px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: '#FF357610',
                              color: '#FF3576'
                            }}
                          >
                            {problem}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
            } catch (e) {
              // Fallback to plain text
            }
            return (
              <div className="text-xs text-muted-foreground line-clamp-3">
                {session.ai_summary}
              </div>
            );
          })()}

          {/* Activity Counter and Timestamp */}
          <div className="flex items-center text-xs text-muted-foreground">
            {messageCount > 0 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="mr-1 p-0.5 hover:bg-accent rounded transition-colors"
                aria-label={isExpanded ? "Collapse conversation" : "Expand conversation"}
              >
                <svg 
                  className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
            {messages.filter(msg => msg.role === 'user').length} User {messages.filter(msg => msg.role === 'user').length === 1 ? 'Message' : 'Messages'} • {isLive(getLatestMessageTimestamp(session), currentTime) ? <LiveIndicator /> : formatLastActive(getLatestMessageTimestamp(session), currentTime)}
          </div>

          {/* Chin Section - Expands below the bottom row */}
          {isExpanded && (
            <div className="chin-container mt-2 pt-2 border-t border-border">
              <ConversationDisplay messages={messages} session={session} height={chinHeight} userInfo={userInfo} />
              {/* Resize handle */}
              <div 
                className="w-full h-2 cursor-ns-resize hover:bg-accent transition-colors flex items-center justify-center nodrag"
                onMouseDown={handleMouseDown}
              >
                <div className="w-8 h-0.5 bg-border rounded"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const shareCount = (session as any).share_count;

  return (
    <div className={`border rounded-lg p-4 bg-card ${isPinned ? 'border-primary' : 'border-border'} ${className}`}>
      {messageCount > 0 ? (
        <div className="space-y-3">
          {/* Topic Title with Share Indicator */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-card-foreground truncate">
                    {generatedTitle || session.ai_title || session.metadata?.conversationName || 'Unnamed Conversation'}
                  </span>
                  {!generatedTitle && !session.ai_title && (
                    <button
                      className="hover:bg-sidebar-accent rounded p-0.5 transition-colors flex-shrink-0 disabled:opacity-50"
                      title="Generate AI title"
                      onClick={handleGenerateTitle}
                      disabled={isGeneratingTitle}
                    >
                      <Sparkles className={`h-3 w-3 text-black dark:text-white ${isGeneratingTitle ? 'animate-pulse' : ''}`} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
                {session.metadata?.projectName && (
                  <span className="text-[10px] text-muted-foreground truncate">
                    {session.metadata.projectName}
                  </span>
                )}
              </div>
            </div>
            {shareCount !== undefined && shareCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex-shrink-0">
                <Share2 className="h-3 w-3" />
                {shareCount}
              </span>
            )}
          </div>

          {/* Agent Type */}
          {session.agent_type && (
            <div className="text-sm">
              <AgentDisplay agentType={session.agent_type} />
            </div>
          )}

          {/* Structured Summary */}
          {session.ai_summary && (() => {
            try {
              const parsed = JSON.parse(session.ai_summary);
              if (parsed.summary && typeof parsed.summary === 'string') {
                return (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-foreground">
                      {parsed.summary}
                    </div>
                    {parsed.problems && Array.isArray(parsed.problems) && parsed.problems.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {parsed.problems.map((problem: string, idx: number) => (
                          <span
                            key={idx}
                            className="inline-block text-xs px-2 py-1 rounded-md"
                            style={{
                              backgroundColor: '#FF357610',
                              color: '#FF3576'
                            }}
                          >
                            {problem}
                          </span>
                        ))}
                      </div>
                    )}
                    {parsed.progress && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Status:</span>
                        <span
                          className="inline-block text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: parsed.progress === 'smooth' ? '#10B98110' : '#F59E0B10',
                            color: parsed.progress === 'smooth' ? '#10B981' : '#F59E0B'
                          }}
                        >
                          {parsed.progress === 'smooth' ? '✓ Smooth' : '⟳ Looping'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              }
            } catch (e) {
              // Fallback to plain text
            }
            return (
              <div className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                {session.ai_summary}
              </div>
            );
          })()}

          {/* Activity Counter and Timestamp */}
          <div className="flex items-center text-sm text-muted-foreground">
            {messageCount > 0 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="mr-1 p-1 hover:bg-accent rounded transition-colors"
                aria-label={isExpanded ? "Collapse conversation" : "Expand conversation"}
              >
                <svg 
                  className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
            {messages.filter(msg => msg.role === 'user').length} User {messages.filter(msg => msg.role === 'user').length === 1 ? 'Message' : 'Messages'} • {isLive(getLatestMessageTimestamp(session), currentTime) ? <LiveIndicator /> : formatLastActive(getLatestMessageTimestamp(session), currentTime)}
          </div>

          {/* Chin Section - Expands below the bottom row */}
          {isExpanded && (
            <div className="chin-container mt-3 pt-3 border-t border-border">
              <ConversationDisplay messages={messages} session={session} height={chinHeight} userInfo={userInfo} />
              {/* Resize handle */}
              <div 
                className="w-full h-2 cursor-ns-resize hover:bg-accent transition-colors flex items-center justify-center nodrag"
                onMouseDown={handleMouseDown}
              >
                <div className="w-8 h-0.5 bg-border rounded"></div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          No messages in this session
        </div>
      )}
    </div>
  );
}

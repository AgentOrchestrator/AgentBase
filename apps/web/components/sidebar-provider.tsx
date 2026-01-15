"use client";

import { createContext, useContext, useState, ReactNode, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { RightSidebar } from "./right-sidebar";
import { ChevronRight, Send, Loader2 } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { MentionAutocomplete } from "./mention-autocomplete";
import { supabase } from "@/lib/supabase";
import type { MentionedUser, WebChatMessage } from "@agent-orchestrator/shared";

interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  isRightSidebarOpen: boolean;
  toggleRightSidebar: () => void;
}

interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  x_github_name: string | null;
  x_github_avatar_url: string | null;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

interface SidebarProviderProps {
  children: ReactNode;
}

export function SidebarProvider({ children }: SidebarProviderProps) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [isPillExpanded, setIsPillExpanded] = useState(false);
  const [isPillSquare, setIsPillSquare] = useState(false);
  const [showChatContent, setShowChatContent] = useState(false);
  const [isInputVisible, setIsInputVisible] = useState(false);
  const [isMessagesVisible, setIsMessagesVisible] = useState(false);
  const [isTextVisible, setIsTextVisible] = useState(true);
  
  // Chat state
  const [messages, setMessages] = useState<WebChatMessage[]>([
    // {
    //   role: 'system',
    //   content: 'Welcome! Ask me about what your teammates are working on by mentioning them with @. For example: "What is @Max currently working on?"',
    //   timestamp: new Date().toISOString(),
    // },
  ]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0, showAbove: false });
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionedUsers, setMentionedUsers] = useState<MentionedUser[]>([]);
  const [sending, setSending] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setIsAuthenticated(!!user);
      } catch (error) {
        console.error('Error checking auth:', error);
        setIsAuthenticated(false);
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleRightSidebar = () => {
    setIsRightSidebarOpen(!isRightSidebarOpen);
  };

  const togglePill = () => {
    if (!isPillExpanded) {
      // Hide text immediately when expanding
      setIsTextVisible(false);
      // Both phases start simultaneously
      setIsPillExpanded(true);
      setIsPillSquare(true);
      // Show chat content after expansion completes (300ms) + 50ms delay
      setTimeout(() => {
        setShowChatContent(true);
        // Start messages animation after chat content is shown
        setTimeout(() => {
          setIsMessagesVisible(true);
        }, 100);
        // Start input animation after messages animation
        setTimeout(() => {
          setIsInputVisible(true);
        }, 50);
      }, 350);
    } else {
      // Hide animations immediately when collapsing
      setIsInputVisible(false);
      setIsMessagesVisible(false);
      // Hide chat content immediately when collapsing
      setShowChatContent(false);
      // Both phases collapse simultaneously
      setIsPillSquare(false);
      setIsPillExpanded(false);
      // Start text fade-in animation after collapse completes (300ms + 50ms delay)
      setTimeout(() => {
        setIsTextVisible(true);
      }, 350);
    }
  };

  const collapsePill = () => {
    // First hide animations immediately
    setIsInputVisible(false);
    setIsMessagesVisible(false);
    // First hide content with 50ms delay
    setShowChatContent(false);
    setTimeout(() => {
      // Then collapse the pill
      setIsPillSquare(false);
      setIsPillExpanded(false);
      // Start text fade-in animation after collapse completes (300ms + 50ms delay)
      setTimeout(() => {
        setIsTextVisible(true);
      }, 350);
    }, 50);
  };

  const resetInactivityTimer = () => {
    // Clear existing timeout
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }
    
    // Only set timer if chat is expanded
    if (isPillSquare && showChatContent) {
      inactivityTimeoutRef.current = setTimeout(() => {
        collapsePill();
      }, 60000); // 60 seconds (1 minute)
    }
  };

  const clearInactivityTimer = () => {
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Start inactivity timer when chat content is shown
  useEffect(() => {
    if (showChatContent) {
      resetInactivityTimer();
    } else {
      clearInactivityTimer();
    }
  }, [showChatContent]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      clearInactivityTimer();
    };
  }, []);

  // Auto-focus input when animation completes
  useEffect(() => {
    if (isInputVisible && inputRef.current) {
      // Small delay to ensure the animation has started
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isInputVisible]);

  // Detect @ symbol and show mention autocomplete
  const handleInputChange = (value: string) => {
    setMessage(value);
    const cursorPos = inputRef.current?.selectionStart || 0;
    setCursorPosition(cursorPos);
    
    // Reset inactivity timer on input
    resetInactivityTimer();
    
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(' ')) {
        setMentionSearch(textAfterAt);
        setShowMentions(true);
        
        // Position the mention dropdown
        if (inputRef.current) {
          const rect = inputRef.current.getBoundingClientRect();
          setMentionPosition({
            top: rect.top - 10, // Position just above the input field
            left: rect.left + (lastAtIndex * 8), // Approximate character width
            showAbove: true
          });
        }
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || sending) return;

    // Reset inactivity timer on send
    resetInactivityTimer();

    const userMessage: WebChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      mentionedUsers,
    };

    setMessages((prev) => [...prev, userMessage]);
    setSending(true);
    setMessage('');
    setMentionedUsers([]);

    try {
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

      const assistantMessage: WebChatMessage = {
        role: 'assistant',
        content: data.response || data.error || 'No response received',
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: WebChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatMessageWithMentions = (content: string, mentionedUsers: MentionedUser[] = []) => {
    if (!mentionedUsers.length) return content;
    
    let formattedContent = content;
    mentionedUsers.forEach(user => {
      const mentionText = `@${user.display_name || user.email.split('@')[0]}`;
      const boldMention = `**${mentionText}**`;
      formattedContent = formattedContent.replace(mentionText, boldMention);
    });
    
    return formattedContent;
  };

  const renderMessageContent = (content: string, mentionedUsers: MentionedUser[] = []) => {
    const formattedContent = formatMessageWithMentions(content, mentionedUsers);
    
    // Split by ** to handle bold formatting
    const parts = formattedContent.split(/(\*\*.*?\*\*)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  // Determine if sidebar should be shown
  const isAuthPage = pathname?.startsWith('/login') ||
                     pathname?.startsWith('/register') ||
                     pathname?.startsWith('/auth/callback');
  const shouldShowSidebar = isAuthenticated && !isAuthPage && !authLoading;

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar, isRightSidebarOpen, toggleRightSidebar }}>
      <style jsx>{`
        @keyframes dotPulse {
          0%, 20% { opacity: 0; }
          50% { opacity: 1; }
          80%, 100% { opacity: 0; }
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .fade-gradient-top {
          background: linear-gradient(to bottom, var(--background) 0%, transparent 100%);
        }
        .fade-gradient-bottom {
          background: linear-gradient(to top, var(--background) 0%, transparent 100%);
        }
      `}</style>
      <div className="flex h-screen">
        {/* Left Sidebar - only show when authenticated and not on auth pages */}
        {shouldShowSidebar && (
          <div className={`transition-all duration-300 ease-in-out ${
            isCollapsed ? "w-0 overflow-hidden" : "w-64"
          }`}>
            <Sidebar />
          </div>
        )}

        {/* Main content area */}
        <div className="flex-1 relative">
          {/* Expand button when left sidebar is collapsed - only show if sidebar should be visible */}
          {shouldShowSidebar && isCollapsed && (
            <button
              onClick={toggleSidebar}
              className="absolute top-4 left-4 z-50 p-2 bg-background border border-sidebar-border rounded-md hover:bg-sidebar-accent transition-colors"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4 text-foreground/60" />
            </button>
          )}

          {/* Pill-shaped white box - only show when authenticated */}
          {shouldShowSidebar && (
            <div
              onClick={!isPillSquare ? togglePill : undefined}
              className={`fixed bottom-4 z-30 bg-background border border-border transition-all duration-300 ease-in-out ${
                !isPillSquare ? 'cursor-pointer' : 'cursor-default'
              } ${
                isPillExpanded ? 'w-96' : 'w-40'
              } ${
                isPillSquare ? 'h-96' : 'h-10'
              } ${
                isCollapsed
                  ? 'left-1/2 transform -translate-x-1/2'
                  : 'left-1/2 transform -translate-x-1/2 ml-32'
              }`}
              style={{
                borderRadius: isPillSquare ? '24px' : '20px'
              }}
            >
            {!isPillSquare ? (
              <div className={`text-sm text-foreground text-center flex items-center justify-center h-full transition-all duration-[1000ms] ease-out ${
                isTextVisible 
                  ? 'opacity-100 blur-0' 
                  : 'opacity-0 blur-sm'
              }`}>
                Think with me...
              </div>
            ) : showChatContent ? (
              <div
                className="relative h-full w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  resetInactivityTimer();
                }}
                onScroll={resetInactivityTimer}
              >
                {/* Messages area - fills entire box */}
                <div className={`absolute inset-0 overflow-y-auto p-4 space-y-3 scrollbar-hide ${
                  isMessagesVisible 
                    ? 'opacity-100 blur-0 transition-all duration-[1000ms] ease-out' 
                    : 'opacity-0 blur-sm transition-all duration-[500ms] ease-out'
                }`}>
                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 ${
                          msg.role === 'user'
                            ? 'bg-muted/50 text-foreground dark:bg-sidebar-accent dark:text-foreground'
                            : 'bg-transparent text-foreground'
                        }`}
                      >
                        <div className="text-sm whitespace-pre-wrap">
                          {renderMessageContent(msg.content, msg.mentionedUsers)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {sending && (
                    <div className="flex justify-start">
                      <div className="text-sm text-foreground">
                        Thinking
                        <span className="inline-block ml-1">
                          <span
                            className="inline-block"
                            style={{
                              animation: 'dotPulse 1.5s infinite',
                              animationDelay: '0ms'
                            }}
                          >.</span>
                          <span
                            className="inline-block"
                            style={{
                              animation: 'dotPulse 1.5s infinite',
                              animationDelay: '0.5s'
                            }}
                          >.</span>
                          <span
                            className="inline-block"
                            style={{
                              animation: 'dotPulse 1.5s infinite',
                              animationDelay: '1s'
                            }}
                          >.</span>
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                  {/* Bottom padding to ensure last message is fully visible above white fade */}
                  <div className="h-20" />
                </div>

                {/* Theme-aware fade gradient at top */}
                <div
                  className="absolute top-0 left-0 right-0 h-10 pointer-events-none fade-gradient-top"
                  style={{
                    borderTopLeftRadius: '24px',
                    borderTopRightRadius: '24px'
                  }}
                />

                {/* Collapse nozzle at top */}
                <div
                  className={`absolute top-2 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-muted-foreground/40 rounded-full cursor-pointer hover:bg-muted-foreground/60 transition-all duration-[1000ms] ease-out ${
                    isInputVisible 
                      ? 'opacity-100 blur-0' 
                      : 'opacity-0 blur-sm'
                  }`}
                  onClick={collapsePill}
                  title="Collapse chat"
                />

                {/* Theme-aware fade gradient at bottom */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none fade-gradient-bottom"
                  style={{
                    borderBottomLeftRadius: '24px',
                    borderBottomRightRadius: '24px'
                  }}
                />

                {/* Input area - floating at bottom */}
                <div className={`absolute bottom-4 left-4 right-4 flex gap-2 ${
                  isInputVisible 
                    ? 'opacity-100 blur-0 transition-all duration-[1000ms] ease-out' 
                    : 'opacity-0 blur-sm transition-all duration-[500ms] ease-out'
                }`}>
                  <div className="flex-1 relative">
                    <Input
                      ref={inputRef}
                      value={message}
                      onChange={(e) => handleInputChange(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="What is @Max working on..."
                      className="pr-10 bg-background border-0 rounded-full focus:ring-0 focus:outline-none shadow-lg dark:border"
                      disabled={sending}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                    />
                    {showMentions && (
                      <MentionAutocomplete
                        searchQuery={mentionSearch}
                        position={mentionPosition}
                        onSelect={(user) => {
                          const textBeforeCursor = message.substring(0, cursorPosition);
                          const lastAtIndex = textBeforeCursor.lastIndexOf('@');
                          const newMessage =
                            message.substring(0, lastAtIndex) +
                            `@${user.display_name || user.email.split('@')[0]} ` +
                            message.substring(cursorPosition);
                          setMessage(newMessage);
                          setShowMentions(false);
                          setMentionedUsers([...mentionedUsers, { ...user, mentionText: `@${user.display_name || user.email.split('@')[0]}` }]);
                          inputRef.current?.focus();
                        }}
                        onClose={() => setShowMentions(false)}
                        inputRef={inputRef}
                      />
                    )}
                  </div>
                  <Button
                    onClick={handleSendMessage}
                    disabled={!message.trim() || sending}
                    className={`w-10 h-10 rounded-full shadow-lg p-0 bg-background border-0 hover:bg-muted/50 dark:border ${
                      isInputVisible 
                        ? 'opacity-100 blur-0 transition-all duration-[1000ms] ease-out' 
                        : 'opacity-0 blur-sm transition-all duration-[500ms] ease-out'
                    }`}
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Send className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          )}

          <main className={`overflow-y-auto h-full transition-all duration-300 ease-in-out ${
            isCollapsed ? 'p-6' : 'p-6'
          }`}>
            {children}
          </main>
        </div>

        {/* Right Sidebar */}
        <RightSidebar
          isOpen={isRightSidebarOpen}
          onClose={() => setIsRightSidebarOpen(false)}
        />
      </div>
    </SidebarContext.Provider>
  );
}

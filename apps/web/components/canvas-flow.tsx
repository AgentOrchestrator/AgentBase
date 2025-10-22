'use client';

import { useCallback, useState, useMemo, useEffect } from 'react';
import { useTheme } from '@/lib/theme-context';
import {
  ReactFlow,
  MiniMap,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';
import { ChatHistory } from '@/lib/supabase';
import { SessionBlock } from '@/components/session-block';
import { AgentDisplay } from '@/components/agent-display';
import { AnimatedXMark } from '@/components/animated-x';
import { AnimatedPin } from '@/components/animated-line-with-circle';

interface UserWithMessages {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  x_github_name: string | null;
  x_github_avatar_url: string | null;
  recentMessages: ChatHistory[];
}

interface CanvasFlowProps {
  usersWithMessages: UserWithMessages[];
  initialData?: UserWithMessages[];
}

// Custom node component for conversation blocks
function ConversationNode({ data }: { data: { conversation: ChatHistory; userId: string; userInfo: UserWithMessages; isPinned?: boolean; isInTop3?: boolean; onPinToggle?: (conversationId: string, pinned: boolean) => void; onDelete?: (conversationId: string) => void; animationState?: 'entering' | 'visible' | 'exiting' } }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(data.isPinned || false);
  const [isPinning, setIsPinning] = useState(false);
  const [isVisible, setIsVisible] = useState(data.animationState !== 'entering');

  // Handle animation state changes
  useEffect(() => {
    if (data.animationState === 'entering') {
      // Start fade-in animation
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 50); // Small delay to ensure DOM is ready
      return () => clearTimeout(timer);
    } else if (data.animationState === 'exiting') {
      // Start fade-out animation
      setIsVisible(false);
    } else {
      // Visible state
      setIsVisible(true);
    }
  }, [data.animationState]);

  // Update local isPinned state when prop changes
  useEffect(() => {
    setIsPinned(data.isPinned || false);
  }, [data.isPinned]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onDelete) {
      data.onDelete(data.conversation.id);
    }
  };

  const handlePinToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPinning) return;
    
    setIsPinning(true);
    const newPinnedState = !isPinned;
    
    try {
      const response = await fetch('/api/canvas/pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: data.conversation.id,
          pinned: newPinnedState,
        }),
      });

      if (response.ok) {
        setIsPinned(newPinnedState);
        // Notify parent component of pin state change
        if (data.onPinToggle) {
          data.onPinToggle(data.conversation.id, newPinnedState);
        }
      } else {
        console.error('Failed to toggle pin state');
      }
    } catch (error) {
      console.error('Error toggling pin state:', error);
    } finally {
      setIsPinning(false);
    }
  };

  return (
    <div 
      className={`w-[480px] p-2 relative ${
        isVisible 
          ? 'opacity-100 blur-0 transition-all duration-[1000ms] ease-out' 
          : 'opacity-0 blur-sm transition-all duration-[500ms] ease-out'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        style={{ background: 'transparent', border: 'none' }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="target-right"
        style={{ background: 'transparent', border: 'none' }}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="target-bottom"
        style={{ background: 'transparent', border: 'none' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        style={{ background: 'transparent', border: 'none' }}
      />
      
      {/* Animated X mark icon that appears on hover */}
      {isHovered && (
        <div
          className="absolute top-2 -right-4 w-6 h-6 z-10"
          style={{ zIndex: 1000 }}
        >
          <AnimatedXMark 
            size={16}
            onClick={handleDelete}
          />
        </div>
      )}
      
      {/* Animated pin icon that appears on hover or when pinned */}
      {(isHovered || isPinned) && (
        <div
          className="absolute top-6 -right-4 w-6 h-6 z-10"
          style={{ zIndex: 1000 }}
        >
          <AnimatedPin 
            size={16}
            onClick={handlePinToggle}
            isPinned={isPinned}
            disabled={isPinning}
          />
        </div>
      )}
      
      <SessionBlock session={data.conversation} isCompact={false} userInfo={data.userInfo} isPinned={isPinned} isInTop3={data.isInTop3} />
    </div>
  );
}

// Custom node component for user circles
function UserNode({ data }: { data: { label: string; userId: string; userEmail: string; avatarUrl: string | null; displayName: string | null; xGithubName: string | null; xGithubAvatarUrl: string | null; isLinked: boolean; onToggleLink: (userId: string) => void; onShowConversations: (userId: string) => void; onToggleConversations: (userId: string) => void; isConversationsOpen: boolean; sessionLimit: number; totalAvailable: number; onIncreaseLimit: (userId: string, maxAvailable: number) => void; onDecreaseLimit: (userId: string, maxAvailable: number) => void; animationState?: 'entering' | 'visible' | 'exiting'; hasRecentMessages?: boolean } }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(data.animationState !== 'entering');
  
  // Handle animation state changes
  useEffect(() => {
    if (data.animationState === 'entering') {
      // Start fade-in animation
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 50); // Small delay to ensure DOM is ready
      return () => clearTimeout(timer);
    } else if (data.animationState === 'exiting') {
      // Start fade-out animation
      setIsVisible(false);
    } else {
      // Visible state
      setIsVisible(true);
    }
  }, [data.animationState]);

  const displayText = data.xGithubName || data.displayName || data.userEmail;
  const avatarToUse = data.xGithubAvatarUrl || data.avatarUrl;
  const fallbackInitial = (data.xGithubName || data.displayName || data.userEmail).charAt(0);
  const hasRecentMessages = data.hasRecentMessages ?? true;

  const handleToggleLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    data.onToggleLink(data.userId);
  };

  const handleToggleConversations = (e: React.MouseEvent) => {
    e.stopPropagation();
    data.onToggleConversations(data.userId);
  };

  return (
    <div
      className={`flex flex-col items-center relative ${
        isVisible
          ? 'opacity-100 blur-0 transition-all duration-[1000ms] ease-out'
          : 'opacity-0 blur-sm transition-all duration-[500ms] ease-out'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={!hasRecentMessages ? 'No new messages in the last 24 hours' : undefined}
    >
      <Handle
        type="source"
        position={Position.Top}
        id="source-top"
        style={{ background: 'transparent', border: 'none' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        style={{ background: 'transparent', border: 'none' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        style={{ background: 'transparent', border: 'none' }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="source-left"
        style={{ background: 'transparent', border: 'none' }}
      />
      
      {/* Chain icon that appears on hover or when linked */}
      {(isHovered || data.isLinked) && (
        <button
          onClick={handleToggleLink}
          className={`absolute top-3 -right-4 w-6 h-6 flex items-center justify-center transition-all duration-200 z-10 rounded-full group ${
            data.isLinked 
              ? 'bg-background border border-border hover:bg-border hover:border-background' 
              : 'bg-background border border-border hover:bg-border hover:border-background'
          }`}
          style={{ zIndex: 1000 }}
          title={data.isLinked ? "Unlink user" : "Link user"}
        >
          <svg 
            viewBox="0 0 207.105 209.204" 
            className={`w-3 h-3 transition-all duration-200 ${
              data.isLinked 
                ? 'text-border group-hover:text-background' 
                : 'text-border group-hover:text-background'
            }`}
            fill="currentColor"
          >
            <path d="M104.773 63.5376L91.7847 76.7212C104.675 77.7954 113.074 81.604 119.421 87.9517C136.511 105.042 136.414 129.26 119.519 146.155L87.5855 177.991C70.5933 194.983 46.5698 195.081 29.48 178.088C12.3902 160.901 12.4878 136.877 29.48 119.885L48.6206 100.745C45.8862 94.5923 45.2027 87.2681 46.2769 80.9204L17.5659 109.534C-5.77391 132.971-5.96922 166.174 17.6636 189.807C41.3941 213.538 74.5972 213.342 97.937 190.002L131.335 156.506C154.773 133.069 154.968 99.8657 131.238 76.2329C125.085 70.0806 117.273 65.6861 104.773 63.5376ZM102.332 144.006L115.32 130.823C102.429 129.846 94.0308 125.94 87.6831 119.592C70.5933 102.502 70.6909 78.2837 87.5855 61.3892L119.421 29.5532C136.511 12.5611 160.535 12.4634 177.625 29.5532C194.714 46.6431 194.519 70.7642 177.625 87.6587L158.484 106.799C161.218 113.049 161.804 120.276 160.828 126.624L189.539 98.0103C212.878 74.5728 213.074 41.4673 189.441 17.7368C165.71-5.99363 132.507-5.79832 109.07 17.6392L75.7691 51.0376C52.3316 74.4751 52.1362 107.678 75.8667 131.311C82.0191 137.463 89.8316 141.858 102.332 144.006Z" fill="currentColor"/>
          </svg>
        </button>
      )}
      
      {/* Plus/X icon that appears on hover below chain icon at edge connection point */}
      {isHovered && (
        <button
          onClick={handleToggleConversations}
          className="absolute top-1/2 -right-4 w-6 h-6 flex items-center justify-center transition-all duration-200 z-10 bg-background border border-border rounded-full hover:bg-border hover:border-background group"
          style={{ zIndex: 1000, transform: 'translateY(-50%)' }}
          title={data.isConversationsOpen ? "Hide conversations" : "Show all conversations"}
        >
          <svg 
            viewBox="0 0 24 24" 
            className={`w-3 h-3 text-border group-hover:text-background transition-all duration-200 ${
              data.isConversationsOpen ? 'rotate-45' : 'rotate-0'
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      )}
      
      {avatarToUse ? (
        <img
          src={avatarToUse}
          alt={displayText}
          className={`w-20 h-20 rounded-full border-2 border-border object-cover transition-all duration-300 ${
            !hasRecentMessages ? 'opacity-40 grayscale' : ''
          }`}
        />
      ) : (
        <div className={`w-20 h-20 rounded-full border-2 border-border bg-muted flex items-center justify-center text-muted-foreground font-semibold text-sm transition-all duration-300 ${
          !hasRecentMessages ? 'opacity-40 grayscale' : ''
        }`}>
          {fallbackInitial.toUpperCase()}
        </div>
      )}
      <div className={`mt-2 text-xs text-center font-medium text-muted-foreground max-w-24 truncate transition-all duration-300 ${
        !hasRecentMessages ? 'opacity-40' : ''
      }`}>
        {displayText}
      </div>

      {/* Session limit controls or no messages indicator */}
      {!hasRecentMessages ? (
        <div className="mt-2 text-xs text-muted-foreground font-medium opacity-40">
          No messages in last 24h
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onDecreaseLimit(data.userId, data.totalAvailable);
            }}
            className="w-5 h-5 flex items-center justify-center bg-background border border-border rounded hover:bg-border hover:border-background transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Show fewer sessions"
            disabled={data.sessionLimit <= 1}
          >
            <svg
              viewBox="0 0 24 24"
              className="w-3 h-3 text-border hover:text-background"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14"/>
            </svg>
          </button>
          <span className="text-xs text-muted-foreground font-medium min-w-[4ch] text-center">
            {data.sessionLimit}/{data.totalAvailable}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onIncreaseLimit(data.userId, data.totalAvailable);
            }}
            className="w-5 h-5 flex items-center justify-center bg-background border border-border rounded hover:bg-border hover:border-background transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Show more sessions"
            disabled={data.sessionLimit >= data.totalAvailable}
          >
            <svg
              viewBox="0 0 24 24"
              className="w-3 h-3 text-border hover:text-background"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// Helper functions for timestamp formatting (same as chat-histories-list.tsx)
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

function isLive(timestamp: string, currentTime: Date = new Date()): boolean {
  const date = new Date(timestamp);
  const now = currentTime;
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  return diffMinutes < 10;
}

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

function getLatestMessageTimestamp(session: ChatHistory): string {
  return session.latest_message_timestamp || session.updated_at;
}

// Custom node component for user conversations panel
function UserConversationsNode({ data }: { data: { userId: string; userInfo: UserWithMessages; conversations: ChatHistory[]; onClose: () => void; isClosing: boolean; getVisibleConversations: (user: UserWithMessages) => ChatHistory[]; pinnedConversations: Set<string>; onAddToCanvas: (conversationId: string, userId?: string) => void; onRemoveFromCanvas: (conversationId: string) => void; onPinFromPanel: (conversationId: string) => void } }) {
  const [isLoading, setIsLoading] = useState(false);
  const [allConversations, setAllConversations] = useState<ChatHistory[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreConversations, setHasMoreConversations] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Show panel with animation on mount
  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Track when component is mounted to avoid hydration mismatch with time formatting
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handle closing animation when parent signals to close
  useEffect(() => {
    if (data.isClosing) {
      setIsVisible(false);
    }
  }, [data.isClosing]);

  // Load initial 15 conversations for this user when component mounts
  useEffect(() => {
    const loadInitialConversations = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/canvas/user-conversations?userId=${data.userId}&limit=15&offset=0`);
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setAllConversations(result.conversations);
            setTotalCount(result.totalCount || 0);
            setHasMoreConversations(result.conversations.length === 15 && (result.totalCount || 0) > 15);
          }
        }
      } catch (error) {
        console.error('Error loading user conversations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialConversations();
  }, [data.userId]);

  // Load more conversations function
  const loadMoreConversations = async () => {
    setIsLoadingMore(true);
    try {
      const response = await fetch(`/api/canvas/user-conversations?userId=${data.userId}&limit=15&offset=${allConversations.length}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setAllConversations(prev => [...prev, ...result.conversations]);
          setHasMoreConversations(result.conversations.length === 15 && allConversations.length + result.conversations.length < (result.totalCount || 0));
        }
      }
    } catch (error) {
      console.error('Error loading more conversations:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Handle close with animation
  const handleClose = () => {
    setIsVisible(false);
    // Wait for animation to complete before calling onClose
    setTimeout(() => {
      data.onClose();
    }, 350); // Slightly longer to ensure animation completes
  };

  const displayText = data.userInfo.x_github_name || data.userInfo.display_name || data.userInfo.email;
  const avatarToUse = data.userInfo.x_github_avatar_url || data.userInfo.avatar_url;
  const fallbackInitial = (data.userInfo.x_github_name || data.userInfo.display_name || data.userInfo.email).charAt(0);

  // Helper function to check if a conversation is visible on the canvas
  const isConversationVisibleOnCanvas = (conversation: ChatHistory) => {
    const visibleConversations = data.getVisibleConversations(data.userInfo);
    return visibleConversations.some(visible => visible.id === conversation.id);
  };

  return (
    <div 
      className="fixed top-0 right-0 w-1/2 h-full bg-card border-l border-border z-50 overflow-hidden flex flex-col"
      style={{
        transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 300ms ease-in-out'
      }}
    >
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              {avatarToUse ? (
                <img 
                  src={avatarToUse} 
                  alt={displayText}
                  className="h-5 w-5 rounded-full object-cover"
                />
              ) : (
                <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-semibold">
                  {fallbackInitial.toUpperCase()}
                </div>
              )}
              <span className="font-semibold text-muted-foreground truncate">
                {displayText}
              </span>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-accent rounded"
            title="Close"
          >
            <svg 
              viewBox="0 0 24 24" 
              className="h-4 w-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-border"></div>
          </div>
        ) : allConversations.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No conversations found for this user.</p>
          </div>
        ) : (
          <div className="space-y-3 pr-5">
            {allConversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`border rounded-lg p-4 hover:bg-accent transition-colors cursor-pointer max-w-[calc(100%-20px)] relative group ${
                  data.pinnedConversations.has(conversation.id)
                    ? 'border-primary border-2'
                    : 'border-border'
                }`}
                onClick={() => window.open(`/session/${conversation.id}`, '_blank')}
              >
                {/* Animated X mark icon (when visible on canvas) or Eye icon (when not visible) */}
                {isConversationVisibleOnCanvas(conversation) ? (
                  <div
                    className="absolute top-1 -right-8 w-6 h-6 z-10 opacity-0 hover:opacity-100 group-hover:opacity-100"
                    style={{ zIndex: 1000 }}
                  >
                    <AnimatedXMark 
                      size={16}
                      onClick={(e) => {
                        e.stopPropagation();
                        data.onRemoveFromCanvas(conversation.id);
                      }}
                    />
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      data.onAddToCanvas(conversation.id, data.userId);
                    }}
                    className="absolute top-1 -right-7 w-6 h-6 flex items-center justify-center transition-all duration-200 z-10 opacity-0 hover:opacity-100 group-hover:opacity-100"
                    style={{ zIndex: 1000 }}
                    title="Show on canvas"
                  >
                    <svg 
                      viewBox="0 0 264.746 166.113" 
                      className="w-3 h-3 text-muted-foreground hover:text-foreground"
                      fill="currentColor"
                    >
                      <path d="M132.422 166.016C210.645 166.016 264.746 102.734 264.746 83.0078C264.746 63.1836 210.547 0 132.422 0C55.1758 0 0 63.1836 0 83.0078C0 102.734 55.1758 166.016 132.422 166.016ZM132.422 137.598C102.246 137.598 77.832 113.086 77.832 83.0078C77.832 52.832 102.246 28.418 132.422 28.418C162.5 28.418 187.012 52.832 187.012 83.0078C187.012 113.086 162.5 137.598 132.422 137.598ZM132.422 102.93C143.457 102.93 152.344 94.043 152.344 83.0078C152.344 71.9727 143.457 63.0859 132.422 63.0859C121.387 63.0859 112.5 71.9727 112.5 83.0078C112.5 94.043 121.387 102.93 132.422 102.93Z" fill="currentColor"/>
                    </svg>
                  </button>
                )}
                
                {/* Animated pin icon that appears on hover or when pinned */}
                {(data.pinnedConversations.has(conversation.id) || true) && (
                  <div
                    className={`absolute top-7 -right-8 w-6 h-6 z-10 ${
                      data.pinnedConversations.has(conversation.id) 
                        ? 'opacity-100' 
                        : 'opacity-0 hover:opacity-100 group-hover:opacity-100'
                    }`}
                    style={{ zIndex: 1000 }}
                  >
                    <AnimatedPin 
                      size={16}
                      onClick={(e) => {
                        e.stopPropagation();
                        data.onPinFromPanel(conversation.id);
                      }}
                      isPinned={data.pinnedConversations.has(conversation.id)}
                    />
                  </div>
                )}
                
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium text-muted-foreground truncate">
                    {conversation.ai_title || conversation.metadata?.conversationName || conversation.metadata?.projectName || 'Untitled Session'}
                  </h3>
                  <div className="text-sm text-muted-foreground font-bold ml-2 flex-shrink-0" suppressHydrationWarning>
                    {isMounted ? (
                      isLive(getLatestMessageTimestamp(conversation)) ? (
                        <LiveIndicator />
                      ) : (
                        formatLastActive(getLatestMessageTimestamp(conversation))
                      )
                    ) : (
                      new Date(getLatestMessageTimestamp(conversation)).toLocaleString()
                    )}
                  </div>
                </div>
                
                {conversation.agent_type && (
                  <div className="mb-2">
                    <AgentDisplay agentType={conversation.agent_type} />
                  </div>
                )}
                
                {conversation.ai_summary && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {conversation.ai_summary}
                  </p>
                )}
                
                <div className="text-sm text-muted-foreground mt-2">
                  <span className="font-bold">{Array.isArray(conversation.messages) ? conversation.messages.filter(msg => msg.role === 'user').length : 0}</span> User Messages • <span className="font-bold">{(() => {
                    try {
                      const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
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
                      if (conversation.latest_message_timestamp) {
                        const created = new Date(conversation.created_at);
                        const latest = new Date(conversation.latest_message_timestamp);
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
                      
                      // Method 3: Error case
                      return "Error";
                    } catch (error) {
                      return "Error";
                    }
                  })()}</span> of Active Time
                </div>
              </div>
            ))}
            
            {/* Load More Button */}
            {hasMoreConversations && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={loadMoreConversations}
                  disabled={isLoadingMore}
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingMore ? "Loading..." : `Load More (${allConversations.length} of ${totalCount})`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Define custom node types
const nodeTypes: NodeTypes = {
  conversation: ConversationNode,
  user: UserNode,
};

const flowKey = 'canvas-flow';

function CanvasFlowInner({ usersWithMessages, initialData }: CanvasFlowProps) {
  const { theme } = useTheme();
  
  // State for managing users data
  const [usersData, setUsersData] = useState<UserWithMessages[]>(initialData || usersWithMessages);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  
  // State for user conversations panel
  const [showUserConversations, setShowUserConversations] = useState<{
    userId: string;
    userInfo: UserWithMessages;
    conversations: ChatHistory[];
  } | null>(null);
  const [isClosingPanel, setIsClosingPanel] = useState(false);

  // Debug logging
  // console.log('CanvasFlow - received users:', usersData.length);
  // console.log('CanvasFlow - users data:', usersData);

  // State for tracking which users have linked dragging enabled
  const [linkedUsers, setLinkedUsers] = useState<Set<string>>(new Set());

  // Function to toggle linked state for a user
  const toggleLinkedUser = useCallback((userId: string) => {
    setLinkedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  }, []);

  // Function to toggle user conversations
  const handleToggleUserConversations = useCallback((userId: string) => {
    const userInfo = usersData.find(user => user.id === userId);
    if (userInfo) {
      // If the same user's panel is already open, start closing animation
      if (showUserConversations && showUserConversations.userId === userId) {
        setIsClosingPanel(true);
        // Wait for animation to complete before removing
        setTimeout(() => {
          setShowUserConversations(null);
          setIsClosingPanel(false);
        }, 350);
      } else {
        // Open the panel for this user
        setShowUserConversations({
          userId,
          userInfo,
          conversations: userInfo.recentMessages
        });
      }
    }
  }, [usersData, showUserConversations]);

  // Function to close user conversations panel
  const handleCloseUserConversations = useCallback(() => {
    setShowUserConversations(null);
  }, []);

  // State for pinned conversations
  const [pinnedConversations, setPinnedConversations] = useState<Set<string>>(new Set());
  const [isLoadingPinned, setIsLoadingPinned] = useState(true);

  // State for manually managed conversations (added/removed from canvas)
  const [manuallyAddedConversations, setManuallyAddedConversations] = useState<Set<string>>(new Set());
  const [manuallyRemovedConversations, setManuallyRemovedConversations] = useState<Set<string>>(new Set());

  // Track which user a manually added conversation belongs to (conversationId -> userId mapping)
  const [conversationUserMapping, setConversationUserMapping] = useState<Map<string, string>>(new Map());

  // State for node animations
  const [nodeAnimationStates, setNodeAnimationStates] = useState<Map<string, 'entering' | 'visible' | 'exiting'>>(new Map());

  // State for session limit per user (loaded from localStorage)
  const [sessionLimits, setSessionLimits] = useState<Map<string, number>>(() => {
    // Load from localStorage on initial mount
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('canvas-session-limits');
        if (saved) {
          const parsed = JSON.parse(saved);
          return new Map(Object.entries(parsed));
        }
      } catch (error) {
        console.error('Failed to load session limits from localStorage:', error);
      }
    }
    return new Map();
  });

  // Save session limits to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const limitsObject = Object.fromEntries(sessionLimits);
        localStorage.setItem('canvas-session-limits', JSON.stringify(limitsObject));
      } catch (error) {
        console.error('Failed to save session limits to localStorage:', error);
      }
    }
  }, [sessionLimits]);

  // Function to manage node animation states
  const updateNodeAnimationState = useCallback((nodeId: string, state: 'entering' | 'visible' | 'exiting') => {
    setNodeAnimationStates(prev => {
      const newMap = new Map(prev);
      newMap.set(nodeId, state);
      return newMap;
    });
  }, []);

  // Function to refresh data from API
  const refreshData = useCallback(async () => {
    if (isRefreshing || isUserInteracting) return;
    
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/canvas/data');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setUsersData(result.data);
          // Update pinned conversations from the combined response
          if (result.pinnedConversationIds) {
            setPinnedConversations(new Set(result.pinnedConversationIds));
          }
          setLastRefresh(new Date());
        } else {
          console.error('API returned error:', result.error);
        }
      } else {
        console.error('Failed to fetch canvas data:', response.statusText);
      }
    } catch (error) {
      console.error('Error refreshing canvas data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, isUserInteracting]);

  // Set up Supabase Realtime subscriptions for instant updates
  useEffect(() => {
    let mounted = true;
    let supabaseClient: typeof import('@/lib/supabase').supabase | null = null;

    const setupRealtimeSubscriptions = async () => {
      // Dynamically import supabase client (client-side only)
      const { supabase } = await import('@/lib/supabase');
      supabaseClient = supabase;

      if (!mounted) {
        return; // Component unmounted before setup completed
      }

      console.log('Supabase client initialized');

      // Subscribe to chat_histories changes
      supabase
        .channel('canvas-chat-histories')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'chat_histories'
          },
          (payload: any) => {
            console.log('Chat histories change detected:', payload);
            refreshData();
          }
        )
        .subscribe();

      // Subscribe to pinned_conversations changes
      supabase
        .channel('canvas-pinned-conversations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pinned_conversations'
          },
          (payload: any) => {
            console.log('Pinned conversations change detected:', payload);
            refreshData();
          }
        )
        .subscribe();

      // Subscribe to session_shares changes (for share count updates)
      supabase
        .channel('canvas-session-shares')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'session_shares'
          },
          (payload: any) => {
            console.log('Session shares change detected:', payload);
            refreshData();
          }
        )
        .subscribe();

      // Subscribe to session_workspace_shares changes
      supabase
        .channel('canvas-workspace-shares')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'session_workspace_shares'
          },
          (payload: any) => {
            console.log('Workspace shares change detected:', payload);
            refreshData();
          }
        )
        .subscribe();
    };

    setupRealtimeSubscriptions();

    // Cleanup subscriptions on unmount
    return () => {
      console.log('Unmounting CanvasFlowInner');
      mounted = false;

      // Only cleanup if we have a supabase client instance
      if (supabaseClient) {
        // Remove only our specific channels to avoid interfering with other components
        const channelsToRemove = [
          'canvas-chat-histories',
          'canvas-pinned-conversations',
          'canvas-session-shares',
          'canvas-workspace-shares'
        ];

        const client = supabaseClient; // Create a const reference for TypeScript
        channelsToRemove.forEach(channelName => {
          const channel = client.channel(channelName);
          client.removeChannel(channel);
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount, refreshData is stable via useCallback


  // Track user interactions to prevent refresh during dragging
  useEffect(() => {
    const handleMouseDown = () => setIsUserInteracting(true);
    const handleMouseUp = () => setIsUserInteracting(false);
    
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Fetch pinned conversations on mount (now included in initial data)
  useEffect(() => {
    // Pinned conversations are now fetched as part of the initial server-side render
    // and updates come from refreshData(), so we just need to mark as loaded
    setIsLoadingPinned(false);
  }, []);

  // Helper function to get total available sessions for a user
  const getTotalAvailableSessions = useCallback((user: UserWithMessages) => {
    // Calculate total conversations that would be shown without limit
    const availableConversations = new Set<ChatHistory>();

    user.recentMessages.forEach(conv => {
      if (pinnedConversations.has(conv.id) ||
          manuallyAddedConversations.has(conv.id) ||
          !manuallyRemovedConversations.has(conv.id)) {
        availableConversations.add(conv);
      }
    });

    return availableConversations.size;
  }, [pinnedConversations, manuallyAddedConversations, manuallyRemovedConversations]);

  // Function to determine which conversations should be visible for a user
  const getVisibleConversations = useCallback((user: UserWithMessages) => {
    // Sort all conversations by latest_message_timestamp (most recent first)
    const sortedConversations = [...user.recentMessages].sort((a, b) => {
      const aTime = new Date(a.latest_message_timestamp || a.updated_at).getTime();
      const bTime = new Date(b.latest_message_timestamp || b.updated_at).getTime();
      return bTime - aTime;
    });

    // Start with all conversations and apply user preferences
    const visibleConversations = new Set<ChatHistory>();

    // 1. Add pinned conversations (highest priority - always show if pinned)
    user.recentMessages.forEach(conv => {
      if (pinnedConversations.has(conv.id)) {
        visibleConversations.add(conv);
      }
    });

    // 2. Add manually added conversations - ONLY if they belong to this user
    user.recentMessages.forEach(conv => {
      if (manuallyAddedConversations.has(conv.id)) {
        // Check if this conversation was explicitly added for this user
        const mappedUserId = conversationUserMapping.get(conv.id);
        if (!mappedUserId || mappedUserId === user.id) {
          visibleConversations.add(conv);
        }
      }
    });

    // 3. Add ALL recent conversations from last 24h (only if not manually removed and not already added)
    // The API already filters to last 24 hours, so show all of them
    sortedConversations.forEach(conv => {
      if (!manuallyRemovedConversations.has(conv.id) && !visibleConversations.has(conv)) {
        visibleConversations.add(conv);
      }
    });

    // 4. Apply session limit - keep only the most recent N sessions (sorted by timestamp)
    const totalAvailable = visibleConversations.size;
    const limit = sessionLimits.get(user.id) ?? totalAvailable; // Default to all available sessions
    const allVisible = Array.from(visibleConversations);

    // Sort by timestamp again to ensure proper ordering
    const sortedVisible = allVisible.sort((a, b) => {
      const aTime = new Date(a.latest_message_timestamp || a.updated_at).getTime();
      const bTime = new Date(b.latest_message_timestamp || b.updated_at).getTime();
      return bTime - aTime;
    });

    // Return only the top N sessions
    return sortedVisible.slice(0, limit);
  }, [pinnedConversations, manuallyAddedConversations, manuallyRemovedConversations, sessionLimits, conversationUserMapping]);

  // Handle session limit increase/decrease
  const handleIncreaseSessionLimit = useCallback((userId: string, maxAvailable: number) => {
    setSessionLimits(prev => {
      const newMap = new Map(prev);
      const currentLimit = newMap.get(userId) ?? maxAvailable;
      // Don't exceed the maximum available sessions
      if (currentLimit < maxAvailable) {
        newMap.set(userId, currentLimit + 1);
      }
      return newMap;
    });
  }, []);

  const handleDecreaseSessionLimit = useCallback((userId: string, maxAvailable: number) => {
    setSessionLimits(prev => {
      const newMap = new Map(prev);
      const currentLimit = newMap.get(userId) ?? maxAvailable;
      // Minimum 1 session
      if (currentLimit > 1) {
        newMap.set(userId, currentLimit - 1);
      }
      return newMap;
    });
  }, []);

  // Handle pin toggle
  const handlePinToggle = useCallback((conversationId: string, pinned: boolean) => {
    setPinnedConversations(prev => {
      const newSet = new Set(prev);
      if (pinned) {
        newSet.add(conversationId);
      } else {
        newSet.delete(conversationId);
      }
      return newSet;
    });
  }, []);

  // Function to add conversation to canvas (eye icon)
  const handleAddConversationToCanvas = useCallback((conversationId: string, userId?: string) => {
    setManuallyAddedConversations(prev => new Set(prev).add(conversationId));
    setManuallyRemovedConversations(prev => {
      const newSet = new Set(prev);
      newSet.delete(conversationId);
      return newSet;
    });
    // Store the user association if provided
    if (userId) {
      setConversationUserMapping(prev => new Map(prev).set(conversationId, userId));
    }
    // Trigger entering animation for the new conversation node
    updateNodeAnimationState(`conversation-${conversationId}`, 'entering');
  }, [updateNodeAnimationState]);

  // Function to remove conversation from canvas (X icon)
  const handleRemoveConversationFromCanvas = useCallback(async (conversationId: string) => {
    // If the conversation is pinned, unpin it first
    if (pinnedConversations.has(conversationId)) {
      try {
        const response = await fetch('/api/canvas/pin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversationId: conversationId,
            pinned: false,
          }),
        });

        if (response.ok) {
          setPinnedConversations(prev => {
            const newSet = new Set(prev);
            newSet.delete(conversationId);
            return newSet;
          });
        } else {
          console.error('Failed to unpin conversation');
        }
      } catch (error) {
        console.error('Error unpinning conversation:', error);
      }
    }

    // Trigger exiting animation for the conversation node first
    updateNodeAnimationState(`conversation-${conversationId}`, 'exiting');
    
    // Wait for animation to complete before actually removing from visible conversations
    setTimeout(() => {
      setManuallyRemovedConversations(prev => new Set(prev).add(conversationId));
      setManuallyAddedConversations(prev => {
        const newSet = new Set(prev);
        newSet.delete(conversationId);
        return newSet;
      });
    }, 500); // Match the fade-out animation duration (500ms)
  }, [updateNodeAnimationState, pinnedConversations]);

  // Function to pin conversation from panel
  const handlePinConversationFromPanel = useCallback(async (conversationId: string) => {
    const isCurrentlyPinned = pinnedConversations.has(conversationId);
    const newPinnedState = !isCurrentlyPinned;
    
    try {
      const response = await fetch('/api/canvas/pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: conversationId,
          pinned: newPinnedState,
        }),
      });

      if (response.ok) {
        setPinnedConversations(prev => {
          const newSet = new Set(prev);
          if (newPinnedState) {
            newSet.add(conversationId);
          } else {
            newSet.delete(conversationId);
          }
          return newSet;
        });
      } else {
        console.error('Failed to toggle pin state');
      }
    } catch (error) {
      console.error('Error toggling pin state:', error);
    }
  }, [pinnedConversations]);

  // Helper function to check if two nodes are colliding (with buffer)
  const checkCollision = useCallback((node1: Node, node2: Node) => {
    const node1Width = node1.type === 'user' ? 120 : 480;
    const node1Height = node1.type === 'user' ? 120 : 200;
    const node2Width = node2.type === 'user' ? 120 : 480;
    const node2Height = node2.type === 'user' ? 120 : 200;

    // Add buffer space to prevent nodes from being too close
    const buffer = 30; // 30px buffer around each node

    return (
      node1.position.x < node2.position.x + node2Width + buffer &&
      node1.position.x + node1Width + buffer > node2.position.x &&
      node1.position.y < node2.position.y + node2Height + buffer &&
      node1.position.y + node1Height + buffer > node2.position.y
    );
  }, []);

  // Helper function to calculate repulsion force between two nodes
  const calculateRepulsionForce = useCallback((node1: Node, node2: Node) => {
    const node1Width = node1.type === 'user' ? 120 : 480;
    const node1Height = node1.type === 'user' ? 120 : 200;
    const node2Width = node2.type === 'user' ? 120 : 480;
    const node2Height = node2.type === 'user' ? 120 : 200;

    // Calculate centers
    const center1 = {
      x: node1.position.x + node1Width / 2,
      y: node1.position.y + node1Height / 2
    };
    const center2 = {
      x: node2.position.x + node2Width / 2,
      y: node2.position.y + node2Height / 2
    };

    // Calculate distance between centers
    const dx = center2.x - center1.x;
    const dy = center2.y - center1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // If nodes are too close, calculate repulsion force
    // Increased buffer to 50px for better spacing
    const minDistance = Math.max(node1Width, node1Height) / 2 + Math.max(node2Width, node2Height) / 2 + 50;

    if (distance < minDistance && distance > 0) {
      // Calculate repulsion strength (stronger when closer)
      const repulsionStrength = (minDistance - distance) / minDistance;
      const force = repulsionStrength * 80; // Increased force multiplier for stronger push

      // Calculate unit vector for repulsion direction
      const unitX = dx / distance;
      const unitY = dy / distance;

      return {
        x: -unitX * force,
        y: -unitY * force
      };
    }

    return { x: 0, y: 0 };
  }, []);

  // Calculate initial nodes and edges
  const initialNodes = useMemo(() => {
    const nodes: Node[] = [];
    
    if (usersData.length === 0 || isLoadingPinned) {
      return nodes;
    }
    
    // Calculate optimal spacing based on number of users
    const canvasWidth = 3000;
    const canvasHeight = 1800;
    const userNodeSize = 120;
    const conversationNodeWidth = 480;
    const conversationNodeHeight = 200;
    
    // Calculate user positions in a circle or grid layout
    const userPositions: { x: number; y: number }[] = [];
    
    if (usersData.length <= 4) {
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;
      const radius = Math.min(canvasWidth, canvasHeight) * 0.45;
      
      usersData.forEach((_, index) => {
        const angle = (2 * Math.PI * index) / usersData.length;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        userPositions.push({ x, y });
      });
    } else {
      const cols = Math.ceil(Math.sqrt(usersData.length));
      const rows = Math.ceil(usersData.length / cols);
      const cellWidth = (canvasWidth * 0.8) / cols;
      const cellHeight = (canvasHeight * 0.8) / rows;
      const startX = canvasWidth * 0.1;
      const startY = canvasHeight * 0.1;
      
      usersData.forEach((_, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = startX + col * cellWidth + cellWidth / 2;
        const y = startY + row * cellHeight + cellHeight / 2;
        userPositions.push({ x, y });
      });
    }
    
    // Create user nodes
    usersData.forEach((user, userIndex) => {
      const position = userPositions[userIndex];
      const totalAvailable = getTotalAvailableSessions(user);
      const hasRecentMessages = user.recentMessages && user.recentMessages.length > 0;

      const userNode: Node = {
        id: `user-${user.id}`,
        type: 'user',
        position: { x: position.x - userNodeSize / 2, y: position.y - userNodeSize / 2 },
        data: {
          label: user.x_github_name || user.display_name || user.email,
          userId: user.id,
          userEmail: user.email,
          avatarUrl: user.avatar_url,
          displayName: user.display_name,
          xGithubName: user.x_github_name,
          xGithubAvatarUrl: user.x_github_avatar_url,
          isLinked: linkedUsers.has(user.id),
          onToggleLink: toggleLinkedUser,
          onShowConversations: handleToggleUserConversations,
          onToggleConversations: handleToggleUserConversations,
          isConversationsOpen: showUserConversations?.userId === user.id,
          sessionLimit: sessionLimits.get(user.id) ?? totalAvailable,
          totalAvailable: totalAvailable,
          onIncreaseLimit: handleIncreaseSessionLimit,
          onDecreaseLimit: handleDecreaseSessionLimit,
          animationState: nodeAnimationStates.get(`user-${user.id}`) || 'visible',
          hasRecentMessages: hasRecentMessages
        },
        style: {
          background: 'transparent',
          border: 'none',
        },
      };

      nodes.push(userNode);
    });
    
    // Create conversation nodes - use a Map to prevent duplicates
    const conversationNodesMap = new Map<string, Node>();

    usersData.forEach((user, userIndex) => {
      const userPos = userPositions[userIndex];

      // Get visible conversations for this user and sort by latest_message_timestamp (newest first)
      const visibleConversations = getVisibleConversations(user).sort((a, b) => {
        const aTime = new Date(a.latest_message_timestamp || a.updated_at).getTime();
        const bTime = new Date(b.latest_message_timestamp || b.updated_at).getTime();
        return bTime - aTime; // Descending order (newest first)
      });

      // Keep top 3 IDs for styling differentiation (e.g., different border or badge)
      const top3Ids = new Set(visibleConversations.slice(0, 3).map(conv => conv.id));

      visibleConversations.forEach((conversation, conversationIndex) => {
        const conversationNodeId = `conversation-${conversation.id}`;

        // Skip if this conversation was already added by another user
        if (conversationNodesMap.has(conversationNodeId)) {
          return;
        }

        // Calculate position in a spiral/circle pattern, starting from top and going clockwise
        // This ensures newest conversations are at the top
        const positions = visibleConversations.length;

        // Start from top (270 degrees / -90 degrees) and go clockwise
        // This places the newest conversation at the top
        const startAngle = -Math.PI / 2; // -90 degrees (top position)
        const angle = startAngle + (2 * Math.PI * conversationIndex) / Math.max(positions, 4);

        // Increase radius based on number of conversations to prevent overlaps
        // More conversations = larger radius
        // Use pullDistance (120px) instead of conversationDistance (300px) for tighter initial layout
        const pullDistance = 120;
        let radius = pullDistance;
        if (positions > 4) {
          radius = pullDistance + (positions - 4) * 20; // Add 20px for each conversation beyond 4
        }

        const x = userPos.x + radius * Math.cos(angle) - conversationNodeWidth / 2;
        const y = userPos.y + radius * Math.sin(angle) - conversationNodeHeight / 2;

        const conversationNode: Node = {
          id: conversationNodeId,
          type: 'conversation',
          position: { x, y },
          data: {
            conversation: conversation,
            userId: user.id,
            userInfo: user,
            isPinned: pinnedConversations.has(conversation.id),
            isInTop3: top3Ids.has(conversation.id),
            onPinToggle: handlePinToggle,
            onDelete: handleRemoveConversationFromCanvas,
            animationState: nodeAnimationStates.get(conversationNodeId) || 'visible',
          },
        };

        conversationNodesMap.set(conversationNodeId, conversationNode);
      });
    });

    // Add all conversation nodes to the nodes array
    conversationNodesMap.forEach(node => nodes.push(node));
    
    // Apply repulsion to prevent overlapping during initial positioning
    const applyRepulsionToNodes = (nodes: Node[]) => {
      const repulsionIterations = 15; // Increased iterations for better collision resolution
      let updatedNodes = [...nodes];

      for (let iteration = 0; iteration < repulsionIterations; iteration++) {
        let hasCollisions = false;

        for (let i = 0; i < updatedNodes.length; i++) {
          for (let j = i + 1; j < updatedNodes.length; j++) {
            const node1 = updatedNodes[i];
            const node2 = updatedNodes[j];

            if (checkCollision(node1, node2)) {
              hasCollisions = true;

              // Calculate repulsion forces with stronger push
              const force1 = calculateRepulsionForce(node1, node2);
              const force2 = calculateRepulsionForce(node2, node1);

              // Apply forces to both nodes (only move conversation nodes, not user nodes)
              if (node1.type === 'conversation') {
                updatedNodes[i] = {
                  ...node1,
                  position: {
                    x: node1.position.x + force1.x * 1.5, // Amplify repulsion
                    y: node1.position.y + force1.y * 1.5
                  }
                };
              }

              if (node2.type === 'conversation') {
                updatedNodes[j] = {
                  ...node2,
                  position: {
                    x: node2.position.x + force2.x * 1.5, // Amplify repulsion
                    y: node2.position.y + force2.y * 1.5
                  }
                };
              }
            }
          }
        }

        // If no collisions in this iteration, we can stop early
        if (!hasCollisions) {
          console.log(`Collision resolution completed in ${iteration + 1} iterations`);
          break;
        }
      }

      return updatedNodes;
    };

    return applyRepulsionToNodes(nodes);
  }, [usersData, isLoadingPinned, getVisibleConversations, pinnedConversations, handlePinToggle, linkedUsers, toggleLinkedUser, showUserConversations, nodeAnimationStates, checkCollision, calculateRepulsionForce, sessionLimits, handleIncreaseSessionLimit, handleDecreaseSessionLimit, handleToggleUserConversations, handleRemoveConversationFromCanvas, getTotalAvailableSessions]);


  const initialEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];
    
    if (isLoadingPinned) {
      return edges;
    }
    
    usersData.forEach(user => {
      const visibleConversations = getVisibleConversations(user);
      // Remove duplicates by using a Map with conversation ID as key
      const uniqueConversations = new Map();
      visibleConversations.forEach(conversation => {
        uniqueConversations.set(conversation.id, conversation);
      });
      
      uniqueConversations.forEach((conversation) => {
        // Calculate which handles provide the shortest path between nodes
        const userNode = initialNodes.find(node => node.id === `user-${user.id}`);
        const conversationNode = initialNodes.find(node => node.id === `conversation-${conversation.id}`);

        if (userNode && conversationNode) {
          const convCenterX = conversationNode.position.x + 240; // Conversation node is 480px wide, so center is at +240
          const convCenterY = conversationNode.position.y + 100; // Conversation node is 200px tall, so center is at +100

          // Calculate user node handle positions (on edge of 120x120 circle)
          const userHandles = [
            { id: 'source-top', x: userNode.position.x + 60, y: userNode.position.y },
            { id: 'source-right', x: userNode.position.x + 120, y: userNode.position.y + 60 },
            { id: 'source-bottom', x: userNode.position.x + 60, y: userNode.position.y + 120 },
            { id: 'source-left', x: userNode.position.x, y: userNode.position.y + 60 }
          ];

          // Calculate conversation node handle positions (on edge of 480x200 rectangle)
          const convHandles = [
            { id: 'target-top', x: convCenterX, y: conversationNode.position.y },
            { id: 'target-right', x: conversationNode.position.x + 480, y: convCenterY },
            { id: 'target-bottom', x: convCenterX, y: conversationNode.position.y + 200 },
            { id: 'target-left', x: conversationNode.position.x, y: convCenterY }
          ];

          // Find the pair of handles with the shortest distance
          let minDistance = Infinity;
          let bestSourceHandle = 'source-right';
          let bestTargetHandle = 'target-left';

          userHandles.forEach(sourceHandle => {
            convHandles.forEach(targetHandle => {
              const distance = Math.sqrt(
                Math.pow(targetHandle.x - sourceHandle.x, 2) +
                Math.pow(targetHandle.y - sourceHandle.y, 2)
              );

              if (distance < minDistance) {
                minDistance = distance;
                bestSourceHandle = sourceHandle.id;
                bestTargetHandle = targetHandle.id;
              }
            });
          });

          edges.push({
            id: `edge-${user.id}-${conversation.id}`,
            source: `user-${user.id}`,
            target: `conversation-${conversation.id}`,
            sourceHandle: bestSourceHandle,
            targetHandle: bestTargetHandle,
            type: 'default',
            style: { 
              stroke: linkedUsers.has(user.id) 
                ? (theme === 'dark' ? '#ffffff' : '#000000')
                : (theme === 'dark' ? '#2A2C36' : '#d1d5db'), 
              strokeWidth: 2,
              strokeDasharray: '5,5'
            },
            animated: true,
          });
        }
      });
    });
    
    return edges;
  }, [usersData, initialNodes, isLoadingPinned, getVisibleConversations]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [rfInstance, setRfInstance] = useState<any>(null);
  const { setViewport } = useReactFlow();

  // Custom onNodesChange handler for group dragging
  const handleNodesChange = useCallback((changes: any[]) => {
    // Process changes to add group dragging behavior
    const additionalChanges: any[] = [];

    changes.forEach((change) => {
      if (change.type === 'position' && change.position && change.dragging) {
        const node = nodes.find(n => n.id === change.id);

        // Check if this is a user node being dragged
        if (node && node.type === 'user' && node.data && 'userId' in node.data) {
          const userId = node.data.userId as string;
          const deltaX = change.position.x - node.position.x;
          const deltaY = change.position.y - node.position.y;

          // Only apply group dragging if there's actual movement
          if (deltaX !== 0 || deltaY !== 0) {
            // Apply elasticity factor (0.95 = slight lag for elastic feel)
            const elasticity = 0.95;

            // Create position changes for conversation nodes
            nodes.forEach((n) => {
              if (n.type === 'conversation' && n.data && 'userId' in n.data && n.data.userId === userId) {
                additionalChanges.push({
                  id: n.id,
                  type: 'position',
                  position: {
                    x: n.position.x + (deltaX * elasticity),
                    y: n.position.y + (deltaY * elasticity)
                  }
                });
              }
            });
          }
        }
      }
    });

    // Apply original changes plus additional conversation node movements
    onNodesChange([...changes, ...additionalChanges]);
  }, [nodes, onNodesChange]);


  // Update nodes when initialNodes change, preserving existing positions and managing animations
  useEffect(() => {
    if (initialNodes.length > 0) {
      setNodes(prevNodes => {
        // If this is the first load (no previous nodes), use initial positions
        if (prevNodes.length === 0) {
          // Mark all nodes as entering for initial load
          initialNodes.forEach(node => {
            updateNodeAnimationState(node.id, 'entering');
          });
          return initialNodes;
        }
        
        // Track which nodes are new, existing, or removed
        const prevNodeIds = new Set(prevNodes.map(node => node.id));
        const newNodeIds = new Set(initialNodes.map(node => node.id));
        
        // Mark removed nodes as exiting
        prevNodes.forEach(node => {
          if (!newNodeIds.has(node.id)) {
            updateNodeAnimationState(node.id, 'exiting');
            // Remove the node after animation completes
            setTimeout(() => {
              setNodeAnimationStates(prev => {
                const newMap = new Map(prev);
                newMap.delete(node.id);
                return newMap;
              });
            }, 500); // Match fade-out animation duration
          }
        });
        
        // Preserve existing positions for nodes that still exist
        const positionMap = new Map();
        prevNodes.forEach(node => {
          positionMap.set(node.id, node.position);
        });
        
        const updatedNodes = initialNodes.map(newNode => {
          const existingPosition = positionMap.get(newNode.id);
          const isNewNode = !prevNodeIds.has(newNode.id);

          // For new nodes, set animation state to 'entering' directly in the node data
          const nodeData = isNewNode
            ? { ...newNode.data, animationState: 'entering' as const }
            : newNode.data;

          // Debug log for newly added nodes
          if (isNewNode && newNode.type === 'conversation') {
            const convData = newNode.data as { conversation: ChatHistory; userId?: string };
            const mappedUserId = conversationUserMapping.get(convData.conversation.id);
            console.log(`✨ NEW Session Added: "${convData.conversation.metadata?.conversationName || 'Untitled'}"`, {
              conversationId: convData.conversation.id,
              belongsToUserId: convData.userId,
              manuallyMappedToUserId: mappedUserId || '(auto)',
              initialPosition: { x: Math.round(newNode.position.x), y: Math.round(newNode.position.y) }
            });
          }

          if (existingPosition) {
            return {
              ...newNode,
              data: nodeData,
              position: existingPosition
            };
          }
          return {
            ...newNode,
            data: nodeData
          };
        });

        return updatedNodes;
      });
    }
  }, [initialNodes, setNodes, updateNodeAnimationState, conversationUserMapping]);



  // Update edges when initialEdges change
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Function to calculate the closest handles (both source and target) for the shortest path
  const calculateClosestHandles = useCallback((userNode: Node, conversationNode: Node) => {
    const userCenterX = userNode.position.x + 60; // User node is 120px wide, so center is at +60
    const userCenterY = userNode.position.y + 60; // User node is 120px tall, so center is at +60

    const convCenterX = conversationNode.position.x + 240; // Conversation node is 480px wide, so center is at +240
    const convCenterY = conversationNode.position.y + 100; // Conversation node is 200px tall, so center is at +100

    // Calculate user node handle positions (on edge of 120x120 circle)
    const userHandles = [
      { id: 'source-top', x: userNode.position.x + 60, y: userNode.position.y },
      { id: 'source-right', x: userNode.position.x + 120, y: userNode.position.y + 60 },
      { id: 'source-bottom', x: userNode.position.x + 60, y: userNode.position.y + 120 },
      { id: 'source-left', x: userNode.position.x, y: userNode.position.y + 60 }
    ];

    // Calculate conversation node handle positions (on edge of 480x200 rectangle)
    const convHandles = [
      { id: 'target-top', x: convCenterX, y: conversationNode.position.y },
      { id: 'target-right', x: conversationNode.position.x + 480, y: convCenterY },
      { id: 'target-bottom', x: convCenterX, y: conversationNode.position.y + 200 },
      { id: 'target-left', x: conversationNode.position.x, y: convCenterY }
    ];

    // Find the pair of handles with the shortest distance
    let minDistance = Infinity;
    let bestSourceHandle = 'source-right';
    let bestTargetHandle = 'target-left';

    userHandles.forEach(sourceHandle => {
      convHandles.forEach(targetHandle => {
        const distance = Math.sqrt(
          Math.pow(targetHandle.x - sourceHandle.x, 2) +
          Math.pow(targetHandle.y - sourceHandle.y, 2)
        );

        if (distance < minDistance) {
          minDistance = distance;
          bestSourceHandle = sourceHandle.id;
          bestTargetHandle = targetHandle.id;
        }
      });
    });

    return {
      sourceHandle: bestSourceHandle,
      targetHandle: bestTargetHandle
    };
  }, []);

  // Update edges when nodes change position
  useEffect(() => {
    if (nodes.length > 0) {
      const updatedEdges = edges.map(edge => {
        const userNode = nodes.find(node => node.id === edge.source);
        const conversationNode = nodes.find(node => node.id === edge.target);

        if (userNode && conversationNode) {
          const { sourceHandle, targetHandle } = calculateClosestHandles(userNode, conversationNode);
          return {
            ...edge,
            sourceHandle: sourceHandle,
            targetHandle: targetHandle
          };
        }
        return edge;
      });

      setEdges(updatedEdges);
    }
  }, [nodes, calculateClosestHandles, setEdges]);

  // Save function using Supabase API
  const onSave = useCallback(async () => {
    if (rfInstance && nodes.length > 0) {
      try {
        const response = await fetch('/api/canvas/layout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ nodes }),
        });

        if (!response.ok) {
          console.error('Failed to save canvas layout:', response.statusText);
        }
      } catch (error) {
        console.error('Error saving canvas layout:', error);
      }
    }
  }, [rfInstance, nodes]);

  // Auto-save when nodes change (with proper debouncing)
  useEffect(() => {
    if (rfInstance && nodes.length > 0) {
      const timeoutId = setTimeout(async () => {
        try {
          const response = await fetch('/api/canvas/layout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ nodes }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to save canvas layout:', response.status, response.statusText, errorText);
          } else {
            console.log('Canvas layout saved successfully');
          }
        } catch (error) {
          console.error('Error saving canvas layout:', error);
          // Log more details about the error
          if (error instanceof TypeError && error.message === 'Failed to fetch') {
            console.error('Network error - check if user is authenticated and API is accessible');
          }
        }
      }, 500); // Reduced to 500ms for faster saving

      return () => clearTimeout(timeoutId);
    }
  }, [nodes, rfInstance]); // Removed onSave from dependencies

  // Auto-restore layout on first load only
  useEffect(() => {
    if (initialNodes.length > 0 && nodes.length === 0) {
      const restoreLayout = async () => {
        try {
          const response = await fetch('/api/canvas/layout');
          
          if (response.ok) {
            const data = await response.json();
            const savedLayout = data.layout || {};
            console.log('Saved layout:', savedLayout)
            if (Object.keys(savedLayout).length > 0) {
              // Apply saved positions to nodes where available, otherwise use initial positions
              const updatedNodes = initialNodes.map(node => {
                const savedPosition = savedLayout[node.id];
                if (savedPosition) {
                  // Use saved position from database
                  return {
                    ...node,
                    position: {
                      x: savedPosition.x,
                      y: savedPosition.y
                    }
                  };
                }
                // No saved position - use the initial position (already pulled close to anchor)
                return node;
              });

              setNodes(updatedNodes);
              console.log('Canvas layout restored successfully');

              // Debug: Log all node positions with user associations
              console.group('🎯 Canvas Node Positions');
              updatedNodes.forEach(node => {
                if (node.type === 'user') {
                  const userData = node.data as { displayName?: string; userEmail?: string; userId?: string };
                  console.log(`👤 User Profile: ${userData.displayName || userData.userEmail}`, {
                    nodeId: node.id,
                    userId: userData.userId,
                    position: { x: Math.round(node.position.x), y: Math.round(node.position.y) }
                  });
                } else if (node.type === 'conversation') {
                  const convData = node.data as { conversation: ChatHistory; userId?: string; isPinned?: boolean; isInTop3?: boolean };
                  const mappedUserId = conversationUserMapping.get(convData.conversation.id);
                  console.log(`💬 Session Card: "${convData.conversation.metadata?.conversationName || 'Untitled'}"`, {
                    nodeId: node.id,
                    conversationId: convData.conversation.id,
                    belongsToUserId: convData.userId,
                    manuallyMappedToUserId: mappedUserId || '(auto)',
                    position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
                    isPinned: convData.isPinned,
                    isInTop3: convData.isInTop3
                  });
                }
              });
              console.groupEnd();
            } else {
              // No saved layout at all - use initial positions (already pulled close to anchors)
              setNodes(initialNodes);
              console.log('No saved layout found, using default positions with session cards close to anchors');

              // Debug: Log all node positions with user associations
              console.group('🎯 Canvas Node Positions (Initial)');
              initialNodes.forEach(node => {
                if (node.type === 'user') {
                  const userData = node.data as { displayName?: string; userEmail?: string; userId?: string };
                  console.log(`👤 User Profile: ${userData.displayName || userData.userEmail}`, {
                    nodeId: node.id,
                    userId: userData.userId,
                    position: { x: Math.round(node.position.x), y: Math.round(node.position.y) }
                  });
                } else if (node.type === 'conversation') {
                  const convData = node.data as { conversation: ChatHistory; userId?: string; isPinned?: boolean; isInTop3?: boolean };
                  const mappedUserId = conversationUserMapping.get(convData.conversation.id);
                  console.log(`💬 Session Card: "${convData.conversation.metadata?.conversationName || 'Untitled'}"`, {
                    nodeId: node.id,
                    conversationId: convData.conversation.id,
                    belongsToUserId: convData.userId,
                    manuallyMappedToUserId: mappedUserId || '(auto)',
                    position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
                    isPinned: convData.isPinned,
                    isInTop3: convData.isInTop3
                  });
                }
              });
              console.groupEnd();
            }
          } else {
            const errorText = await response.text();
            console.error('Failed to load canvas layout:', response.status, response.statusText, errorText);
            // Fallback to default positions
            setNodes(initialNodes);
          }
        } catch (error) {
          console.error('Error loading canvas layout:', error);
          // Log more details about the error
          if (error instanceof TypeError && error.message === 'Failed to fetch') {
            console.error('Network error during layout restoration - check if user is authenticated and API is accessible');
          }
          // Fallback to default positions
          setNodes(initialNodes);
        }
      };

      restoreLayout();
    }
  }, [initialNodes, nodes.length, setNodes, conversationUserMapping]); // Only run on first load

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div 
      className={`w-full h-screen relative ${theme === 'light' ? 'canvas-light-bg' : ''}`}
      style={{
        backgroundColor: theme === 'light' ? '#F5F5F5' : undefined
      }}
    >
      {/* Sync indicator */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={refreshData}
          disabled={isRefreshing}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed group relative text-card-foreground"
        >
          <div className="flex items-center gap-2">
            <svg 
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync
          </div>
          {lastRefresh && (
            <div className="absolute top-1/2 right-full transform -translate-y-1/2 mr-2 px-2 py-1 bg-gray-600 text-white text-xs rounded opacity-0 group-hover:opacity-100 group-hover:delay-2000 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
              Last sync: {Math.floor((new Date().getTime() - lastRefresh.getTime()) / 60000)} min ago
            </div>
          )}
        </button>
      </div>
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setRfInstance}
        nodeTypes={nodeTypes}
        fitView
        style={{ backgroundColor: theme === 'light' ? '#F5F5F5' : 'var(--background)' }}
        defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
        minZoom={0.1}
        maxZoom={4}
        panOnScroll={true}
        zoomOnScroll={false}
        panOnDrag={true}
        zoomOnPinch={true}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        selectNodesOnDrag={false}
        deleteKeyCode={null}
        multiSelectionKeyCode={null}
      >
      </ReactFlow>

      {/* User Conversations Panel */}
      {showUserConversations && (
        <UserConversationsNode
          data={{
            userId: showUserConversations.userId,
            userInfo: showUserConversations.userInfo,
            conversations: showUserConversations.conversations,
            onClose: handleCloseUserConversations,
            isClosing: isClosingPanel,
            getVisibleConversations: getVisibleConversations,
            pinnedConversations: pinnedConversations,
            onAddToCanvas: handleAddConversationToCanvas,
            onRemoveFromCanvas: handleRemoveConversationFromCanvas,
            onPinFromPanel: handlePinConversationFromPanel
          }}
        />
      )}
    </div>
  );
}

export default function CanvasFlow({ usersWithMessages, initialData }: CanvasFlowProps) {
  return (
    <ReactFlowProvider>
      <CanvasFlowInner usersWithMessages={usersWithMessages} initialData={initialData} />
    </ReactFlowProvider>
  );
}
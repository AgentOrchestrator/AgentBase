"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, ChatHistory } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { SearchBar } from "@/components/search-bar";
import {
  SearchFiltersComponent,
  SearchFilters,
} from "@/components/search-filters";
import { AgentDisplay } from "@/components/agent-display";
import { UserDisplay } from "@/components/user-display";

/**
 * Format timestamp to show relative time for recent activity
 * Smart progression: minutes ago → hours ago → yesterday at time → X days ago at time → full date/time
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
 * Returns the latest_message_timestamp field, falling back to updated_at if not available
 */
function getLatestMessageTimestamp(session: ChatHistory): string {
  // Use the dedicated latest_message_timestamp field which is specifically
  // maintained to track when the last message was added to the session
  return session.latest_message_timestamp || session.updated_at;
}

type GroupedChat = {
  path: string;
  sessions: ChatHistory[];
  totalMessages: number;
  lastActivity: string;
};

function groupChatsByPath(histories: ChatHistory[]): GroupedChat[] {
  const grouped = new Map<string, ChatHistory[]>();

  // Filter out sessions without messages
  const historiesWithMessages = histories.filter((history) => {
    const messages = Array.isArray(history.messages) ? history.messages : [];
    return messages.length > 0;
  });

  historiesWithMessages.forEach((history) => {
    // For Cursor sessions, use ai_title or conversationName if available, otherwise use projectPath
    let groupKey: string;
    if (history.agent_type === 'cursor' && (history.ai_title || history.metadata?.conversationName)) {
      groupKey = history.ai_title || history.metadata.conversationName!;
    } else {
      groupKey = history.metadata?.projectPath || "/";
    }

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, []);
    }
    grouped.get(groupKey)!.push(history);
  });

  return Array.from(grouped.entries())
    .map(([path, sessions]) => {
      // Sort sessions by latest message timestamp (updated_at) descending within each group
      const sortedSessions = sessions.sort(
        (a, b) =>
          new Date(getLatestMessageTimestamp(b)).getTime() -
          new Date(getLatestMessageTimestamp(a)).getTime()
      );

      return {
        path,
        sessions: sortedSessions,
        totalMessages: sortedSessions.reduce(
          (sum, s) => sum + (Array.isArray(s.messages) ? s.messages.length : 0),
          0
        ),
        lastActivity: getLatestMessageTimestamp(sortedSessions[0]),
      };
    })
    .sort(
      (a, b) =>
        new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
}

type HistoryWithMatch = ChatHistory & {
  matchedIn?: string[];
  snippet?: string;
};

interface UserInfo {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  x_github_name: string | null;
  x_github_avatar_url: string | null;
}

export function ChatHistoriesList({
  initialHistories,
  totalCount,
  userInfoMap,
  allUsers,
}: {
  initialHistories: ChatHistory[];
  totalCount: number;
  userInfoMap: Map<string, UserInfo>;
  allUsers: Map<string, UserInfo>;
}) {
  const [histories, setHistories] = useState<ChatHistory[]>(initialHistories);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<HistoryWithMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  const [isMounted, setIsMounted] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Track when component is mounted to avoid hydration mismatch with time formatting
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Subscribe to realtime changes on chat_histories table
    const channel = supabase
      .channel("chat-histories-changes")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "chat_histories",
        },
        (payload) => {
          console.log("Realtime update received:", payload);

          if (payload.eventType === "INSERT") {
            setHistories((current) => [payload.new as ChatHistory, ...current]);
          } else if (payload.eventType === "UPDATE") {
            setHistories((current) =>
              current.map((history) =>
                history.id === payload.new.id
                  ? (payload.new as ChatHistory)
                  : history
              )
            );
          } else if (payload.eventType === "DELETE") {
            setHistories((current) =>
              current.filter((history) => history.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-collapse all groups by default
  useEffect(() => {
    const groupedChats = groupChatsByPath(histories);
    const allGroups = new Set(
      groupedChats.map((group) => group.path)
    );
    setCollapsedGroups(allGroups);
  }, [histories]);

  const groupedChats = groupChatsByPath(histories);

  const toggleGroup = (path: string) => {
    setCollapsedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const handleSearch = useCallback(
    async (query: string, filters: SearchFilters = searchFilters) => {
      setSearchQuery(query);

      if (!query || query.trim().length === 0) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        // Build query params with filters
        const params = new URLSearchParams({ q: query });
        if (filters.dateFrom) params.append("dateFrom", filters.dateFrom);
        if (filters.dateTo) params.append("dateTo", filters.dateTo);
        if (filters.agentType) params.append("agentType", filters.agentType);
        if (filters.projectPath)
          params.append("projectPath", filters.projectPath);

        const response = await fetch(`/api/search?${params.toString()}`);
        const data = await response.json();
        setSearchResults(data.results || []);
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [searchFilters]
  );

  const handleFiltersChange = useCallback(
    (newFilters: SearchFilters) => {
      setSearchFilters(newFilters);
      if (searchQuery) {
        handleSearch(searchQuery, newFilters);
      }
    },
    [searchQuery, handleSearch]
  );

  const loadMoreSessions = async () => {
    setIsLoadingMore(true);
    try {
      const { data, error } = await supabase
        .from("chat_histories")
        .select("*")
        .order("latest_message_timestamp", { ascending: false })
        .range(histories.length, histories.length + 24); // Load 25 more (0-indexed, so +24)

      if (error) {
        console.error("Error loading more sessions:", error);
        return;
      }

      if (data && data.length > 0) {
        setHistories((current) => [...current, ...data]);
      }
    } catch (error) {
      console.error("Error loading more sessions:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const hasMoreSessions = histories.length < totalCount;

  // Determine what to display
  const displayGroupedChats = searchQuery ? groupChatsByPath(searchResults) : groupedChats;
  const displayCount = searchQuery ? searchResults.length : histories.length;

  // Get unique agent types for filter
  const uniqueAgentTypes = Array.from(
    new Set(
      histories
        .map((h) => h.agent_type)
        .filter((type): type is string => !!type)
    )
  );

  return (
    <div className="container mx-auto py-10 space-y-6 px-24">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sessions</h1>
          <p className="text-muted-foreground mt-2">
            {searchQuery
              ? `Search results for "${searchQuery}"`
              : "Overview of all chat sessions grouped by project path"}
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {searchQuery
            ? `${displayCount} result${displayCount !== 1 ? 's' : ''} found`
            : `${histories.length} total sessions across ${groupedChats.length} projects`}
        </div>
      </div>

      {/* Search Bar with Filters */}
      <div className="flex gap-3">
        <div className="flex-1">
          <SearchBar
            onSearch={handleSearch}
            isSearching={isSearching}
            placeholder="Search sessions by keywords, summaries, or messages..."
          />
        </div>
        <SearchFiltersComponent
          filters={searchFilters}
          onFiltersChange={handleFiltersChange}
          agentTypes={uniqueAgentTypes}
          userInfoMap={allUsers}
        />
      </div>

      {displayGroupedChats.length === 0 ? (
        <Card className="shadow-none border-border">
          <CardContent className="py-10 text-center text-muted-foreground">
            {searchQuery ? `No results found for "${searchQuery}"` : "No chat histories found"}
          </CardContent>
        </Card>
      ) : (
        <>
        <div className="grid gap-4">
          {displayGroupedChats.map((group) => {
            const isCollapsed = collapsedGroups.has(group.path);
            const hasMessages = group.totalMessages > 0;

            // Determine if this is a conversation name (for Cursor) or a project path
            const firstSession = group.sessions[0];
            const isConversationName = firstSession?.agent_type === 'cursor' &&
                                       (firstSession?.ai_title === group.path || firstSession?.metadata?.conversationName === group.path);

            return (
              <Card key={group.path} className="shadow-none border-border">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1 flex items-center gap-2">
                      <button
                        onClick={() => toggleGroup(group.path)}
                        className="p-1 hover:bg-accent rounded transition-colors"
                        aria-label={
                          isCollapsed ? "Expand group" : "Collapse group"
                        }
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className={`text-foreground ${isConversationName ? "text-xl" : "text-xl font-mono"}`}>
                            {group.path}
                          </CardTitle>
                        </div>
                        {/* User Profile Information */}
                        {group.sessions[0]?.account_id && userInfoMap.has(group.sessions[0].account_id) && (
                          <div className="mt-2">
                            {(() => {
                              const userInfo = userInfoMap.get(group.sessions[0].account_id);
                              return userInfo ? (
                                <UserDisplay
                                  displayName={userInfo.display_name}
                                  email={userInfo.email}
                                  avatarUrl={userInfo.avatar_url}
                                  xGithubName={userInfo.x_github_name}
                                  xGithubAvatarUrl={userInfo.x_github_avatar_url}
                                  className="text-sm"
                                />
                              ) : null;
                            })()}
                          </div>
                        )}
                        <CardDescription className="mt-2 text-muted-foreground">
                          {group.sessions.length} session
                          {group.sessions.length !== 1 ? "s" : ""} •{" "}
                          {group.totalMessages} message
                          {group.totalMessages !== 1 ? "s" : ""}
                          {!hasMessages && (
                            <span className="ml-2 text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded">
                              Empty sessions
                            </span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground font-bold" suppressHydrationWarning>
                      {isMounted ? (
                        isLive(group.lastActivity) ? (
                          <LiveIndicator />
                        ) : (
                          formatLastActive(group.lastActivity)
                        )
                      ) : (
                        new Date(group.lastActivity).toLocaleString()
                      )}
                    </div>
                  </div>
                </CardHeader>
                {!isCollapsed && (
                  <CardContent>
                    <div className="space-y-3">
                      {group.sessions.map((session) => {
                        const messages = Array.isArray(session.messages)
                          ? session.messages
                          : [];
                        const messageCount = messages.length;
                        const lastMessage =
                          messageCount > 0 ? messages[messageCount - 1] : null;
                        const sessionWithMatch = session as HistoryWithMatch;
                        const matchedIn = sessionWithMatch.matchedIn || [];
                        const snippet = sessionWithMatch.snippet;

                        return (
                          <Link
                            key={session.id}
                            href={`/session/${session.id}`}
                            className="block border border-border rounded-lg p-4 hover:bg-accent transition-colors cursor-pointer"
                          >

                            {/* Search Result Snippet */}
                            {searchQuery && snippet && (
                              <div className="text-sm bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 mb-3">
                                <div className="flex items-start gap-2 mb-1">
                                  <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 uppercase tracking-wide">
                                    Search Match:
                                  </span>
                                </div>
                                <p className="text-sm text-yellow-900 dark:text-yellow-100 italic">
                                  {snippet}
                                </p>
                              </div>
                            )}

                            {messageCount > 0 ? (
                              <div className="space-y-3">
                                {/* 1. Topic Title with Last Message */}
                                <div className="flex justify-between items-center">
                                  <div className="text-sm font-bold text-foreground">
                                    {session.ai_title || session.metadata?.conversationName || session.metadata?.projectName || 'Untitled Session'}
                                  </div>
                                  <div className="text-sm text-muted-foreground font-bold" suppressHydrationWarning>
                                    {isMounted ? (
                                      isLive(getLatestMessageTimestamp(session)) ? (
                                        <LiveIndicator />
                                      ) : (
                                        formatLastActive(getLatestMessageTimestamp(session))
                                      )
                                    ) : (
                                      new Date(getLatestMessageTimestamp(session)).toLocaleString()
                                    )}
                                  </div>
                                </div>

                                {/* 2. Agent Type */}
                                {session.agent_type && (
                                  <div className="text-sm">
                                    <AgentDisplay agentType={session.agent_type} />
                                  </div>
                                )}

                                {/* 3. Structured Summary */}
                                {session.ai_summary && (() => {
                                  try {
                                    const parsed = JSON.parse(session.ai_summary);
                                    if (parsed.summary && typeof parsed.summary === 'string') {
                                      return (
                                        <div className="space-y-2">
                                          {/* Summary */}
                                          <div className="text-sm font-medium text-foreground">
                                            {parsed.summary}
                                          </div>

                                          {/* Problems */}
                                          {parsed.problems && Array.isArray(parsed.problems) && parsed.problems.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                              {parsed.problems.map((problem: string, idx: number) => (
                                                <span
                                                  key={idx}
                                                  className="inline-block text-xs px-2 py-1 rounded-md"
                                                  style={{
                                                    backgroundColor: '#FF357610',
                                                    borderColor: '#FF357630',
                                                    color: '#FF3576'
                                                  }}
                                                >
                                                  {problem}
                                                </span>
                                              ))}
                                            </div>
                                          )}

                                          {/* Progress indicator */}
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
                                    // Fallback to plain text if not JSON
                                  }

                                  // Fallback: display as plain text
                                  return (
                                    <div className="text-sm text-muted-foreground leading-relaxed">
                                      {session.ai_summary}
                                    </div>
                                  );
                                })()}

                                {/* 4. Keywords */}
                                {(session.ai_keywords_type?.length || session.ai_keywords_topic?.length) && (
                                  <div className="text-sm">
                                    <div className="flex flex-wrap gap-4">
                                      {session.ai_keywords_type && session.ai_keywords_type.length > 0 && (
                                        <div>
                                          <div className="flex flex-wrap gap-1">
                                            {session.ai_keywords_type.map((type, idx) => (
                                              <span
                                                key={idx}
                                                className="inline-block text-xs px-2 py-1 rounded-full border"
                                                style={{
                                                  backgroundColor: '#FF357610',
                                                  borderColor: '#FF357630',
                                                  color: '#7C818E'
                                                }}
                                              >
                                                {type}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {session.ai_keywords_topic && session.ai_keywords_topic.length > 0 && (
                                        <div>
                                          <div className="flex flex-wrap gap-1">
                                            {session.ai_keywords_topic.map((topic, idx) => (
                                              <span
                                                key={idx}
                                                className="inline-block text-xs px-2 py-1 rounded-full border"
                                                style={{
                                                  backgroundColor: '#FF357610',
                                                  borderColor: '#FF357630',
                                                  color: '#7C818E'
                                                }}
                                              >
                                                {topic}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* 5. Activity Counter */}
                                <div className="text-sm text-muted-foreground">
                                  <span className="font-bold">{messages.filter(msg => msg.role === 'user').length}</span> User Messages • <span className="font-bold">{(() => {
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
                                      
                                      // Method 3: Error case
                                      return "Error";
                                    } catch (error) {
                                      return "Error";
                                    }
                                  })()}</span> of Active Time
                                </div>

                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">
                                No messages in this session
                              </div>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {/* Load More Button - only show when not searching and there are more sessions */}
        {!searchQuery && hasMoreSessions && (
          <div className="flex justify-center mt-6">
            <button
              onClick={loadMoreSessions}
              disabled={isLoadingMore}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingMore ? "Loading..." : `Load More (${histories.length} of ${totalCount})`}
            </button>
          </div>
        )}
        </>
      )}
    </div>
  );
}

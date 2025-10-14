"use client";

import { useEffect, useState } from "react";
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

/**
 * Format timestamp to show relative time for recent activity
 * Shows "X minutes ago" if within the last hour, otherwise full date/time
 */
function formatLastActive(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return "Just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
  } else {
    return date.toLocaleString();
  }
}

type GroupedChat = {
  path: string;
  sessions: ChatHistory[];
  totalMessages: number;
  lastActivity: string;
};

function groupChatsByPath(histories: ChatHistory[]): GroupedChat[] {
  const grouped = new Map<string, ChatHistory[]>();

  histories.forEach((history) => {
    const path = history.metadata?.projectPath || "/";
    if (!grouped.has(path)) {
      grouped.set(path, []);
    }
    grouped.get(path)!.push(history);
  });

  return Array.from(grouped.entries())
    .map(([path, sessions]) => {
      // Sort sessions by updated_at descending within each group
      const sortedSessions = sessions.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      return {
        path,
        sessions: sortedSessions,
        totalMessages: sortedSessions.reduce(
          (sum, s) => sum + (Array.isArray(s.messages) ? s.messages.length : 0),
          0
        ),
        lastActivity: sortedSessions[0].updated_at,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
}

export function ChatHistoriesList({
  initialHistories,
}: {
  initialHistories: ChatHistory[];
}) {
  const [histories, setHistories] = useState<ChatHistory[]>(initialHistories);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );

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

  // Auto-collapse groups with zero messages
  useEffect(() => {
    const groupedChats = groupChatsByPath(histories);
    const emptyGroups = new Set(
      groupedChats
        .filter((group) => group.totalMessages === 0)
        .map((group) => group.path)
    );
    setCollapsedGroups(emptyGroups);
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

  return (
    <div className="container mx-auto py-10 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Chat Histories</h1>
          <p className="text-muted-foreground mt-2">
            Overview of all chat sessions grouped by project path
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {histories.length} total sessions across {groupedChats.length}{" "}
          projects
        </div>
      </div>

      {groupedChats.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No chat histories found
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {groupedChats.map((group) => {
            const isCollapsed = collapsedGroups.has(group.path);
            const hasMessages = group.totalMessages > 0;

            return (
              <Card key={group.path}>
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
                        <CardTitle className="text-xl font-mono">
                          {group.path}
                        </CardTitle>
                        <CardDescription className="mt-2">
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
                    <div className="text-sm text-muted-foreground">
                      Last active: {formatLastActive(group.lastActivity)}
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

                        return (
                          <Link
                            key={session.id}
                            href={`/session/${session.id}`}
                            className="block border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-muted-foreground">
                                  Session ID: {session.id.slice(0, 8)}...
                                </span>
                                {session.agent_type && (
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                    {session.agent_type}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-xs text-muted-foreground">
                                  Created:{" "}
                                  {new Date(session.created_at).toLocaleString()}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Updated:{" "}
                                  {new Date(session.updated_at).toLocaleString()}
                                </span>
                              </div>
                            </div>

                            {messageCount > 0 ? (
                              <div className="space-y-2">
                                <div className="text-sm text-muted-foreground">
                                  {messageCount} message
                                  {messageCount !== 1 ? "s" : ""} in this session
                                </div>
                                {lastMessage && (
                                  <div className="text-sm">
                                    <span className="font-medium">
                                      Last message:{" "}
                                    </span>
                                    <span className="text-muted-foreground">
                                      {lastMessage.display?.slice(0, 100)}
                                      {lastMessage.display?.length > 100
                                        ? "..."
                                        : ""}
                                    </span>
                                  </div>
                                )}
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
      )}
    </div>
  );
}

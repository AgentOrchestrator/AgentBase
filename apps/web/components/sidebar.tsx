"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { signOut } from "@/lib/auth";
import { useSidebar } from "./sidebar-provider";
import {
  Home,
  Inbox,
  Settings,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  User as UserIcon,
  Users,
  Share2,
  Mail,
  LogOut
} from "lucide-react";

/**
 * Format timestamp to show relative time for recent activity (sidebar version)
 */
function formatLastActive(timestamp: string, currentTime: Date = new Date()): string {
  const date = new Date(timestamp);
  const now = currentTime;
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffMinutes < 1) {
    return "1m";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  } else if (diffHours < 24) {
    return `${diffHours}h`;
  } else if (diffDays < 7) {
    return `${diffDays}d`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks}w`;
  } else if (diffMonths < 12) {
    return `${diffMonths}mo`;
  } else {
    return `${diffYears}J`;
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
 * Live indicator component with just the pulsating green dot
 */
function LiveIndicator() {
  return (
    <div 
      className="w-2 h-2 rounded-full animate-pulse"
      style={{ 
        backgroundColor: '#3cd158',
        boxShadow: '0 0 8px rgba(60, 209, 88, 0.6), 0 0 16px rgba(60, 209, 88, 0.4)',
        animation: 'livePulse 4s ease-in-out infinite'
      }}
    >
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

interface SidebarItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  children?: SidebarItem[];
  isActive?: boolean;
  isCollapsed?: boolean;
  timeIndicator?: React.ReactNode;
}

interface TeamMember {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  x_github_name: string | null;
  x_github_avatar_url: string | null;
  latest_message_timestamp: string | null;
  recentConversations: Array<{
    id: string;
    title: string;
    latest_message_timestamp: string;
  }>;
}

interface SidebarSection {
  title: string;
  items: SidebarItem[];
  isCollapsed?: boolean;
}

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pendingInvitationsCount, setPendingInvitationsCount] = useState(0);
  const [invitationsLoading, setInvitationsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
          console.error('Error fetching user:', error);
        } else {
          setUser(user);
        }
      } catch (error) {
        console.error('Error in fetchUser:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  // Function to refresh team data from API
  const refreshTeamData = useCallback(async () => {
    try {
      const response = await fetch('/api/team');
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data.teamMembers || []);
      } else {
        console.error('Error fetching team members:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    } finally {
      setTeamLoading(false);
    }
  }, []);

  // Function to refresh pending invitations count
  const refreshInvitations = useCallback(async () => {
    try {
      const response = await fetch('/api/workspaces/invitations');
      if (response.ok) {
        const data = await response.json();
        setPendingInvitationsCount(data.invitations?.length || 0);
      } else {
        console.error('Error fetching invitations:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching invitations:', error);
    } finally {
      setInvitationsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshTeamData();
    refreshInvitations();
  }, [refreshTeamData, refreshInvitations]);

  // Auto-refresh team data and invitations every minute
  useEffect(() => {
    const interval = setInterval(() => {
      refreshTeamData();
      refreshInvitations();
    }, 60 * 1000); // 1 minute

    return () => clearInterval(interval);
  }, [refreshTeamData, refreshInvitations]);

  // Update current time every minute for live timestamp updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60 * 1000); // 1 minute

    return () => clearInterval(interval);
  }, []);

  const toggleSection = (sectionTitle: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionTitle)) {
        newSet.delete(sectionTitle);
      } else {
        newSet.add(sectionTitle);
      }
      return newSet;
    });
  };

  const toggleItem = (itemId: string) => {
    setCollapsedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleLogout = async () => {
    try {
      await signOut();
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleNavigation = (itemId: string) => {
    if (itemId === "home") {
      router.push("/");
    } else if (itemId === "canvas") {
      router.push("/canvas");
    } else if (itemId === "settings") {
      router.push("/settings");
    } else if (itemId === "workspaces") {
      router.push("/workspaces");
    } else if (itemId === "sharing") {
      router.push("/sharing");
    } else if (itemId === "invitations") {
      router.push("/workspaces/invitations");
    } else if (itemId.startsWith("team-")) {
      // For team members, we could navigate to a user profile page or do nothing
      // For now, we'll just do nothing since there's no user profile page
      console.log("Team member clicked:", itemId);
    } else if (itemId.startsWith("conversation-")) {
      // For conversations, we could navigate to the conversation or do nothing
      // For now, we'll just do nothing since there's no conversation page
      console.log("Conversation clicked:", itemId);
    }
  };

  const isItemActive = (itemId: string) => {
    if (itemId === "home") {
      return pathname === "/";
    } else if (itemId === "canvas") {
      return pathname === "/canvas";
    } else if (itemId === "settings") {
      return pathname === "/settings";
    } else if (itemId === "workspaces") {
      return pathname === "/workspaces";
    } else if (itemId === "sharing") {
      return pathname === "/sharing";
    } else if (itemId === "invitations") {
      return pathname === "/workspaces/invitations";
    }
    return false;
  };

  const sections: SidebarSection[] = [
    {
      title: "Navigation",
      items: [
        {
          id: "home",
          label: "Sessions",
          icon: <Home className="h-4 w-4" />,
        },
        {
          id: "canvas",
          label: "Canvas",
          icon: <Inbox className="h-4 w-4" />,
        },
        {
          id: "workspaces",
          label: "Workspaces",
          icon: <Users className="h-4 w-4" />,
        },
        {
          id: "sharing",
          label: "Sharing",
          icon: <Share2 className="h-4 w-4" />,
        },
        {
          id: "settings",
          label: "Settings",
          icon: <Settings className="h-4 w-4" />,
        },
      ],
    },
    {
      title: "Team",
      items: teamLoading ? [
        {
          id: "team-loading",
          label: "Loading...",
          icon: <div className="h-4 w-4 bg-gray-300 rounded animate-pulse" />,
        }
      ] : teamMembers.map((member) => {
        // Get display name, or email username (part before @) if no name
        const displayName = member.x_github_name || member.display_name || member.email.split('@')[0];

        return {
          id: `team-${member.id}`,
          label: displayName,
          icon: member.x_github_avatar_url || member.avatar_url ? (
            <img
              src={member.x_github_avatar_url || member.avatar_url}
              alt={displayName}
              className="h-4 w-4 rounded-full object-cover"
            />
          ) : (
            <UserIcon className="h-4 w-4" />
          ),
          timeIndicator: member.latest_message_timestamp ? (
            isLive(member.latest_message_timestamp, currentTime) ? (
              <LiveIndicator />
            ) : (
              <span className="text-xs text-muted-foreground">
                {formatLastActive(member.latest_message_timestamp, currentTime)}
              </span>
            )
          ) : null,
          children: member.recentConversations.map((conversation) => ({
            id: `conversation-${conversation.id}`,
            label: conversation.title,
            icon: undefined, // No icon for conversation items
          })),
        };
      }),
    },
  ];

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border h-full flex flex-col text-sm text-muted-foreground">
      {/* Top Section with User Info */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              {loading ? (
                <div className="h-5 w-5 bg-gray-300 rounded-full animate-pulse" />
              ) : user?.user_metadata?.x_github_avatar_url || user?.user_metadata?.avatar_url ? (
                <img 
                  src={user.user_metadata.x_github_avatar_url || user.user_metadata.avatar_url} 
                  alt="Profile" 
                  className="h-5 w-5 rounded-full object-cover"
                />
              ) : (
                <UserIcon className="h-5 w-5 text-muted-foreground" />
              )}
              <span className="font-semibold text-muted-foreground truncate">
                {loading ? (
                  <div className="h-4 w-24 bg-gray-300 rounded animate-pulse" />
                ) : (
                  user?.user_metadata?.x_github_name || 
                  user?.user_metadata?.display_name || 
                  user?.user_metadata?.name || 
                  user?.email || 
                  "User"
                )}
              </span>
            </div>
          </div>
          <button 
            onClick={toggleSidebar}
            className="p-1 hover:bg-sidebar-accent rounded"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title} className="p-2">
            {section.items.length > 0 && (
              <div className="mb-2">
                <button
                  onClick={() => toggleSection(section.title)}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-muted-foreground w-full text-left"
                >
                  {collapsedSections.has(section.title) ? (
                    <ChevronRight className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  {section.title.toUpperCase()}
                </button>
              </div>
            )}
            
            {!collapsedSections.has(section.title) && (
              <div className="space-y-1">
                {section.items.map((item) => (
                  <div key={item.id}>
                    <button
                      onClick={() => handleNavigation(item.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors group ${
                        isItemActive(item.id)
                          ? "bg-sidebar-accent text-muted-foreground" 
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-muted-foreground"
                      } ${
                        section.title === "Team" ? "ml-4" : ""
                      }`}
                    >
                      {section.title === "Team" && item.children && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleItem(item.id);
                          }}
                          className="p-0.5 hover:bg-sidebar-accent rounded -ml-1 cursor-pointer"
                        >
                          {collapsedItems.has(item.id) ? (
                            <ChevronRight className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </div>
                      )}
                      {item.icon}
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.timeIndicator && (
                        <div className="ml-auto mr-2">
                          {item.timeIndicator}
                        </div>
                      )}
                      {section.title !== "Team" && item.children && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleItem(item.id);
                          }}
                          className="p-0.5 hover:bg-sidebar-accent rounded"
                        >
                          {collapsedItems.has(item.id) ? (
                            <ChevronRight className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </button>
                    
                    {/* Render children if item has them and is not collapsed */}
                    {item.children && !collapsedItems.has(item.id) && (
                      <div className={`space-y-1 ${section.title === "Team" ? "ml-8" : "ml-6"}`}>
                        {item.children.map((child) => (
                          <button
                            key={child.id}
                            onClick={() => handleNavigation(child.id)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-sidebar-accent transition-colors text-muted-foreground hover:text-muted-foreground"
                          >
                            {child.icon}
                            <span className="flex-1 text-left">{child.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom Section */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex flex-col gap-2">
          {/* Workspace Invitations Button */}
          <button
            onClick={() => handleNavigation("invitations")}
            className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors ${
              isItemActive("invitations")
                ? "bg-sidebar-accent text-muted-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-muted-foreground"
            }`}
          >
            <Mail className="h-4 w-4" />
            <span className="flex-1 text-left">Invitations</span>
            {!invitationsLoading && pendingInvitationsCount > 0 && (
              <span className="ml-auto bg-blue-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                {pendingInvitationsCount}
              </span>
            )}
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-muted-foreground rounded transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}

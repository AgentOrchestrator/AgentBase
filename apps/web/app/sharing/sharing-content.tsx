"use client";

import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { Share2, Trash2, Users, User as UserIcon, X, ChevronDown, ChevronRight, MessageSquare, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { UserAutocomplete, type UserOption } from "@/components/user-autocomplete";

interface Session {
  id: string;
  ai_title: string | null;
  ai_summary: string | null;
  latest_message_timestamp: string | null;
  created_at: string;
  agent_type: string | null;
  share_count?: number;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  project_path: string | null;
  created_at: string;
  share_count?: number;
  sessions?: Session[];
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface ProjectShare {
  id: string;
  shared_with_user_id: string;
  permission_level: string;
  created_at: string;
  user_email?: string;
  user_display_name?: string | null;
}

interface WorkspaceShare {
  id: string;
  workspace_id: string;
  permission_level: string;
  created_at: string;
  workspaces: {
    id: string;
    name: string;
    slug: string;
  };
}

interface SharingContentProps {
  user: User;
}

export function SharingContent({ user }: SharingContentProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'latest_activity' | 'created_at' | 'name'>('latest_activity');

  // Share dialog
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [userShares, setUserShares] = useState<ProjectShare[]>([]);
  const [workspaceShares, setWorkspaceShares] = useState<WorkspaceShare[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);

  // Share form
  const [shareType, setShareType] = useState<'user' | 'workspace'>('workspace');
  const [shareTargetId, setShareTargetId] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [sharePermission, setSharePermission] = useState("view");
  const [sharing, setSharing] = useState(false);

  // Fetch initial data
  useEffect(() => {
    fetchProjects();
    fetchWorkspaces();
  }, [sortBy]); // Re-fetch when sort changes

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects?sort_by=${sortBy}`);
      const data = await response.json();

      if (response.ok) {
        setProjects(data.projects || []);
      } else {
        setError(data.error || 'Failed to fetch projects');
      }
    } catch (err) {
      setError('Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkspaces = async () => {
    try {
      const response = await fetch('/api/workspaces');
      const data = await response.json();

      if (response.ok) {
        setWorkspaces(data.workspaces || []);
      }
    } catch (err) {
      console.error('Failed to fetch workspaces', err);
    }
  };

  const handleShowShares = async (project: Project) => {
    setSelectedProject(project);
    setShareDialogOpen(true);
    setLoadingShares(true);

    try {
      const response = await fetch(`/api/projects/share?project_id=${project.id}`);
      const data = await response.json();

      if (response.ok) {
        setUserShares(data.user_shares || []);
        setWorkspaceShares(data.workspace_shares || []);
      } else {
        setError(data.error || 'Failed to fetch shares');
      }
    } catch (err) {
      setError('Failed to fetch shares');
    } finally {
      setLoadingShares(false);
    }
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    // Get the target ID based on share type
    const targetId = shareType === 'user' ? selectedUser?.id : shareTargetId;
    if (!targetId) return;

    setSharing(true);
    setError(null);

    try {
      const response = await fetch('/api/projects/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProject.id,
          share_type: shareType,
          target_id: targetId,
          permission_level: sharePermission,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Refresh shares
        const refreshResponse = await fetch(`/api/projects/share?project_id=${selectedProject.id}`);
        const refreshData = await refreshResponse.json();
        if (refreshResponse.ok) {
          setUserShares(refreshData.user_shares || []);
          setWorkspaceShares(refreshData.workspace_shares || []);
        }
        setShareTargetId("");
        setSelectedUser(null);

        // Refresh projects list to update share counts
        await fetchProjects();
      } else {
        setError(data.error || 'Failed to share project');
      }
    } catch (err) {
      setError('Failed to share project');
    } finally {
      setSharing(false);
    }
  };

  const handleRemoveShare = async (shareId: string, type: 'user' | 'workspace') => {
    if (!selectedProject) return;
    if (!confirm('Are you sure you want to remove this share?')) return;

    try {
      const response = await fetch(
        `/api/projects/share?project_id=${selectedProject.id}&share_type=${type}&share_id=${shareId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        if (type === 'user') {
          setUserShares(userShares.filter(s => s.id !== shareId));
        } else {
          setWorkspaceShares(workspaceShares.filter(s => s.id !== shareId));
        }

        // Refresh projects list to update share counts
        await fetchProjects();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to remove share');
      }
    } catch (err) {
      setError('Failed to remove share');
    }
  };

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'No activity';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-background">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Sharing</h1>
            <p className="text-muted-foreground mt-2">
              Share your projects and sessions with team members and workspaces
            </p>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2">
            <Label htmlFor="sort-select" className="text-sm text-muted-foreground whitespace-nowrap">
              Sort by:
            </Label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'latest_activity' | 'created_at' | 'name')}
              className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="latest_activity">Latest Activity</option>
              <option value="created_at">Date Created</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Projects List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <Card className="p-12 bg-card text-center border-0">
            <Share2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No projects yet</h3>
            <p className="text-sm text-muted-foreground">
              Projects you create will appear here and can be shared with others
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => {
              const isExpanded = expandedProjects.has(project.id);
              const hasSessions = project.sessions && project.sessions.length > 0;

              return (
                <Card key={project.id} className="bg-card border-border overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {hasSessions && (
                            <button
                              onClick={() => toggleProjectExpanded(project.id)}
                              className="p-0.5 hover:bg-sidebar-accent rounded transition-colors"
                              aria-label={isExpanded ? "Collapse sessions" : "Expand sessions"}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                          )}
                          <h3 className="text-lg font-semibold text-foreground">{project.name}</h3>
                          {project.share_count !== undefined && project.share_count > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full">
                              <Share2 className="h-3 w-3" />
                              {project.share_count}
                            </span>
                          )}
                          {hasSessions && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded-full">
                              <MessageSquare className="h-3 w-3" />
                              {project.sessions?.length || 0}
                            </span>
                          )}
                        </div>
                        {project.project_path && (
                          <p className="text-sm text-muted-foreground mt-1">{project.project_path}</p>
                        )}
                        {project.description && (
                          <p className="text-sm text-muted-foreground mt-2">{project.description}</p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => handleShowShares(project)}
                        className="gap-2"
                      >
                        <Share2 className="h-4 w-4" />
                        Manage Sharing
                      </Button>
                    </div>
                  </div>

                  {/* Sessions List */}
                  {isExpanded && hasSessions && (
                    <div className="border-t border-border bg-muted/30">
                      <div className="p-4 space-y-2">
                        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          Recent Sessions
                        </h4>
                        {project.sessions?.map((session) => (
                          <div
                            key={session.id}
                            className="p-3 bg-card border border-border rounded-lg hover:bg-sidebar-accent transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h5 className="text-sm font-medium text-foreground truncate">
                                    {session.ai_title || `Session from ${new Date(session.created_at).toLocaleDateString()}`}
                                  </h5>
                                  {session.share_count !== undefined && session.share_count > 0 && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex-shrink-0">
                                      <Share2 className="h-3 w-3" />
                                      {session.share_count}
                                    </span>
                                  )}
                                </div>
                                {session.ai_summary && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {session.ai_summary}
                                  </p>
                                )}
                                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatTimestamp(session.latest_message_timestamp || session.created_at)}
                                  </span>
                                  {session.agent_type && (
                                    <span className="px-2 py-0.5 bg-muted rounded-full">
                                      {session.agent_type}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="flex-shrink-0"
                                onClick={() => {
                                  // TODO: Implement session sharing
                                  console.log('Share session:', session.id);
                                }}
                              >
                                <Share2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Share Dialog */}
        <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogClose onClose={() => setShareDialogOpen(false)} />
            <DialogHeader>
              <DialogTitle>{selectedProject?.name} - Sharing</DialogTitle>
              <DialogDescription>
                Share this project with users or workspaces
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Share Form */}
              <form onSubmit={handleShare} className="space-y-4 p-4 border border-border rounded-lg">
                <div>
                  <Label>Share with</Label>
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setShareType('workspace')}
                      className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                        shareType === 'workspace'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-muted-foreground hover:bg-sidebar-accent'
                      }`}
                    >
                      <Users className="h-4 w-4 inline mr-2" />
                      Workspace
                    </button>
                    <button
                      type="button"
                      onClick={() => setShareType('user')}
                      className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                        shareType === 'user'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-muted-foreground hover:bg-sidebar-accent'
                      }`}
                    >
                      <UserIcon className="h-4 w-4 inline mr-2" />
                      Individual User
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="target">
                    {shareType === 'workspace' ? 'Select Workspace' : 'Select User'}
                  </Label>
                  {shareType === 'workspace' ? (
                    <select
                      id="target"
                      value={shareTargetId}
                      onChange={(e) => setShareTargetId(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-card border border-border rounded-lg text-foreground"
                      required
                    >
                      <option value="">Select a workspace...</option>
                      {workspaces.map((ws) => (
                        <option key={ws.id} value={ws.id}>
                          {ws.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="mt-1 space-y-2">
                      {selectedUser ? (
                        <div className="flex items-center justify-between p-3 bg-sidebar-accent rounded-lg border border-border">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">
                              {selectedUser.display_name || selectedUser.x_github_name || selectedUser.email.split('@')[0]}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {selectedUser.email}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedUser(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <UserAutocomplete
                          onSelect={(user) => setSelectedUser(user)}
                          placeholder="Search by name or email..."
                          disabled={sharing}
                          excludeUserIds={[
                            user.id, // Exclude current user
                            ...userShares.map(s => s.shared_with_user_id),
                          ]}
                        />
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="permission">Permission Level</Label>
                  <select
                    id="permission"
                    value={sharePermission}
                    onChange={(e) => setSharePermission(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-card border border-border rounded-lg text-foreground"
                  >
                    <option value="view">View (Read-only)</option>
                    <option value="edit">Edit (Read-write)</option>
                  </select>
                </div>

                <Button type="submit" disabled={sharing} className="w-full">
                  {sharing ? 'Sharing...' : 'Share Project'}
                </Button>
              </form>

              {/* Existing Shares */}
              {loadingShares ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading shares...</p>
                </div>
              ) : (
                <>
                  {/* Workspace Shares */}
                  {workspaceShares.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-3">Shared with Workspaces</h4>
                      <div className="space-y-2">
                        {workspaceShares.map((share) => (
                          <div
                            key={share.id}
                            className="flex items-center justify-between p-3 bg-sidebar-accent rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {share.workspaces.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  /{share.workspaces.slug}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-1 bg-card rounded-full text-muted-foreground">
                                {share.permission_level}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveShare(share.id, 'workspace')}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* User Shares */}
                  {userShares.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-3">Shared with Users</h4>
                      <div className="space-y-2">
                        {userShares.map((share) => (
                          <div
                            key={share.id}
                            className="flex items-center justify-between p-3 bg-sidebar-accent rounded-lg"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <UserIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {share.user_display_name || share.user_email || 'Unknown User'}
                                </p>
                                {share.user_display_name && share.user_email && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {share.user_email}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs px-2 py-1 bg-card rounded-full text-muted-foreground">
                                {share.permission_level}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveShare(share.id, 'user')}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No shares */}
                  {workspaceShares.length === 0 && userShares.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">This project hasn't been shared yet</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

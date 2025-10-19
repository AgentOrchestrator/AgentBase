"use client";

import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { Plus, Users, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { UserAutocomplete, type UserOption } from "@/components/user-autocomplete";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  role: string;
  created_at: string;
  joined_at: string;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  email: string;
  display_name?: string | null;
  joined_at: string;
}

interface WorkspacesContentProps {
  user: User;
}

export function WorkspacesContent({ user }: WorkspacesContentProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create workspace dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState({ name: "", slug: "", description: "" });
  const [creating, setCreating] = useState(false);

  // Members dialog
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Add member fields
  const [selectedUsers, setSelectedUsers] = useState<UserOption[]>([]);
  const [newMemberRole, setNewMemberRole] = useState("member");
  const [addingMember, setAddingMember] = useState(false);

  // Delete workspace
  const [deletingWorkspaceId, setDeletingWorkspaceId] = useState<string | null>(null);

  // Fetch workspaces
  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/workspaces');
      const data = await response.json();

      if (response.ok) {
        setWorkspaces(data.workspaces || []);
      } else {
        setError(data.error || 'Failed to fetch workspaces');
      }
    } catch (err) {
      setError('Failed to fetch workspaces');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWorkspace),
      });

      const data = await response.json();

      if (response.ok) {
        setWorkspaces([...workspaces, { ...data.workspace, role: 'owner' }]);
        setCreateDialogOpen(false);
        setNewWorkspace({ name: "", slug: "", description: "" });
      } else {
        setError(data.error || 'Failed to create workspace');
      }
    } catch (err) {
      setError('Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  const handleShowMembers = async (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setMembersDialogOpen(true);
    setLoadingMembers(true);

    try {
      const response = await fetch(`/api/workspaces/members?workspace_id=${workspace.id}`);
      const data = await response.json();

      if (response.ok) {
        setMembers(data.members || []);
      } else {
        setError(data.error || 'Failed to fetch members');
      }
    } catch (err) {
      setError('Failed to fetch members');
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleAddMembers = async () => {
    if (!selectedWorkspace || selectedUsers.length === 0) return;

    setAddingMember(true);
    setError(null);

    try {
      // Add all selected users
      const addPromises = selectedUsers.map(user =>
        fetch('/api/workspaces/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id: selectedWorkspace.id,
            user_email: user.email,
            role: newMemberRole,
          }),
        })
      );

      const results = await Promise.all(addPromises);

      // Check if any failed
      const failures = results.filter(r => !r.ok);
      if (failures.length > 0) {
        const errorData = await failures[0].json();
        setError(errorData.error || `Failed to add ${failures.length} member(s)`);
      }

      // Refresh members list
      const refreshResponse = await fetch(`/api/workspaces/members?workspace_id=${selectedWorkspace.id}`);
      const refreshData = await refreshResponse.json();
      if (refreshResponse.ok) {
        setMembers(refreshData.members || []);
      }

      // Clear selection
      setSelectedUsers([]);
      setNewMemberRole("member");
    } catch (err) {
      setError('Failed to add members');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveSelectedUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId));
  };

  const handleSelectUser = (selectedUser: UserOption) => {
    // Avoid duplicates
    if (!selectedUsers.find(u => u.id === selectedUser.id)) {
      setSelectedUsers([...selectedUsers, selectedUser]);
    }
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    if (!selectedWorkspace) return;
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      const response = await fetch(
        `/api/workspaces/members?workspace_id=${selectedWorkspace.id}&user_id=${userId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        setMembers(members.filter(m => m.id !== memberId));
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to remove member');
      }
    } catch (err) {
      setError('Failed to remove member');
    }
  };

  const handleDeleteWorkspace = async (workspace: Workspace) => {
    if (!confirm(`Are you sure you want to delete "${workspace.name}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingWorkspaceId(workspace.id);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces?workspace_id=${workspace.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        setWorkspaces(workspaces.filter(w => w.id !== workspace.id));
      } else {
        setError(data.error || 'Failed to delete workspace');
      }
    } catch (err) {
      setError('Failed to delete workspace');
    } finally {
      setDeletingWorkspaceId(null);
    }
  };

  const autoSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-background">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Workspaces</h1>
            <p className="text-muted-foreground mt-2">
              Create and manage team workspaces for collaboration
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Workspace
          </Button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Workspaces List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading workspaces...</p>
          </div>
        ) : workspaces.length === 0 ? (
          <Card className="p-12 bg-card border-border text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No workspaces yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first workspace to start collaborating with your team
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Workspace
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((workspace) => (
              <Card key={workspace.id} className="p-6 bg-card border-border relative group">
                {/* Delete button - appears on hover */}
                {workspace.role === 'owner' && (
                  <button
                    onClick={() => handleDeleteWorkspace(workspace)}
                    disabled={deletingWorkspaceId === workspace.id}
                    className="absolute top-2 right-2 p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-muted hover:bg-muted/80 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete workspace"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{workspace.name}</h3>
                    <p className="text-sm text-muted-foreground">/{workspace.slug}</p>
                    {workspace.description && (
                      <p className="text-sm text-muted-foreground mt-2">{workspace.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 bg-sidebar-accent rounded-full text-muted-foreground">
                      {workspace.role}
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleShowMembers(workspace)}
                    className="w-full gap-2"
                  >
                    <Users className="h-4 w-4" />
                    Manage Members
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Create Workspace Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogClose onClose={() => setCreateDialogOpen(false)} />
            <DialogHeader>
              <DialogTitle>Create Workspace</DialogTitle>
              <DialogDescription>
                Create a new workspace for your team to collaborate
              </DialogDescription>
            </DialogHeader>

            {/* Owner Info */}
            <div className="px-6 py-3 bg-sidebar-accent rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Workspace Owner</p>
              <p className="text-sm font-medium text-foreground">
                {user.user_metadata?.display_name || user.email}
              </p>
              {user.user_metadata?.display_name && (
                <p className="text-xs text-muted-foreground">{user.email}</p>
              )}
            </div>

            <form onSubmit={handleCreateWorkspace} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="name">Workspace Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="My Team"
                  value={newWorkspace.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setNewWorkspace({
                      ...newWorkspace,
                      name,
                      slug: autoSlug(name),
                    });
                  }}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="slug">URL Slug</Label>
                <Input
                  id="slug"
                  type="text"
                  placeholder="my-team"
                  value={newWorkspace.slug}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, slug: e.target.value })}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  title="Lowercase letters, numbers, and hyphens only"
                  required
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lowercase letters, numbers, and hyphens only
                </p>
              </div>

              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  type="text"
                  placeholder="A brief description of your workspace"
                  value={newWorkspace.description}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, description: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Workspace'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Members Dialog */}
        <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogClose onClose={() => setMembersDialogOpen(false)} />
            <DialogHeader>
              <DialogTitle>{selectedWorkspace?.name} - Members</DialogTitle>
              <DialogDescription>
                Manage workspace members and their roles
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Add Member Form */}
              {selectedWorkspace && ['owner', 'admin'].includes(selectedWorkspace.role) && (
                <div className="space-y-3">
                  <Label>Add Member</Label>

                  {/* Search box to add users */}
                  <UserAutocomplete
                    onSelect={handleSelectUser}
                    placeholder="Search by name or email..."
                    disabled={addingMember}
                    excludeUserIds={[
                      user.id, // Current user
                      ...members.map(m => m.user_id), // Existing members
                      ...selectedUsers.map(u => u.id), // Already selected users
                    ]}
                  />

                  {/* Show selected users if any */}
                  {selectedUsers.length > 0 && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        {selectedUsers.map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-3 bg-sidebar-accent rounded-lg border border-border min-w-0"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-foreground truncate">
                                  {user.display_name || user.email}
                                </span>
                              </div>
                              {user.display_name && (
                                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveSelectedUser(user.id)}
                              className="flex-shrink-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      {/* Add controls - only shown when users are selected */}
                      <div className="flex gap-2">
                        <select
                          value={newMemberRole}
                          onChange={(e) => setNewMemberRole(e.target.value)}
                          className="px-3 py-2 bg-card border border-border rounded-lg text-foreground flex-1"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                        <Button
                          onClick={handleAddMembers}
                          disabled={addingMember}
                          className="gap-2"
                        >
                          <UserPlus className="h-4 w-4" />
                          {addingMember ? 'Adding...' : `Add ${selectedUsers.length} Member${selectedUsers.length > 1 ? 's' : ''}`}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Members List */}
              {loadingMembers ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading members...</p>
                </div>
              ) : members.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No members yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-sidebar-accent rounded-lg min-w-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {member.display_name || member.email}
                        </p>
                        {member.display_name && (
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs px-2 py-1 bg-card rounded-full text-muted-foreground">
                          {member.role}
                        </span>
                        {selectedWorkspace &&
                         ['owner', 'admin'].includes(selectedWorkspace.role) &&
                         member.user_id !== user.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id, member.user_id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

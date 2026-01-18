/**
 * Supabase implementation of IWorkspaceRepository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../database.types.js';
import type {
  IWorkspaceRepository,
  Workspace,
  WorkspaceInput,
  WorkspaceMember,
} from '../../interfaces/repositories.js';

export class SupabaseWorkspaceRepository implements IWorkspaceRepository {
  constructor(
    private client: SupabaseClient<Database>,
    _userId: string
  ) {}

  async findById(workspaceId: string): Promise<Workspace | null> {
    const { data, error } = await this.client
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('[WorkspaceRepository] Error finding workspace by ID:', error.message);
      }
      return null;
    }

    if (!data) {
      return null;
    }

    return this.mapToWorkspace(data);
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    const { data, error } = await this.client
      .from('workspaces')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('[WorkspaceRepository] Error finding workspace by slug:', error.message);
      }
      return null;
    }

    if (!data) {
      return null;
    }

    return this.mapToWorkspace(data);
  }

  async findByUser(userId: string): Promise<Workspace[]> {
    const { data: memberData, error: memberError } = await this.client
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .eq('invitation_status', 'accepted');

    if (memberError) {
      console.error('[WorkspaceRepository] Error finding user workspaces:', memberError.message);
      return [];
    }

    if (!memberData || memberData.length === 0) {
      return [];
    }

    const workspaceIds = memberData.map((m) => m.workspace_id);

    const { data, error } = await this.client
      .from('workspaces')
      .select('*')
      .in('id', workspaceIds)
      .order('name', { ascending: true });

    if (error) {
      console.error('[WorkspaceRepository] Error fetching workspaces:', error.message);
      return [];
    }

    return (data || []).map((row) => this.mapToWorkspace(row));
  }

  async create(userId: string, input: WorkspaceInput): Promise<Workspace | null> {
    try {
      const now = new Date().toISOString();

      const { data, error } = await this.client
        .from('workspaces')
        .insert({
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          created_by_user_id: userId,
          workspace_metadata: (input.workspaceMetadata as any) ?? null,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        console.error('[WorkspaceRepository] Error creating workspace:', error.message);
        return null;
      }

      if (!data) {
        return null;
      }

      // Add creator as owner
      await this.client.from('workspace_members').insert({
        workspace_id: data.id,
        user_id: userId,
        role: 'owner',
        invitation_status: 'accepted',
        joined_at: now,
        created_at: now,
      });

      return this.mapToWorkspace(data);
    } catch (error) {
      console.error('[WorkspaceRepository] Unexpected error creating workspace:', error);
      return null;
    }
  }

  async update(workspaceId: string, updates: Partial<WorkspaceInput>): Promise<Workspace | null> {
    try {
      const updateData: Database['public']['Tables']['workspaces']['Update'] = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name !== undefined) {
        updateData.name = updates.name;
      }
      if (updates.slug !== undefined) {
        updateData.slug = updates.slug;
      }
      if (updates.description !== undefined) {
        updateData.description = updates.description;
      }
      if (updates.workspaceMetadata !== undefined) {
        updateData.workspace_metadata = updates.workspaceMetadata as any;
      }

      const { data, error } = await this.client
        .from('workspaces')
        .update(updateData)
        .eq('id', workspaceId)
        .select()
        .single();

      if (error) {
        console.error('[WorkspaceRepository] Error updating workspace:', error.message);
        return null;
      }

      if (!data) {
        return null;
      }

      return this.mapToWorkspace(data);
    } catch (error) {
      console.error('[WorkspaceRepository] Unexpected error updating workspace:', error);
      return null;
    }
  }

  async delete(workspaceId: string): Promise<boolean> {
    try {
      const { error } = await this.client.from('workspaces').delete().eq('id', workspaceId);

      if (error) {
        console.error('[WorkspaceRepository] Error deleting workspace:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[WorkspaceRepository] Unexpected error deleting workspace:', error);
      return false;
    }
  }

  async getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const { data, error } = await this.client
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('[WorkspaceRepository] Error getting workspace members:', error.message);
      return [];
    }

    return (data || []).map((row) => this.mapToWorkspaceMember(row));
  }

  async addMember(
    workspaceId: string,
    userId: string,
    role: string,
    invitedByUserId: string
  ): Promise<WorkspaceMember | null> {
    try {
      const now = new Date().toISOString();

      const { data, error } = await this.client
        .from('workspace_members')
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          role: role,
          invited_by_user_id: invitedByUserId,
          invitation_status: 'pending',
          invited_at: now,
          created_at: now,
        })
        .select()
        .single();

      if (error) {
        console.error('[WorkspaceRepository] Error adding workspace member:', error.message);
        return null;
      }

      if (!data) {
        return null;
      }

      return this.mapToWorkspaceMember(data);
    } catch (error) {
      console.error('[WorkspaceRepository] Unexpected error adding member:', error);
      return null;
    }
  }

  async updateMemberRole(workspaceId: string, userId: string, role: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('workspace_members')
        .update({ role: role })
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId);

      if (error) {
        console.error('[WorkspaceRepository] Error updating member role:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[WorkspaceRepository] Unexpected error updating role:', error);
      return false;
    }
  }

  async removeMember(workspaceId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('workspace_members')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId);

      if (error) {
        console.error('[WorkspaceRepository] Error removing workspace member:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[WorkspaceRepository] Unexpected error removing member:', error);
      return false;
    }
  }

  async acceptInvitation(workspaceId: string, userId: string): Promise<boolean> {
    try {
      const now = new Date().toISOString();

      const { error } = await this.client
        .from('workspace_members')
        .update({
          invitation_status: 'accepted',
          joined_at: now,
        })
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .eq('invitation_status', 'pending');

      if (error) {
        console.error('[WorkspaceRepository] Error accepting invitation:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[WorkspaceRepository] Unexpected error accepting invitation:', error);
      return false;
    }
  }

  private mapToWorkspace(data: Database['public']['Tables']['workspaces']['Row']): Workspace {
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      createdByUserId: data.created_by_user_id,
      workspaceMetadata: data.workspace_metadata as Record<string, unknown> | null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  private mapToWorkspaceMember(
    data: Database['public']['Tables']['workspace_members']['Row']
  ): WorkspaceMember {
    return {
      id: data.id,
      workspaceId: data.workspace_id,
      userId: data.user_id,
      role: data.role,
      invitationStatus: data.invitation_status,
      invitedByUserId: data.invited_by_user_id,
      invitedAt: data.invited_at,
      joinedAt: data.joined_at,
      createdAt: data.created_at,
    };
  }
}

/**
 * Supabase implementation of IProjectSharingRepository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../database.types.js';
import type {
  IProjectSharingRepository,
  PermissionLevel,
  ProjectOrganizationShare,
  ProjectShare,
  ProjectWorkspaceShare,
} from '../../interfaces/repositories.js';

export class SupabaseProjectSharingRepository implements IProjectSharingRepository {
  constructor(
    private client: SupabaseClient<Database>,
    private userId: string
  ) {}

  // User shares

  async shareWithUser(
    projectId: string,
    sharedWithUserId: string,
    permission: PermissionLevel
  ): Promise<ProjectShare | null> {
    try {
      const { data, error } = await this.client
        .from('project_shares')
        .insert({
          project_id: projectId,
          shared_with_user_id: sharedWithUserId,
          shared_by_user_id: this.userId,
          permission_level: permission,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[ProjectSharingRepository] Error sharing project with user:', error.message);
        return null;
      }

      if (!data) {
        return null;
      }

      return this.mapToProjectShare(data);
    } catch (error) {
      console.error('[ProjectSharingRepository] Unexpected error sharing with user:', error);
      return null;
    }
  }

  async getProjectSharesForUser(userId: string): Promise<ProjectShare[]> {
    const { data, error } = await this.client
      .from('project_shares')
      .select('*')
      .eq('shared_with_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ProjectSharingRepository] Error getting shares for user:', error.message);
      return [];
    }

    return (data || []).map((row) => this.mapToProjectShare(row));
  }

  async getSharesForProject(projectId: string): Promise<ProjectShare[]> {
    const { data, error } = await this.client
      .from('project_shares')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ProjectSharingRepository] Error getting shares for project:', error.message);
      return [];
    }

    return (data || []).map((row) => this.mapToProjectShare(row));
  }

  async removeUserShare(shareId: string): Promise<boolean> {
    try {
      const { error } = await this.client.from('project_shares').delete().eq('id', shareId);

      if (error) {
        console.error('[ProjectSharingRepository] Error removing user share:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[ProjectSharingRepository] Unexpected error removing share:', error);
      return false;
    }
  }

  async updateUserSharePermission(shareId: string, permission: PermissionLevel): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('project_shares')
        .update({ permission_level: permission })
        .eq('id', shareId);

      if (error) {
        console.error('[ProjectSharingRepository] Error updating permission:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[ProjectSharingRepository] Unexpected error updating permission:', error);
      return false;
    }
  }

  // Workspace shares

  async shareWithWorkspace(
    projectId: string,
    workspaceId: string,
    permission: PermissionLevel
  ): Promise<ProjectWorkspaceShare | null> {
    try {
      const { data, error } = await this.client
        .from('project_workspace_shares')
        .insert({
          project_id: projectId,
          workspace_id: workspaceId,
          shared_by_user_id: this.userId,
          permission_level: permission,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[ProjectSharingRepository] Error sharing with workspace:', error.message);
        return null;
      }

      if (!data) {
        return null;
      }

      return this.mapToProjectWorkspaceShare(data);
    } catch (error) {
      console.error('[ProjectSharingRepository] Unexpected error sharing with workspace:', error);
      return null;
    }
  }

  async getProjectWorkspaceShares(projectId: string): Promise<ProjectWorkspaceShare[]> {
    const { data, error } = await this.client
      .from('project_workspace_shares')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ProjectSharingRepository] Error getting workspace shares:', error.message);
      return [];
    }

    return (data || []).map((row) => this.mapToProjectWorkspaceShare(row));
  }

  async removeWorkspaceShare(shareId: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('project_workspace_shares')
        .delete()
        .eq('id', shareId);

      if (error) {
        console.error('[ProjectSharingRepository] Error removing workspace share:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[ProjectSharingRepository] Unexpected error removing workspace share:', error);
      return false;
    }
  }

  // Organization shares

  async shareWithOrganization(
    projectId: string,
    organizationName: string,
    permission: PermissionLevel
  ): Promise<ProjectOrganizationShare | null> {
    try {
      const { data, error } = await this.client
        .from('project_organization_shares')
        .insert({
          project_id: projectId,
          organization_name: organizationName,
          shared_by_user_id: this.userId,
          permission_level: permission,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[ProjectSharingRepository] Error sharing with org:', error.message);
        return null;
      }

      if (!data) {
        return null;
      }

      return this.mapToProjectOrganizationShare(data);
    } catch (error) {
      console.error('[ProjectSharingRepository] Unexpected error sharing with org:', error);
      return null;
    }
  }

  async getProjectOrganizationShares(projectId: string): Promise<ProjectOrganizationShare[]> {
    const { data, error } = await this.client
      .from('project_organization_shares')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ProjectSharingRepository] Error getting org shares:', error.message);
      return [];
    }

    return (data || []).map((row) => this.mapToProjectOrganizationShare(row));
  }

  async removeOrganizationShare(shareId: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('project_organization_shares')
        .delete()
        .eq('id', shareId);

      if (error) {
        console.error('[ProjectSharingRepository] Error removing org share:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[ProjectSharingRepository] Unexpected error removing org share:', error);
      return false;
    }
  }

  // Mappers

  private mapToProjectShare(
    data: Database['public']['Tables']['project_shares']['Row']
  ): ProjectShare {
    return {
      id: data.id,
      projectId: data.project_id,
      sharedWithUserId: data.shared_with_user_id,
      sharedByUserId: data.shared_by_user_id,
      permissionLevel: data.permission_level,
      createdAt: data.created_at,
    };
  }

  private mapToProjectWorkspaceShare(
    data: Database['public']['Tables']['project_workspace_shares']['Row']
  ): ProjectWorkspaceShare {
    return {
      id: data.id,
      projectId: data.project_id,
      workspaceId: data.workspace_id,
      sharedByUserId: data.shared_by_user_id,
      permissionLevel: data.permission_level,
      createdAt: data.created_at,
    };
  }

  private mapToProjectOrganizationShare(
    data: Database['public']['Tables']['project_organization_shares']['Row']
  ): ProjectOrganizationShare {
    return {
      id: data.id,
      projectId: data.project_id,
      organizationName: data.organization_name,
      sharedByUserId: data.shared_by_user_id,
      permissionLevel: data.permission_level,
      createdAt: data.created_at,
    };
  }
}

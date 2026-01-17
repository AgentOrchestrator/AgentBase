/**
 * Supabase implementation of ISessionSharingRepository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../database.types.js';
import type {
  ISessionSharingRepository,
  PermissionLevel,
  SessionShare,
  SessionShareExclusion,
  SessionWorkspaceShare,
} from '../../interfaces/repositories.js';

export class SupabaseSessionSharingRepository implements ISessionSharingRepository {
  constructor(
    private client: SupabaseClient<Database>,
    private userId: string
  ) {}

  // User shares

  async shareSessionWithUser(
    sessionId: string,
    sharedWithUserId: string,
    permission: PermissionLevel
  ): Promise<SessionShare | null> {
    try {
      const { data, error } = await this.client
        .from('session_shares')
        .insert({
          session_id: sessionId,
          shared_with_user_id: sharedWithUserId,
          shared_by_user_id: this.userId,
          permission_level: permission,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[SessionSharingRepository] Error sharing session with user:', error.message);
        return null;
      }

      if (!data) {
        return null;
      }

      return this.mapToSessionShare(data);
    } catch (error) {
      console.error('[SessionSharingRepository] Unexpected error sharing with user:', error);
      return null;
    }
  }

  async getSessionSharesForUser(userId: string): Promise<SessionShare[]> {
    const { data, error } = await this.client
      .from('session_shares')
      .select('*')
      .eq('shared_with_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SessionSharingRepository] Error getting shares for user:', error.message);
      return [];
    }

    return (data || []).map((row) => this.mapToSessionShare(row));
  }

  async getSharesForSession(sessionId: string): Promise<SessionShare[]> {
    const { data, error } = await this.client
      .from('session_shares')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SessionSharingRepository] Error getting shares for session:', error.message);
      return [];
    }

    return (data || []).map((row) => this.mapToSessionShare(row));
  }

  async removeSessionUserShare(shareId: string): Promise<boolean> {
    try {
      const { error } = await this.client.from('session_shares').delete().eq('id', shareId);

      if (error) {
        console.error('[SessionSharingRepository] Error removing user share:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[SessionSharingRepository] Unexpected error removing share:', error);
      return false;
    }
  }

  // Workspace shares

  async shareSessionWithWorkspace(
    sessionId: string,
    workspaceId: string,
    permission: PermissionLevel
  ): Promise<SessionWorkspaceShare | null> {
    try {
      const { data, error } = await this.client
        .from('session_workspace_shares')
        .insert({
          session_id: sessionId,
          workspace_id: workspaceId,
          shared_by_user_id: this.userId,
          permission_level: permission,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[SessionSharingRepository] Error sharing with workspace:', error.message);
        return null;
      }

      if (!data) {
        return null;
      }

      return this.mapToSessionWorkspaceShare(data);
    } catch (error) {
      console.error('[SessionSharingRepository] Unexpected error sharing with workspace:', error);
      return null;
    }
  }

  async getSessionWorkspaceShares(sessionId: string): Promise<SessionWorkspaceShare[]> {
    const { data, error } = await this.client
      .from('session_workspace_shares')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SessionSharingRepository] Error getting workspace shares:', error.message);
      return [];
    }

    return (data || []).map((row) => this.mapToSessionWorkspaceShare(row));
  }

  async removeSessionWorkspaceShare(shareId: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('session_workspace_shares')
        .delete()
        .eq('id', shareId);

      if (error) {
        console.error('[SessionSharingRepository] Error removing workspace share:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[SessionSharingRepository] Unexpected error removing workspace share:', error);
      return false;
    }
  }

  // Exclusions

  async excludeSessionFromProjectShare(
    sessionId: string,
    projectShareId: string
  ): Promise<SessionShareExclusion | null> {
    try {
      const { data, error } = await this.client
        .from('session_share_exclusions')
        .insert({
          session_id: sessionId,
          project_share_id: projectShareId,
          project_workspace_share_id: null,
          excluded_by_user_id: this.userId,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error(
          '[SessionSharingRepository] Error excluding from project share:',
          error.message
        );
        return null;
      }

      if (!data) {
        return null;
      }

      return this.mapToSessionShareExclusion(data);
    } catch (error) {
      console.error('[SessionSharingRepository] Unexpected error excluding session:', error);
      return null;
    }
  }

  async excludeSessionFromWorkspaceShare(
    sessionId: string,
    projectWorkspaceShareId: string
  ): Promise<SessionShareExclusion | null> {
    try {
      const { data, error } = await this.client
        .from('session_share_exclusions')
        .insert({
          session_id: sessionId,
          project_share_id: null,
          project_workspace_share_id: projectWorkspaceShareId,
          excluded_by_user_id: this.userId,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error(
          '[SessionSharingRepository] Error excluding from workspace share:',
          error.message
        );
        return null;
      }

      if (!data) {
        return null;
      }

      return this.mapToSessionShareExclusion(data);
    } catch (error) {
      console.error('[SessionSharingRepository] Unexpected error excluding from workspace:', error);
      return null;
    }
  }

  async getExclusionsForSession(sessionId: string): Promise<SessionShareExclusion[]> {
    const { data, error } = await this.client
      .from('session_share_exclusions')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SessionSharingRepository] Error getting exclusions:', error.message);
      return [];
    }

    return (data || []).map((row) => this.mapToSessionShareExclusion(row));
  }

  async removeExclusion(exclusionId: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('session_share_exclusions')
        .delete()
        .eq('id', exclusionId);

      if (error) {
        console.error('[SessionSharingRepository] Error removing exclusion:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[SessionSharingRepository] Unexpected error removing exclusion:', error);
      return false;
    }
  }

  // Mappers

  private mapToSessionShare(
    data: Database['public']['Tables']['session_shares']['Row']
  ): SessionShare {
    return {
      id: data.id,
      sessionId: data.session_id,
      sharedWithUserId: data.shared_with_user_id,
      sharedByUserId: data.shared_by_user_id,
      permissionLevel: data.permission_level,
      createdAt: data.created_at,
    };
  }

  private mapToSessionWorkspaceShare(
    data: Database['public']['Tables']['session_workspace_shares']['Row']
  ): SessionWorkspaceShare {
    return {
      id: data.id,
      sessionId: data.session_id,
      workspaceId: data.workspace_id,
      sharedByUserId: data.shared_by_user_id,
      permissionLevel: data.permission_level,
      createdAt: data.created_at,
    };
  }

  private mapToSessionShareExclusion(
    data: Database['public']['Tables']['session_share_exclusions']['Row']
  ): SessionShareExclusion {
    return {
      id: data.id,
      sessionId: data.session_id,
      projectShareId: data.project_share_id,
      projectWorkspaceShareId: data.project_workspace_share_id,
      excludedByUserId: data.excluded_by_user_id,
      createdAt: data.created_at,
    };
  }
}

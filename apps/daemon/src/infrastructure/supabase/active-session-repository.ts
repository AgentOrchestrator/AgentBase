/**
 * Supabase implementation of IActiveSessionRepository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../database.types.js';
import type {
  IActiveSessionRepository,
  ActiveSession,
  ActiveSessionInput,
} from '../../interfaces/repositories.js';

export class SupabaseActiveSessionRepository implements IActiveSessionRepository {
  constructor(
    private client: SupabaseClient<Database>,
    private userId: string
  ) {}

  async getActiveSessions(userId: string): Promise<ActiveSession[]> {
    const { data, error } = await this.client
      .from('active_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('last_activity_at', { ascending: false });

    if (error) {
      console.error('[ActiveSessionRepository] Error getting active sessions:', error.message);
      return [];
    }

    return (data || []).map(row => this.mapToActiveSession(row));
  }

  async getActiveSessionsByEditor(userId: string, editorType: string): Promise<ActiveSession[]> {
    const { data, error } = await this.client
      .from('active_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('editor_type', editorType)
      .eq('is_active', true)
      .order('last_activity_at', { ascending: false });

    if (error) {
      console.error('[ActiveSessionRepository] Error getting sessions by editor:', error.message);
      return [];
    }

    return (data || []).map(row => this.mapToActiveSession(row));
  }

  async upsertActiveSession(
    userId: string,
    sessionId: string,
    input: ActiveSessionInput
  ): Promise<ActiveSession | null> {
    try {
      const now = new Date().toISOString();

      const { data, error } = await this.client
        .from('active_sessions')
        .upsert(
          {
            id: sessionId,
            user_id: userId,
            editor_type: input.editorType,
            project_id: input.projectId ?? null,
            workspace_path: input.workspacePath ?? null,
            recent_files: input.recentFiles as any ?? null,
            session_metadata: input.sessionMetadata as any ?? null,
            is_active: true,
            last_activity_at: now,
            updated_at: now,
          },
          {
            onConflict: 'id',
            ignoreDuplicates: false,
          }
        )
        .select()
        .single();

      if (error) {
        console.error('[ActiveSessionRepository] Error upserting active session:', error.message);
        return null;
      }

      if (!data) {
        return null;
      }

      return this.mapToActiveSession(data);
    } catch (error) {
      console.error('[ActiveSessionRepository] Unexpected error upserting session:', error);
      return null;
    }
  }

  async deactivateSession(sessionId: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('active_sessions')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) {
        console.error('[ActiveSessionRepository] Error deactivating session:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[ActiveSessionRepository] Unexpected error deactivating session:', error);
      return false;
    }
  }

  async updateLastActivity(sessionId: string): Promise<boolean> {
    try {
      const now = new Date().toISOString();

      const { error } = await this.client
        .from('active_sessions')
        .update({
          last_activity_at: now,
          updated_at: now,
        })
        .eq('id', sessionId);

      if (error) {
        console.error('[ActiveSessionRepository] Error updating last activity:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[ActiveSessionRepository] Unexpected error updating activity:', error);
      return false;
    }
  }

  private mapToActiveSession(
    data: Database['public']['Tables']['active_sessions']['Row']
  ): ActiveSession {
    return {
      id: data.id,
      userId: data.user_id,
      projectId: data.project_id,
      editorType: data.editor_type,
      workspacePath: data.workspace_path,
      isActive: data.is_active ?? false,
      lastActivityAt: data.last_activity_at,
      recentFiles: Array.isArray(data.recent_files)
        ? (data.recent_files as string[])
        : null,
      sessionMetadata: data.session_metadata as Record<string, unknown> | null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

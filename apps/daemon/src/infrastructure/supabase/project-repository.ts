/**
 * Supabase implementation of IProjectRepository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../database.types.js';
import type { IProjectRepository, Project, ProjectInput } from '../../interfaces/repositories.js';

export class SupabaseProjectRepository implements IProjectRepository {
  constructor(
    private client: SupabaseClient<Database>,
    private userId: string
  ) {}

  async findDefaultProject(userId: string): Promise<Project | null> {
    const { data, error } = await this.client
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .maybeSingle();

    if (error) {
      console.error('[ProjectRepository] Error finding default project:', error.message);
      return null;
    }

    if (!data) {
      return null;
    }

    return this.mapToProject(data);
  }

  async createDefaultProject(userId: string): Promise<Project> {
    const { data, error } = await this.client
      .from('projects')
      .insert({
        user_id: userId,
        name: 'Uncategorized',
        project_path: null,
        description: 'Default project for sessions without project information',
        is_default: true,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create default project: ${error.message}`);
    }

    return this.mapToProject(data);
  }

  async findOrCreateDefaultProject(userId: string): Promise<Project> {
    const existing = await this.findDefaultProject(userId);
    if (existing) {
      return existing;
    }
    return this.createDefaultProject(userId);
  }

  async findByUserAndName(userId: string, name: string): Promise<Project | null> {
    const { data, error } = await this.client
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .eq('name', name)
      .maybeSingle();

    if (error) {
      console.error('[ProjectRepository] Error finding project by name:', error.message);
      return null;
    }

    if (!data) {
      return null;
    }

    return this.mapToProject(data);
  }

  async upsertProject(userId: string, project: ProjectInput): Promise<Project> {
    const { data, error } = await this.client
      .from('projects')
      .upsert(
        {
          user_id: userId,
          name: project.name,
          project_path: project.path,
          description: project.description ?? null,
          is_default: project.isDefault ?? false,
          workspace_metadata: project.workspaceMetadata as any,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,name',
          ignoreDuplicates: false,
        }
      )
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to upsert project: ${error.message}`);
    }

    return this.mapToProject(data);
  }

  private mapToProject(data: Database['public']['Tables']['projects']['Row']): Project {
    const project: Project = {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      path: data.project_path,
      description: data.description,
      isDefault: data.is_default ?? false,
    };

    // Only set optional properties if they have values
    if (data.workspace_metadata) {
      project.workspaceMetadata = data.workspace_metadata as Record<string, unknown>;
    }
    if (data.created_at) {
      project.createdAt = data.created_at;
    }
    if (data.updated_at) {
      project.updatedAt = data.updated_at;
    }

    return project;
  }
}

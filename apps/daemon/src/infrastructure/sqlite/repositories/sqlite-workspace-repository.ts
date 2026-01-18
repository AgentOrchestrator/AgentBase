/**
 * SQLite stub implementation of IWorkspaceRepository
 * Workspace features are not needed for local-only mode, so all methods return empty/null
 */

import type {
  IWorkspaceRepository,
  Workspace,
  WorkspaceInput,
  WorkspaceMember,
} from '../../../interfaces/repositories.js';

export class SQLiteWorkspaceRepository implements IWorkspaceRepository {
  async findById(_workspaceId: string): Promise<Workspace | null> {
    return null;
  }

  async findBySlug(_slug: string): Promise<Workspace | null> {
    return null;
  }

  async findByUser(_userId: string): Promise<Workspace[]> {
    return [];
  }

  async create(_userId: string, _input: WorkspaceInput): Promise<Workspace | null> {
    console.warn('[SQLiteWorkspaceRepository] Workspaces are not supported in local mode');
    return null;
  }

  async update(_workspaceId: string, _updates: Partial<WorkspaceInput>): Promise<Workspace | null> {
    return null;
  }

  async delete(_workspaceId: string): Promise<boolean> {
    return false;
  }

  async getMembers(_workspaceId: string): Promise<WorkspaceMember[]> {
    return [];
  }

  async addMember(
    _workspaceId: string,
    _userId: string,
    _role: string,
    _invitedByUserId: string
  ): Promise<WorkspaceMember | null> {
    return null;
  }

  async updateMemberRole(_workspaceId: string, _userId: string, _role: string): Promise<boolean> {
    return false;
  }

  async removeMember(_workspaceId: string, _userId: string): Promise<boolean> {
    return false;
  }

  async acceptInvitation(_workspaceId: string, _userId: string): Promise<boolean> {
    return false;
  }
}

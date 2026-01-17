/**
 * SQLite stub implementation of IProjectSharingRepository
 * Project sharing features are not needed for local-only mode, so all methods return empty/null
 */

import type {
  IProjectSharingRepository,
  PermissionLevel,
  ProjectOrganizationShare,
  ProjectShare,
  ProjectWorkspaceShare,
} from '../../../interfaces/repositories.js';

export class SQLiteProjectSharingRepository implements IProjectSharingRepository {
  async shareWithUser(
    _projectId: string,
    _sharedWithUserId: string,
    _permission: PermissionLevel
  ): Promise<ProjectShare | null> {
    console.warn('[SQLiteProjectSharingRepository] Project sharing is not supported in local mode');
    return null;
  }

  async getProjectSharesForUser(_userId: string): Promise<ProjectShare[]> {
    return [];
  }

  async getSharesForProject(_projectId: string): Promise<ProjectShare[]> {
    return [];
  }

  async removeUserShare(_shareId: string): Promise<boolean> {
    return false;
  }

  async updateUserSharePermission(
    _shareId: string,
    _permission: PermissionLevel
  ): Promise<boolean> {
    return false;
  }

  async shareWithWorkspace(
    _projectId: string,
    _workspaceId: string,
    _permission: PermissionLevel
  ): Promise<ProjectWorkspaceShare | null> {
    return null;
  }

  async getProjectWorkspaceShares(_projectId: string): Promise<ProjectWorkspaceShare[]> {
    return [];
  }

  async removeWorkspaceShare(_shareId: string): Promise<boolean> {
    return false;
  }

  async shareWithOrganization(
    _projectId: string,
    _organizationName: string,
    _permission: PermissionLevel
  ): Promise<ProjectOrganizationShare | null> {
    return null;
  }

  async getProjectOrganizationShares(_projectId: string): Promise<ProjectOrganizationShare[]> {
    return [];
  }

  async removeOrganizationShare(_shareId: string): Promise<boolean> {
    return false;
  }
}

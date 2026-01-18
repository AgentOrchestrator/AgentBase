/**
 * SQLite stub implementation of ISessionSharingRepository
 * Session sharing features are not needed for local-only mode, so all methods return empty/null
 */

import type {
  ISessionSharingRepository,
  PermissionLevel,
  SessionShare,
  SessionShareExclusion,
  SessionWorkspaceShare,
} from '../../../interfaces/repositories.js';

export class SQLiteSessionSharingRepository implements ISessionSharingRepository {
  async shareSessionWithUser(
    _sessionId: string,
    _sharedWithUserId: string,
    _permission: PermissionLevel
  ): Promise<SessionShare | null> {
    console.warn('[SQLiteSessionSharingRepository] Session sharing is not supported in local mode');
    return null;
  }

  async getSessionSharesForUser(_userId: string): Promise<SessionShare[]> {
    return [];
  }

  async getSharesForSession(_sessionId: string): Promise<SessionShare[]> {
    return [];
  }

  async removeSessionUserShare(_shareId: string): Promise<boolean> {
    return false;
  }

  async shareSessionWithWorkspace(
    _sessionId: string,
    _workspaceId: string,
    _permission: PermissionLevel
  ): Promise<SessionWorkspaceShare | null> {
    return null;
  }

  async getSessionWorkspaceShares(_sessionId: string): Promise<SessionWorkspaceShare[]> {
    return [];
  }

  async removeSessionWorkspaceShare(_shareId: string): Promise<boolean> {
    return false;
  }

  async excludeSessionFromProjectShare(
    _sessionId: string,
    _projectShareId: string
  ): Promise<SessionShareExclusion | null> {
    return null;
  }

  async excludeSessionFromWorkspaceShare(
    _sessionId: string,
    _projectWorkspaceShareId: string
  ): Promise<SessionShareExclusion | null> {
    return null;
  }

  async getExclusionsForSession(_sessionId: string): Promise<SessionShareExclusion[]> {
    return [];
  }

  async removeExclusion(_exclusionId: string): Promise<boolean> {
    return false;
  }
}

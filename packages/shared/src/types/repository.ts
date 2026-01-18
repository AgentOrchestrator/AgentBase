/**
 * Repository Types
 *
 * Domain entity types and repository interfaces for data access.
 * These types are database-agnostic and can be used across the monorepo.
 */

import type { AgentType, ChatMessage } from '../loaders/types.js';

// ============================================================================
// Domain Types
// ============================================================================

/**
 * Project entity - represents a user's project
 */
export interface Project {
  id: string;
  userId: string;
  name: string;
  path: string | null;
  description: string | null;
  isDefault: boolean;
  workspaceMetadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Input for creating/updating a project
 */
export interface ProjectInput {
  name: string;
  path: string | null;
  description?: string | null;
  isDefault?: boolean;
  workspaceMetadata?: Record<string, unknown>;
}

/**
 * Chat history record - represents a chat session
 */
export interface ChatHistoryRecord {
  id: string;
  userId: string;
  projectId: string | null;
  agentType: AgentType;
  timestamp: string;
  messages: ChatMessage[];
  metadata?: Record<string, unknown>;
  latestMessageTimestamp: string | null;
  createdAt?: string;
  updatedAt?: string;
  // AI-generated fields
  aiSummary?: string | null;
  aiSummaryGeneratedAt?: string | null;
  aiSummaryMessageCount?: number | null;
  aiTitle?: string | null;
  aiTitleGeneratedAt?: string | null;
  aiKeywordsTopic?: string[] | null;
  aiKeywordsType?: string[] | null;
  aiKeywordsGeneratedAt?: string | null;
  aiKeywordsMessageCount?: number | null;
}

/**
 * Input for creating/updating a chat history
 */
export interface ChatHistoryInput {
  id: string;
  userId: string;
  projectId: string | null;
  agentType: AgentType;
  timestamp: string;
  messages: ChatMessage[];
  metadata?: Record<string, unknown>;
  latestMessageTimestamp: string | null;
}

/**
 * User preferences for AI features
 */
export interface UserPreferences {
  userId: string;
  aiSummaryEnabled: boolean;
  aiTitleEnabled: boolean;
  aiModelProvider?: string;
  aiModelName?: string;
}

/**
 * LLM API key configuration
 */
export interface ApiKeyRecord {
  id: string;
  userId: string;
  provider: string;
  encryptedKey: string;
  isActive: boolean;
  isDefault: boolean;
}

/**
 * User profile entity
 */
export interface User {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  githubUsername: string | null;
  githubAvatarUrl: string | null;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Active editor session entity
 */
export interface ActiveSession {
  id: string;
  userId: string;
  projectId: string | null;
  editorType: string;
  workspacePath: string | null;
  isActive: boolean;
  lastActivityAt: string;
  recentFiles: string[] | null;
  sessionMetadata: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Input for creating/updating an active session
 */
export interface ActiveSessionInput {
  editorType: string;
  projectId?: string | null;
  workspacePath?: string | null;
  recentFiles?: string[] | null;
  sessionMetadata?: Record<string, unknown>;
}

/**
 * Workspace entity
 */
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdByUserId: string;
  workspaceMetadata: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Workspace member entity
 */
export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  invitationStatus: string;
  invitedByUserId: string | null;
  invitedAt: string | null;
  joinedAt: string | null;
  createdAt: string | null;
}

/**
 * Input for creating a workspace
 */
export interface WorkspaceInput {
  name: string;
  slug: string;
  description?: string | null;
  workspaceMetadata?: Record<string, unknown>;
}

/**
 * Permission level for sharing
 */
export type PermissionLevel = 'view' | 'edit' | 'admin';

/**
 * Project share with a user
 */
export interface ProjectShare {
  id: string;
  projectId: string;
  sharedWithUserId: string;
  sharedByUserId: string;
  permissionLevel: string;
  createdAt: string | null;
}

/**
 * Project share with a workspace
 */
export interface ProjectWorkspaceShare {
  id: string;
  projectId: string;
  workspaceId: string;
  sharedByUserId: string;
  permissionLevel: string;
  createdAt: string | null;
}

/**
 * Project share with an organization
 */
export interface ProjectOrganizationShare {
  id: string;
  projectId: string;
  organizationName: string;
  sharedByUserId: string;
  permissionLevel: string;
  createdAt: string | null;
}

/**
 * Session share with a user
 */
export interface SessionShare {
  id: string;
  sessionId: string;
  sharedWithUserId: string;
  sharedByUserId: string;
  permissionLevel: string;
  createdAt: string | null;
}

/**
 * Session share with a workspace
 */
export interface SessionWorkspaceShare {
  id: string;
  sessionId: string;
  workspaceId: string;
  sharedByUserId: string;
  permissionLevel: string;
  createdAt: string | null;
}

/**
 * Session excluded from a project share
 */
export interface SessionShareExclusion {
  id: string;
  sessionId: string;
  projectShareId: string | null;
  projectWorkspaceShareId: string | null;
  excludedByUserId: string;
  createdAt: string | null;
}

/**
 * Canvas node position record
 */
export interface CanvasNodePosition {
  id: string;
  userId: string;
  nodeId: string;
  positionX: number;
  positionY: number;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Pinned conversation record
 */
export interface PinnedConversation {
  id: string;
  userId: string;
  conversationId: string;
  pinnedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Session summary cache record
 */
export interface SessionSummaryRecord {
  id: string;
  sessionId: string;
  workspacePath: string;
  summary: string;
  messageCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

// ============================================================================
// Repository Interfaces
// ============================================================================

/**
 * Project repository interface
 */
export interface IProjectRepository {
  /**
   * Find the default project for a user
   */
  findDefaultProject(userId: string): Promise<Project | null>;

  /**
   * Create a default "Uncategorized" project for a user
   */
  createDefaultProject(userId: string): Promise<Project>;

  /**
   * Find or create the default project for a user
   */
  findOrCreateDefaultProject(userId: string): Promise<Project>;

  /**
   * Find a project by user ID and name
   */
  findByUserAndName(userId: string, name: string): Promise<Project | null>;

  /**
   * Upsert a project (create or update based on user_id + name)
   * @returns The created/updated project
   */
  upsertProject(userId: string, project: ProjectInput): Promise<Project>;
}

/**
 * Chat history repository interface
 */
export interface IChatHistoryRepository {
  /**
   * Upsert a chat history (create or update based on id)
   * @returns true if successful, false otherwise
   */
  upsert(history: ChatHistoryInput): Promise<boolean>;

  /**
   * Find a chat history by ID
   */
  findById(id: string, userId: string): Promise<ChatHistoryRecord | null>;

  /**
   * Find recent chat histories for a user since a given date
   */
  findRecentByUser(userId: string, since: Date): Promise<ChatHistoryRecord[]>;

  /**
   * Update AI-generated summary for a chat history
   */
  updateAiSummary(id: string, summary: string, messageCount: number): Promise<boolean>;

  /**
   * Update AI-generated keywords for a chat history
   */
  updateAiKeywords(
    id: string,
    keywords: { type: string[]; topic: string[] },
    messageCount: number
  ): Promise<boolean>;

  /**
   * Update AI-generated title for a chat history
   */
  updateAiTitle(id: string, title: string): Promise<boolean>;
}

/**
 * API key repository interface
 */
export interface IApiKeyRepository {
  /**
   * Find an active API key for a user and provider
   */
  findActiveKey(
    userId: string,
    provider: string
  ): Promise<{ key: string; provider: string } | null>;

  /**
   * Find the default provider for a user
   */
  findDefaultProvider(userId: string): Promise<string | null>;
}

/**
 * User preferences repository interface
 */
export interface IUserPreferencesRepository {
  /**
   * Find user preferences by user ID
   * Returns default preferences if not found
   */
  findByUserId(userId: string): Promise<UserPreferences>;
}

/**
 * User repository interface
 */
export interface IUserRepository {
  /**
   * Find a user by ID
   */
  findById(userId: string): Promise<User | null>;

  /**
   * Find a user by email
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Update user profile
   */
  updateProfile(
    userId: string,
    updates: Partial<Pick<User, 'displayName' | 'avatarUrl'>>
  ): Promise<User | null>;
}

/**
 * Active session repository interface
 */
export interface IActiveSessionRepository {
  /**
   * Get all active sessions for a user
   */
  getActiveSessions(userId: string): Promise<ActiveSession[]>;

  /**
   * Get active sessions for a specific editor
   */
  getActiveSessionsByEditor(userId: string, editorType: string): Promise<ActiveSession[]>;

  /**
   * Create or update an active session
   */
  upsertActiveSession(
    userId: string,
    sessionId: string,
    input: ActiveSessionInput
  ): Promise<ActiveSession | null>;

  /**
   * Mark a session as inactive
   */
  deactivateSession(sessionId: string): Promise<boolean>;

  /**
   * Update last activity timestamp
   */
  updateLastActivity(sessionId: string): Promise<boolean>;
}

/**
 * Workspace repository interface
 */
export interface IWorkspaceRepository {
  /**
   * Find a workspace by ID
   */
  findById(workspaceId: string): Promise<Workspace | null>;

  /**
   * Find a workspace by slug
   */
  findBySlug(slug: string): Promise<Workspace | null>;

  /**
   * Find all workspaces for a user
   */
  findByUser(userId: string): Promise<Workspace[]>;

  /**
   * Create a new workspace
   */
  create(userId: string, input: WorkspaceInput): Promise<Workspace | null>;

  /**
   * Update a workspace
   */
  update(workspaceId: string, updates: Partial<WorkspaceInput>): Promise<Workspace | null>;

  /**
   * Delete a workspace
   */
  delete(workspaceId: string): Promise<boolean>;

  /**
   * Get all members of a workspace
   */
  getMembers(workspaceId: string): Promise<WorkspaceMember[]>;

  /**
   * Add a member to a workspace
   */
  addMember(
    workspaceId: string,
    userId: string,
    role: string,
    invitedByUserId: string
  ): Promise<WorkspaceMember | null>;

  /**
   * Update a member's role
   */
  updateMemberRole(workspaceId: string, userId: string, role: string): Promise<boolean>;

  /**
   * Remove a member from a workspace
   */
  removeMember(workspaceId: string, userId: string): Promise<boolean>;

  /**
   * Accept a workspace invitation
   */
  acceptInvitation(workspaceId: string, userId: string): Promise<boolean>;
}

/**
 * Project sharing repository interface
 */
export interface IProjectSharingRepository {
  /**
   * Share a project with a user
   */
  shareWithUser(
    projectId: string,
    sharedWithUserId: string,
    permission: PermissionLevel
  ): Promise<ProjectShare | null>;

  /**
   * Get all project shares for a user (projects shared with them)
   */
  getProjectSharesForUser(userId: string): Promise<ProjectShare[]>;

  /**
   * Get all shares for a specific project
   */
  getSharesForProject(projectId: string): Promise<ProjectShare[]>;

  /**
   * Remove a user share
   */
  removeUserShare(shareId: string): Promise<boolean>;

  /**
   * Update permission level for a user share
   */
  updateUserSharePermission(shareId: string, permission: PermissionLevel): Promise<boolean>;

  /**
   * Share a project with a workspace
   */
  shareWithWorkspace(
    projectId: string,
    workspaceId: string,
    permission: PermissionLevel
  ): Promise<ProjectWorkspaceShare | null>;

  /**
   * Get all workspace shares for a project
   */
  getProjectWorkspaceShares(projectId: string): Promise<ProjectWorkspaceShare[]>;

  /**
   * Remove a workspace share
   */
  removeWorkspaceShare(shareId: string): Promise<boolean>;

  /**
   * Share a project with an organization
   */
  shareWithOrganization(
    projectId: string,
    organizationName: string,
    permission: PermissionLevel
  ): Promise<ProjectOrganizationShare | null>;

  /**
   * Get all organization shares for a project
   */
  getProjectOrganizationShares(projectId: string): Promise<ProjectOrganizationShare[]>;

  /**
   * Remove an organization share
   */
  removeOrganizationShare(shareId: string): Promise<boolean>;
}

/**
 * Session sharing repository interface
 */
export interface ISessionSharingRepository {
  /**
   * Share a session with a user
   */
  shareSessionWithUser(
    sessionId: string,
    sharedWithUserId: string,
    permission: PermissionLevel
  ): Promise<SessionShare | null>;

  /**
   * Get all session shares for a user (sessions shared with them)
   */
  getSessionSharesForUser(userId: string): Promise<SessionShare[]>;

  /**
   * Get all shares for a specific session
   */
  getSharesForSession(sessionId: string): Promise<SessionShare[]>;

  /**
   * Remove a session user share
   */
  removeSessionUserShare(shareId: string): Promise<boolean>;

  /**
   * Share a session with a workspace
   */
  shareSessionWithWorkspace(
    sessionId: string,
    workspaceId: string,
    permission: PermissionLevel
  ): Promise<SessionWorkspaceShare | null>;

  /**
   * Get all workspace shares for a session
   */
  getSessionWorkspaceShares(sessionId: string): Promise<SessionWorkspaceShare[]>;

  /**
   * Remove a session workspace share
   */
  removeSessionWorkspaceShare(shareId: string): Promise<boolean>;

  /**
   * Exclude a session from a project share
   */
  excludeSessionFromProjectShare(
    sessionId: string,
    projectShareId: string
  ): Promise<SessionShareExclusion | null>;

  /**
   * Exclude a session from a workspace share
   */
  excludeSessionFromWorkspaceShare(
    sessionId: string,
    projectWorkspaceShareId: string
  ): Promise<SessionShareExclusion | null>;

  /**
   * Get all exclusions for a session
   */
  getExclusionsForSession(sessionId: string): Promise<SessionShareExclusion[]>;

  /**
   * Remove an exclusion
   */
  removeExclusion(exclusionId: string): Promise<boolean>;
}

/**
 * Canvas layout repository interface
 */
export interface ICanvasLayoutRepository {
  /**
   * Get all node positions for a user
   */
  getNodePositions(userId: string): Promise<CanvasNodePosition[]>;

  /**
   * Save a node position
   */
  saveNodePosition(
    userId: string,
    nodeId: string,
    positionX: number,
    positionY: number
  ): Promise<CanvasNodePosition | null>;

  /**
   * Batch save multiple node positions
   */
  saveNodePositions(
    userId: string,
    positions: Array<{ nodeId: string; positionX: number; positionY: number }>
  ): Promise<boolean>;

  /**
   * Delete a node position
   */
  deleteNodePosition(userId: string, nodeId: string): Promise<boolean>;

  /**
   * Clear all positions for a user
   */
  clearAllPositions(userId: string): Promise<boolean>;
}

/**
 * Pinned conversation repository interface
 */
export interface IPinnedConversationRepository {
  /**
   * Get all pinned conversations for a user
   */
  getPinnedConversations(userId: string): Promise<PinnedConversation[]>;

  /**
   * Pin a conversation
   */
  pinConversation(userId: string, conversationId: string): Promise<PinnedConversation | null>;

  /**
   * Unpin a conversation
   */
  unpinConversation(userId: string, conversationId: string): Promise<boolean>;

  /**
   * Check if a conversation is pinned
   */
  isConversationPinned(userId: string, conversationId: string): Promise<boolean>;
}

/**
 * Session summary repository interface
 */
export interface ISessionSummaryRepository {
  /**
   * Get a cached summary for a session
   */
  getSummary(sessionId: string, workspacePath: string): Promise<SessionSummaryRecord | null>;

  /**
   * Save or update a summary for a session
   */
  saveSummary(
    sessionId: string,
    workspacePath: string,
    summary: string,
    messageCount: number
  ): Promise<SessionSummaryRecord | null>;

  /**
   * Check if a cached summary is stale (message count changed)
   */
  isSummaryStale(
    sessionId: string,
    workspacePath: string,
    currentMessageCount: number
  ): Promise<boolean>;

  /**
   * Delete a cached summary
   */
  deleteSummary(sessionId: string, workspacePath: string): Promise<boolean>;
}

// ============================================================================
// Repository Factory
// ============================================================================

/**
 * Factory for creating authenticated repositories
 * Implementations create repositories bound to a specific user session
 */
export interface IRepositoryFactory {
  /**
   * Create an authenticated context and return repositories
   * @param accessToken User's access token
   * @param refreshToken User's refresh token
   * @returns Object containing userId and all repositories
   */
  createRepositories(
    accessToken: string,
    refreshToken: string
  ): Promise<{
    userId: string;
    users: IUserRepository;
    projects: IProjectRepository;
    chatHistories: IChatHistoryRepository;
    apiKeys: IApiKeyRepository;
    userPreferences: IUserPreferencesRepository;
    activeSessions: IActiveSessionRepository;
    workspaces: IWorkspaceRepository;
    projectSharing: IProjectSharingRepository;
    sessionSharing: ISessionSharingRepository;
    canvasLayouts: ICanvasLayoutRepository;
    pinnedConversations: IPinnedConversationRepository;
  }>;
}

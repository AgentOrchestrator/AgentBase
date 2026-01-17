/**
 * Repository interfaces - re-exported from shared package
 * All types are now defined in @agent-orchestrator/shared
 */

export type {
  // Domain entities
  Project,
  ProjectInput,
  ChatHistoryRecord,
  ChatHistoryInput,
  UserPreferences,
  ApiKeyRecord,
  User,
  ActiveSession,
  ActiveSessionInput,
  Workspace,
  WorkspaceMember,
  WorkspaceInput,
  PermissionLevel,
  ProjectShare,
  ProjectWorkspaceShare,
  ProjectOrganizationShare,
  SessionShare,
  SessionWorkspaceShare,
  SessionShareExclusion,
  CanvasNodePosition,
  PinnedConversation,
  SessionSummaryRecord,
  // Repository interfaces
  IProjectRepository,
  IChatHistoryRepository,
  IApiKeyRepository,
  IUserPreferencesRepository,
  IUserRepository,
  IActiveSessionRepository,
  IWorkspaceRepository,
  IProjectSharingRepository,
  ISessionSharingRepository,
  ICanvasLayoutRepository,
  IPinnedConversationRepository,
  ISessionSummaryRepository,
  IRepositoryFactory,
} from '@agent-orchestrator/shared';

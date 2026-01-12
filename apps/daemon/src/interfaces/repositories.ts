/**
 * Repository interfaces - no database-specific types exposed
 * All implementations must conform to these interfaces
 */

import type { ChatMessage, AgentType } from '../types.js';

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
  updateAiSummary(
    id: string,
    summary: string,
    messageCount: number
  ): Promise<boolean>;

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
    projects: IProjectRepository;
    chatHistories: IChatHistoryRepository;
    apiKeys: IApiKeyRepository;
    userPreferences: IUserPreferencesRepository;
  }>;
}

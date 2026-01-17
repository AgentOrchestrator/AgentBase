import type { ChatHistory } from './claude-code-reader.js';
import type { FailedSyncData } from './database.js';
import { getDatabase } from './database.js';
import type {
  IChatHistoryRepository,
  IProjectRepository,
  IRepositoryFactory,
} from './interfaces/repositories.js';
import type { UnifiedProjectInfo } from './project-aggregator.js';

/**
 * Find or create a project for a session based on metadata
 * Returns project_id or null if creation fails
 */
async function findOrCreateProject(
  history: ChatHistory,
  userId: string,
  projectRepo: IProjectRepository
): Promise<string | null> {
  const projectName = history.metadata?.projectName;

  // If no project name in metadata, link to default "Uncategorized" project
  if (!projectName) {
    try {
      const defaultProject = await projectRepo.findOrCreateDefaultProject(userId);
      return defaultProject.id;
    } catch (error) {
      console.error('Error finding/creating default project:', error);
      return null;
    }
  }

  // Find existing project with this name
  const existingProject = await projectRepo.findByUserAndName(userId, projectName);
  if (existingProject) {
    return existingProject.id;
  }

  // Project doesn't exist, create it
  try {
    const newProject = await projectRepo.upsertProject(userId, {
      name: projectName,
      path: history.metadata?.projectPath || null,
      description: `Auto-created from ${history.agent_type} session`,
      isDefault: false,
    });
    console.log(`  → Created new project: ${projectName}`);
    return newProject.id;
  } catch (error) {
    console.error(`Error creating project ${projectName}:`, error);
    return null;
  }
}

export async function uploadChatHistory(
  history: ChatHistory,
  userId: string,
  projectRepo: IProjectRepository,
  chatHistoryRepo: IChatHistoryRepository
): Promise<boolean> {
  try {
    // Calculate the latest message timestamp from the messages array
    let latestMessageTimestamp: string | null = null;
    if (history.messages && history.messages.length > 0) {
      // Find the most recent timestamp among all messages
      const timestamps = history.messages
        .map((msg) => msg.timestamp)
        .filter((ts): ts is string => !!ts)
        .sort()
        .reverse();

      latestMessageTimestamp = timestamps[0] || null;
    }

    // Find or create project for this session
    const projectId = await findOrCreateProject(history, userId, projectRepo);

    // Upsert based on session ID
    const success = await chatHistoryRepo.upsert({
      id: history.id,
      userId,
      projectId,
      agentType: history.agent_type,
      timestamp: history.timestamp,
      messages: history.messages,
      metadata: history.metadata as Record<string, unknown>,
      latestMessageTimestamp,
    });

    if (!success) {
      console.error(`Error uploading chat history ${history.id}`);
      return false;
    }

    const projectName = history.metadata?.projectName || 'Uncategorized';
    const messageCount = history.messages.length;

    // Format agent type for display
    let agentLabel = '';
    if (history.agent_type === 'claude_code') {
      agentLabel = '[Claude Code]';
    } else if (history.agent_type === 'cursor') {
      const source = history.metadata?.source;
      if (source === 'cursor-composer') {
        agentLabel = '[Cursor Composer]';
      } else if (source === 'cursor-copilot') {
        agentLabel = '[Cursor Copilot]';
      } else {
        agentLabel = '[Cursor]';
      }
    } else if (history.agent_type === 'factory') {
      agentLabel = '[Factory]';
    } else if (history.agent_type === 'vscode') {
      agentLabel = '[VSCode]';
    } else if (history.agent_type === 'codex') {
      agentLabel = '[Codex]';
    }

    // Format latest message timestamp (in UTC to match database)
    const timeDisplay = latestMessageTimestamp
      ? new Date(latestMessageTimestamp).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
          timeZoneName: 'short',
        })
      : 'unknown time';

    console.log(`✓ 🔐 ${agentLabel} ${projectName} (${messageCount} msgs, latest: ${timeDisplay})`);
    return true;
  } catch (error) {
    console.error(`Failed to upload chat history ${history.id}:`, error);
    return false;
  }
}

/**
 * Upsert a project to the database
 */
export async function upsertProject(
  project: UnifiedProjectInfo,
  userId: string,
  projectRepo: IProjectRepository
): Promise<string | null> {
  try {
    // Build workspace metadata from project info
    const workspaceMetadata = {
      workspaceIds: project.workspaceIds,
      composerCount: project.composerCount,
      copilotSessionCount: project.copilotSessionCount,
      claudeCodeSessionCount: project.claudeCodeSessionCount,
      lastActivity: project.lastActivity,
    };

    const result = await projectRepo.upsertProject(userId, {
      name: project.name,
      path: project.path,
      workspaceMetadata,
    });

    const counts = [];
    if (project.composerCount > 0) counts.push(`Composer: ${project.composerCount}`);
    if (project.copilotSessionCount > 0) counts.push(`Copilot: ${project.copilotSessionCount}`);
    if (project.claudeCodeSessionCount > 0)
      counts.push(`Claude Code: ${project.claudeCodeSessionCount}`);

    console.log(`✓ Project: ${project.name} (${counts.join(', ')})`);
    return result.id;
  } catch (error) {
    console.error(`Failed to upsert project ${project.name}:`, error);
    return null;
  }
}

/**
 * Sync all projects from conversations
 */
export async function syncProjects(
  projects: UnifiedProjectInfo[],
  userId: string,
  projectRepo: IProjectRepository
): Promise<Map<string, string>> {
  console.log(`\nSyncing ${projects.length} projects...`);

  const projectIdMap = new Map<string, string>(); // Map project path to project ID

  for (const project of projects) {
    const projectId = await upsertProject(project, userId, projectRepo);
    if (projectId) {
      projectIdMap.set(project.path, projectId);
    }
  }

  console.log(`Project sync complete: ${projectIdMap.size}/${projects.length} synced\n`);
  return projectIdMap;
}

export async function uploadAllHistories(
  histories: ChatHistory[],
  userId: string,
  projectRepo: IProjectRepository,
  chatHistoryRepo: IChatHistoryRepository,
  failedSyncsToRetry: FailedSyncData[] = []
): Promise<{ successCount: number; failureCount: number }> {
  const db = getDatabase();

  console.log(
    `Uploading ${histories.length} chat histories${failedSyncsToRetry.length > 0 ? ` (+ ${failedSyncsToRetry.length} retries)` : ''}...`
  );

  let successCount = 0;
  let failureCount = 0;

  // Upload new histories
  for (const history of histories) {
    const success = await uploadChatHistory(history, userId, projectRepo, chatHistoryRepo);
    if (success) {
      successCount++;
      // Remove from failed syncs if it was there
      const sessionSource = history.metadata?.source || history.agent_type || 'unknown';
      db.removeFailedSync(history.id, sessionSource);
    } else {
      failureCount++;
      // Track this failure
      const sessionSource = history.metadata?.source || history.agent_type || 'unknown';
      db.addFailedSync(history.id, sessionSource, 'Upload failed');
    }
  }

  // Retry previously failed syncs
  for (const failedSync of failedSyncsToRetry) {
    // We need to fetch the session again - for now, skip retries
    // This would require storing the full session data or re-reading from disk
    // For now, we'll just log and skip
    console.log(`⚠️  Retry for ${failedSync.session_id} skipped (requires session re-fetch)`);
  }

  console.log(`Upload complete: ${successCount} succeeded, ${failureCount} failed`);
  return { successCount, failureCount };
}

// ============================================================================
// Legacy wrapper functions for backward compatibility during migration
// These accept tokens and use the factory to create repositories
// ============================================================================

/**
 * Upload chat history using token-based authentication
 * @deprecated Use uploadChatHistory with repository injection instead
 */
export async function uploadChatHistoryWithTokens(
  history: ChatHistory,
  _accountId: string | null,
  accessToken: string | null,
  refreshToken: string | null,
  repositoryFactory: IRepositoryFactory
): Promise<boolean> {
  if (!accessToken || !refreshToken) {
    console.error('No access token or refresh token provided');
    return false;
  }

  try {
    const { userId, projects, chatHistories } = await repositoryFactory.createRepositories(
      accessToken,
      refreshToken
    );
    return uploadChatHistory(history, userId, projects, chatHistories);
  } catch (error) {
    console.error('Failed to create repositories:', error);
    return false;
  }
}

/**
 * Upsert project using token-based authentication
 * @deprecated Use upsertProject with repository injection instead
 */
export async function upsertProjectWithTokens(
  project: UnifiedProjectInfo,
  _accountId: string | null,
  accessToken: string | null,
  refreshToken: string | null,
  repositoryFactory: IRepositoryFactory
): Promise<string | null> {
  if (!accessToken || !refreshToken) {
    console.log(`Skipping project ${project.name} (not authenticated)`);
    return null;
  }

  try {
    const { userId, projects } = await repositoryFactory.createRepositories(
      accessToken,
      refreshToken
    );
    return upsertProject(project, userId, projects);
  } catch (error) {
    console.error('Failed to create repositories:', error);
    return null;
  }
}

/**
 * Sync projects using token-based authentication
 * @deprecated Use syncProjects with repository injection instead
 */
export async function syncProjectsWithTokens(
  projectsList: UnifiedProjectInfo[],
  _accountId: string | null,
  accessToken: string | null,
  refreshToken: string | null,
  repositoryFactory: IRepositoryFactory
): Promise<Map<string, string>> {
  if (!accessToken || !refreshToken) {
    console.log('Skipping project sync (not authenticated)');
    return new Map();
  }

  try {
    const { userId, projects: projectRepo } = await repositoryFactory.createRepositories(
      accessToken,
      refreshToken
    );
    return syncProjects(projectsList, userId, projectRepo);
  } catch (error) {
    console.error('Failed to create repositories:', error);
    return new Map();
  }
}

/**
 * Upload all histories using token-based authentication
 * @deprecated Use uploadAllHistories with repository injection instead
 */
export async function uploadAllHistoriesWithTokens(
  histories: ChatHistory[],
  _accountId: string | null,
  accessToken: string | null,
  refreshToken: string | null,
  repositoryFactory: IRepositoryFactory,
  failedSyncsToRetry: FailedSyncData[] = []
): Promise<{ successCount: number; failureCount: number }> {
  if (!accessToken || !refreshToken) {
    console.error('No access token or refresh token provided');
    return { successCount: 0, failureCount: histories.length };
  }

  try {
    const { userId, projects, chatHistories } = await repositoryFactory.createRepositories(
      accessToken,
      refreshToken
    );
    return uploadAllHistories(histories, userId, projects, chatHistories, failedSyncsToRetry);
  } catch (error) {
    console.error('Failed to create repositories:', error);
    return { successCount: 0, failureCount: histories.length };
  }
}

import { createAuthenticatedClient } from './supabase.js';
import type { ChatHistory } from './claude-code-reader.js';
import type { UnifiedProjectInfo } from './project-aggregator.js';
import { getDatabase } from './database.js';
import type { FailedSyncData } from './database.js';

/**
 * Find or create a project for a session based on metadata
 * Returns project_id or null if not authenticated
 */
async function findOrCreateProject(
  history: ChatHistory,
  accountId: string,
  client: Awaited<ReturnType<typeof createAuthenticatedClient>>['client']
): Promise<string | null> {
  const projectName = history.metadata?.projectName;

  // If no project name in metadata, link to default "Uncategorized" project
  if (!projectName) {
    // Try to find existing default project
    const { data: existingDefault } = await client
      .from('projects')
      .select('id')
      .eq('user_id', accountId)
      .eq('is_default', true)
      .maybeSingle();

    if (existingDefault) {
      return existingDefault.id;
    }

    // Default project doesn't exist, create it
    const { data: newDefault, error: createError } = await client
      .from('projects')
      .insert({
        user_id: accountId,
        name: 'Uncategorized',
        project_path: null,
        description: 'Default project for sessions without project information',
        is_default: true
      })
      .select('id')
      .single();

    if (createError) {
      console.error('Error creating default project:', createError);
      return null;
    }

    console.log('  → Created default "Uncategorized" project');
    return newDefault.id;
  }

  // Find or create project with this name
  const { data: existingProject } = await client
    .from('projects')
    .select('id')
    .eq('user_id', accountId)
    .eq('name', projectName)
    .maybeSingle();

  if (existingProject) {
    return existingProject.id;
  }

  // Project doesn't exist, create it
  const { data: newProject, error: createError } = await client
    .from('projects')
    .insert({
      user_id: accountId,
      name: projectName,
      project_path: history.metadata?.projectPath || null,
      description: `Auto-created from ${history.agent_type} session`,
      is_default: false
    })
    .select('id')
    .single();

  if (createError) {
    console.error(`Error creating project ${projectName}:`, createError);
    return null;
  }

  console.log(`  → Created new project: ${projectName}`);
  return newProject.id;
}

export async function uploadChatHistory(
  history: ChatHistory,
  accountId: string | null,
  accessToken: string | null,
  refreshToken: string | null
): Promise<boolean> {
  if (!accessToken || !refreshToken) {
    console.error('No access token or refresh token provided');
    return false;
  }

  const { client, accountId: authAccountId } = await createAuthenticatedClient(accessToken, refreshToken);

  // Use the authenticated account ID instead of the passed one
  const validAccountId = accountId || authAccountId;

  try {
    // Calculate the latest message timestamp from the messages array
    let latestMessageTimestamp: string | null = null;
    if (history.messages && history.messages.length > 0) {
      // Find the most recent timestamp among all messages
      const timestamps = history.messages
        .map(msg => msg.timestamp)
        .filter((ts): ts is string => !!ts)
        .sort()
        .reverse();

      latestMessageTimestamp = timestamps[0] || null;
    }

    // Find or create project for this session
    const projectId = await findOrCreateProject(history, validAccountId, client);

    // Upsert based on session ID
    // This allows us to update existing records when re-running the uploader
    const { error } = await client
      .from('chat_histories')
      .upsert(
        {
          id: history.id,
          timestamp: history.timestamp,
          messages: history.messages as any,
          metadata: history.metadata as any,
          agent_type: history.agent_type,
          account_id: authAccountId,
          project_id: projectId,
          latest_message_timestamp: latestMessageTimestamp,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'id', // Use id as the unique constraint for upsert
          ignoreDuplicates: false // Always update existing records
        }
      );

    if (error) {
      console.error(`Error uploading chat history ${history.id}:`, error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return false;
    }

    const projectName = history.metadata?.projectName || 'Uncategorized';
    const messageCount = history.messages.length;
    const authStatus = accountId ? '🔐' : '🔓';

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
          timeZoneName: 'short'
        })
      : 'unknown time';

    console.log(`✓ ${authStatus} ${agentLabel} ${projectName} (${messageCount} msgs, latest: ${timeDisplay})`);
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
  accountId: string | null,
  accessToken: string | null,
  refreshToken: string | null
): Promise<string | null> {
  if (!accessToken || !refreshToken) {
    console.log(`Skipping project ${project.name} (not authenticated)`);
    return null;
  }

  const { client, accountId: authAccountId } = await createAuthenticatedClient(accessToken, refreshToken);

  // Use the authenticated account ID instead of the passed one
  const validAccountId = accountId || authAccountId;

  try {
    // Build workspace metadata from project info
    const workspaceMetadata = {
      workspaceIds: project.workspaceIds,
      composerCount: project.composerCount,
      copilotSessionCount: project.copilotSessionCount,
      claudeCodeSessionCount: project.claudeCodeSessionCount,
      lastActivity: project.lastActivity
    };

    const { data, error } = await client
      .from('projects')
      .upsert(
        {
          user_id: validAccountId,
          name: project.name,
          project_path: project.path,
          workspace_metadata: workspaceMetadata,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'user_id,name',
          ignoreDuplicates: false
        }
      )
      .select('id')
      .single();

    if (error) {
      console.error(`[DEBUG] Error upserting project ${project.name}:`, error);
      console.error(`[DEBUG] Error code: ${error.code}, Details: ${error.details}, Hint: ${error.hint}`);
      return null;
    }

    const counts = [];
    if (project.composerCount > 0) counts.push(`Composer: ${project.composerCount}`);
    if (project.copilotSessionCount > 0) counts.push(`Copilot: ${project.copilotSessionCount}`);
    if (project.claudeCodeSessionCount > 0) counts.push(`Claude Code: ${project.claudeCodeSessionCount}`);

    console.log(`✓ Project: ${project.name} (${counts.join(', ')})`);
    return data.id;
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
  accountId: string | null,
  accessToken: string | null,
  refreshToken: string | null
): Promise<Map<string, string>> {
  console.log(`\nSyncing ${projects.length} projects...`);

  const projectIdMap = new Map<string, string>(); // Map project path to project ID

  for (const project of projects) {
    const projectId = await upsertProject(project, accountId, accessToken, refreshToken);
    if (projectId) {
      projectIdMap.set(project.path, projectId);
    }
  }

  console.log(`Project sync complete: ${projectIdMap.size}/${projects.length} synced\n`);
  return projectIdMap;
}

export async function uploadAllHistories(
  histories: ChatHistory[],
  accountId: string | null,
  accessToken: string | null,
  refreshToken: string | null,
  failedSyncsToRetry: FailedSyncData[] = []
): Promise<{ successCount: number; failureCount: number }> {
  const db = getDatabase();

  console.log(`Uploading ${histories.length} chat histories${failedSyncsToRetry.length > 0 ? ` (+ ${failedSyncsToRetry.length} retries)` : ''}...`);

  let successCount = 0;
  let failureCount = 0;

  // Upload new histories
  for (const history of histories) {
    const success = await uploadChatHistory(history, accountId, accessToken, refreshToken);
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

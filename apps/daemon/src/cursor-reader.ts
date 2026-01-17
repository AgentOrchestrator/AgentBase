import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import type {
  ChatHistory,
  SessionMetadata,
  ProjectInfo as SharedProjectInfo,
  LoaderOptions,
  IDatabaseLoader,
} from '@agent-orchestrator/shared';
import {
  IDE_DATA_PATHS,
  normalizeTimestamp,
  extractProjectNameFromPath,
  generateDeterministicUUID,
  getHomeDir,
} from '@agent-orchestrator/shared';
import type { IChatHistoryRepository, IRepositoryFactory } from './interfaces/repositories.js';
import type { ServiceContainer } from './service-container.js';

// Re-export types for backward compatibility
export type { ChatHistory, SessionMetadata } from '@agent-orchestrator/shared';

export interface CursorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  composerId?: string;
  bubbleId?: string;
  sessionId?: string;
  modelName?: string | undefined;
}

export interface CursorConversation {
  id: string; // composerId or sessionId
  timestamp: string;
  messages: CursorMessage[];
  conversationType: 'composer' | 'copilot';
  metadata?: SessionMetadata | undefined;
}

export interface ProjectInfo {
  name: string;
  path: string;
  workspaceIds: string[];
  composerCount: number;
  copilotSessionCount: number;
  lastActivity: string;
}

interface BubbleData {
  _v?: number;
  type?: number;
  bubbleId: string;
  text?: string;
  richText?: string;
  createdAt: string;
  modelInfo?: {
    modelName: string;
  };
  [key: string]: any;
}

interface ComposerData {
  _v?: number;
  composerId: string;
  bubbles?: string[];
  conversation?: BubbleData[];
  fullConversationHeadersOnly?: Array<{
    bubbleId: string;
    type: number;
    serverBubbleId?: string;
  }>;
  createdAt?: string | number;
  lastUpdatedAt?: string | number;
  workspace?: string;
  name?: string;
  context?: {
    fileSelections?: Array<{
      uri?: {
        fsPath?: string;
      };
    }>;
    folderSelections?: Array<{
      uri?: {
        fsPath?: string;
      };
    }>;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Get the path to Cursor's state database
 */
function getCursorStatePath(): string {
  const globalStoragePath = IDE_DATA_PATHS.cursor();
  return path.join(globalStoragePath, 'state.vscdb');
}

// Repository for database lookups
// Initialized with user session when readCursorHistories is called
let chatHistoryRepo: IChatHistoryRepository | null = null;
let authenticatedUserId: string | null = null;

/**
 * Initialize repositories for database lookups using a factory
 * @deprecated Use initializeFromContainer instead
 */
async function initializeRepositoriesFromFactory(
  accessToken: string,
  refreshToken: string,
  repositoryFactory: IRepositoryFactory
): Promise<void> {
  try {
    const repos = await repositoryFactory.createRepositories(accessToken, refreshToken);
    chatHistoryRepo = repos.chatHistories;
    authenticatedUserId = repos.userId;
  } catch (error) {
    console.warn('[Cursor Reader] Could not initialize repositories:', error);
    chatHistoryRepo = null;
    authenticatedUserId = null;
  }
}

/**
 * Initialize repositories from a ServiceContainer
 */
function initializeFromContainer(container: ServiceContainer): void {
  try {
    chatHistoryRepo = container.getRepository('chatHistories');
    authenticatedUserId = container.getUserId();
  } catch (error) {
    console.warn('[Cursor Reader] Could not initialize from container:', error);
    chatHistoryRepo = null;
    authenticatedUserId = null;
  }
}

/**
 * Get the modification time of the state.vscdb file
 * Returns ISO timestamp or current time if file cannot be read
 */
async function getStateDbModificationTime(): Promise<string> {
  const statePath = getCursorStatePath();
  try {
    const stats = await fs.promises.stat(statePath);
    return stats.mtime.toISOString();
  } catch (error) {
    console.warn('[Cursor Reader] Could not read state.vscdb modification time:', error);
    return new Date().toISOString();
  }
}

/**
 * Fetch an existing session from the database by ID
 * Returns null if session not found or database unavailable
 */
async function fetchExistingSession(sessionId: string): Promise<{ id: string; messages: any[]; timestamp: string; latestMessageTimestamp: string | null } | null> {
  if (!chatHistoryRepo || !authenticatedUserId) {
    return null;
  }

  try {
    const record = await chatHistoryRepo.findById(sessionId, authenticatedUserId);
    if (!record) {
      return null;
    }

    return {
      id: record.id,
      messages: record.messages,
      timestamp: record.timestamp,
      latestMessageTimestamp: record.latestMessageTimestamp,
    };
  } catch (error) {
    console.warn(`[Cursor Reader] Error fetching session ${sessionId}:`, error);
    return null;
  }
}

/**
 * Detect if new messages have been added to a conversation
 * Returns information about new messages
 */
function detectNewMessages(
  existingSession: { id: string; messages: any[]; timestamp: string; latestMessageTimestamp: string | null } | null,
  newMessages: CursorMessage[]
): { hasNewMessages: boolean; newMessageStartIndex: number } {
  if (!existingSession || !existingSession.messages) {
    return { hasNewMessages: false, newMessageStartIndex: 0 };
  }

  const existingCount = existingSession.messages.length;
  const newCount = newMessages.length;

  if (newCount > existingCount) {
    return { hasNewMessages: true, newMessageStartIndex: existingCount };
  }

  return { hasNewMessages: false, newMessageStartIndex: 0 };
}

/**
 * Parse rich text format to extract plain text
 */
function parseRichText(richText: string): string {
  try {
    const data = JSON.parse(richText);
    if (data.root?.children) {
      const textParts: string[] = [];

      function extractText(node: any) {
        if (node.text) {
          textParts.push(node.text);
        }
        if (node.children) {
          node.children.forEach(extractText);
        }
      }

      data.root.children.forEach(extractText);
      return textParts.join(' ');
    }
  } catch (e) {
    // If parsing fails, return as-is
  }
  return richText;
}

/**
 * Extract project information from composer data
 * Uses workspace ID to look up the actual workspace folder from workspace storage
 */
function extractProjectInfo(composerData: ComposerData, workspaceMap: Map<string, WorkspaceInfo>): {
  projectName?: string | undefined;
  projectPath?: string | undefined;
  conversationName?: string | undefined;
  workspaceId?: string | undefined;
} {
  const result: {
    projectName?: string | undefined;
    projectPath?: string | undefined;
    conversationName?: string | undefined;
    workspaceId?: string | undefined;
  } = {};

  // Get conversation name if available
  if (composerData.name) {
    result.conversationName = composerData.name;
  }

  // PREFERRED: Look up workspace info from workspace storage using workspace ID
  if (composerData.workspace) {
    const workspaceInfo = workspaceMap.get(composerData.workspace);
    if (workspaceInfo?.folder) {
      result.workspaceId = workspaceInfo.workspaceId;
      result.projectPath = workspaceInfo.folder; // Keep full path from workspace.json
      result.projectName = extractProjectNameFromPath(workspaceInfo.folder);

      if (result.projectName && result.projectPath) {
        return result; // Found reliable workspace info, return early
      }
    }
  }

  // FALLBACK: Try to extract project from file selections in context
  // This is less reliable but better than nothing
  const context = composerData.context;
  if (context?.fileSelections && Array.isArray(context.fileSelections)) {
    for (const selection of context.fileSelections) {
      if (selection.uri?.fsPath) {
        result.projectPath = selection.uri.fsPath;
        result.projectName = extractProjectNameFromPath(selection.uri.fsPath);
        if (result.projectName) {
          break; // Use first valid project found
        }
      }
    }
  }

  // Also check folder selections if no project found yet
  if (!result.projectName && context?.folderSelections && Array.isArray(context.folderSelections)) {
    for (const selection of context.folderSelections) {
      if (selection.uri?.fsPath) {
        result.projectPath = selection.uri.fsPath;
        result.projectName = extractProjectNameFromPath(selection.uri.fsPath);
        if (result.projectName) {
          break;
        }
      }
    }
  }

  return result;
}

/**
 * Get the path to Cursor's workspace storage
 */
function getCursorWorkspaceStoragePath(): string {
  const home = getHomeDir();
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'workspaceStorage');
  } else if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || '', 'Cursor', 'User', 'workspaceStorage');
  }
  return path.join(home, '.config', 'Cursor', 'User', 'workspaceStorage');
}

/**
 * Parse workspace.json to get workspace information
 */
interface WorkspaceInfo {
  workspaceId: string;
  folder?: string | undefined;
  workspace?: any;
}

function getWorkspaceInfo(workspaceDir: string): WorkspaceInfo | null {
  const workspaceJsonPath = path.join(workspaceDir, 'workspace.json');

  if (!fs.existsSync(workspaceJsonPath)) {
    return null;
  }

  try {
    const workspaceJson = JSON.parse(fs.readFileSync(workspaceJsonPath, 'utf-8'));
    const workspaceId = path.basename(workspaceDir);

    // Extract folder path from workspace.json
    let folder: string | undefined;
    if (workspaceJson.folder) {
      // Handle file:// URIs
      const uri = workspaceJson.folder;
      if (typeof uri === 'string') {
        folder = uri.replace('file://', '');
      } else if (uri.path) {
        folder = uri.path;
      }
    }

    return {
      workspaceId,
      folder,
      workspace: workspaceJson
    };
  } catch (e) {
    return null;
  }
}

/**
 * Read Copilot sessions from workspace databases
 */
async function readCopilotSessions(cutoffDate: Date | null = null): Promise<CursorConversation[]> {
  const conversations: CursorConversation[] = [];
  const workspaceStoragePath = getCursorWorkspaceStoragePath();

  if (!fs.existsSync(workspaceStoragePath)) {
    console.log('[Cursor] Workspace storage not found');
    return conversations;
  }

  const workspaceDirs = fs.readdirSync(workspaceStoragePath)
    .map(name => path.join(workspaceStoragePath, name))
    .filter(p => fs.statSync(p).isDirectory());

  console.log(`[Cursor Copilot] Scanning ${workspaceDirs.length} workspace-specific databases...`);

  let totalSessions = 0;
  let copilotHeuristicTimestampsApplied = 0;

  for (const workspaceDir of workspaceDirs) {
    const dbPath = path.join(workspaceDir, 'state.vscdb');

    if (!fs.existsSync(dbPath)) {
      continue;
    }

    const workspaceInfo = getWorkspaceInfo(workspaceDir);
    if (!workspaceInfo) {
      continue;
    }

    try {
      const db = new Database(dbPath, { readonly: true });

      try {
        // Check if ItemTable exists
        const tables = db.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='ItemTable'"
        ).all();

        if (tables.length === 0) {
          db.close();
          continue;
        }

        // Get interactive sessions - stored as an array in 'interactive.sessions' key
        const sessionRow = db.prepare(
          "SELECT value FROM ItemTable WHERE key = 'interactive.sessions'"
        ).get() as { value: string } | undefined;

        if (sessionRow) {
          try {
            const sessionsArray = JSON.parse(sessionRow.value);

            if (!Array.isArray(sessionsArray)) {
              db.close();
              continue;
            }

            for (let sessionIndex = 0; sessionIndex < sessionsArray.length; sessionIndex++) {
              const sessionData = sessionsArray[sessionIndex];
              // Generate a deterministic UUID based on workspace ID and session index
              const sessionId = generateDeterministicUUID(`${workspaceInfo.workspaceId}-session-${sessionIndex}`);

              if (!sessionData.requests || !Array.isArray(sessionData.requests)) {
                continue;
              }

              const messages: CursorMessage[] = [];

              // Use session's creationDate as the base timestamp for all messages
              // Cursor doesn't store per-message timestamps, only session-level
              const sessionTimestamp = normalizeTimestamp(sessionData.creationDate);

              for (const request of sessionData.requests) {
                // User message
                if (request.message?.text) {
                  messages.push({
                    id: `${sessionId}-user-${messages.length}`,
                    role: 'user',
                    content: request.message.text,
                    timestamp: sessionTimestamp,
                    sessionId
                  });
                }

                // Assistant message
                if (request.response && Array.isArray(request.response)) {
                  // Response is an array of response parts
                  const responseText = request.response
                    .map((part: any) => part.value || '')
                    .filter((text: string) => text.trim() !== '')
                    .join('\n');

                  if (responseText) {
                    messages.push({
                      id: `${sessionId}-assistant-${messages.length}`,
                      role: 'assistant',
                      content: responseText,
                      timestamp: sessionTimestamp,
                      sessionId
                    });
                  }
                }
              }

              if (messages.length === 0) {
                continue;
              }

              // Apply heuristic timestamp for new messages (only if authenticated client available)
              if (chatHistoryRepo) {
                try {
                  // Check if this session exists in the database and if new messages were added
                  const existingSession = await fetchExistingSession(sessionId);
                  const { hasNewMessages, newMessageStartIndex } = detectNewMessages(existingSession, messages);

                  if (hasNewMessages || !existingSession) {
                    // Get workspace state.vscdb modification time
                    const workspaceDbStats = await fs.promises.stat(dbPath);
                    const workspaceDbModTime = workspaceDbStats.mtime.toISOString();

                    if (!existingSession) {
                      // First time reading this session - use workspace DB mtime for ALL messages
                      console.log(`[Cursor Reader] 🕐 New session detected - applying heuristic timestamp to all ${messages.length} message(s) in copilot session ${sessionId.substring(0, 8)}...`);
                      console.log(`[Cursor Reader]   Heuristic timestamp: ${workspaceDbModTime}`);

                      for (const message of messages) {
                        if (message) {
                          message.timestamp = workspaceDbModTime;
                        }
                      }
                      copilotHeuristicTimestampsApplied++;
                    } else if (hasNewMessages) {
                      // Session exists - only update new messages
                      const newMessageCount = messages.length - newMessageStartIndex;
                      console.log(`[Cursor Reader] 🕐 Applying heuristic timestamp to ${newMessageCount} new message(s) in copilot session ${sessionId.substring(0, 8)}...`);
                      console.log(`[Cursor Reader]   Existing: ${existingSession?.messages?.length || 0} messages, Current: ${messages.length} messages`);
                      console.log(`[Cursor Reader]   Heuristic timestamp: ${workspaceDbModTime}`);

                      // Apply heuristic timestamp only to new messages
                      for (let i = newMessageStartIndex; i < messages.length; i++) {
                        const message = messages[i];
                        if (message) {
                          message.timestamp = workspaceDbModTime;
                        }
                      }
                      copilotHeuristicTimestampsApplied++;
                    }
                  }
                } catch (error) {
                  // Don't let heuristic timestamp errors stop the whole import
                  console.warn(`[Cursor Reader] Error applying heuristic timestamp to copilot session ${sessionId.substring(0, 8)}:`, error);
                }
              }

              totalSessions++;

              // Extract project info from workspace folder
              const projectPath = workspaceInfo.folder;
              const projectName = workspaceInfo.folder
                ? extractProjectNameFromPath(workspaceInfo.folder)
                : undefined;

              const lastMessage = messages[messages.length - 1];
              if (!lastMessage) {
                continue;
              }

              // Build metadata with only defined values
              const metadata: SessionMetadata = {
                workspaceId: workspaceInfo.workspaceId,
                source: 'cursor-copilot'
              };

              if (workspaceInfo.folder) {
                metadata.workspace = workspaceInfo.folder;
              }

              if (projectName) {
                metadata.projectName = projectName;
              }

              if (projectPath) {
                metadata.projectPath = projectPath;
              }

              // Apply lookback filter if specified
              if (cutoffDate) {
                const convDate = new Date(lastMessage.timestamp);
                if (convDate < cutoffDate) {
                  // Skip conversations outside lookback period
                  continue;
                }
              }

              conversations.push({
                id: sessionId,
                timestamp: lastMessage.timestamp,
                messages,
                conversationType: 'copilot',
                metadata
              });
            }

          } catch (e) {
            // Skip malformed session data
          }
        }

      } finally {
        db.close();
      }

    } catch (error) {
      // Skip databases we can't read
      continue;
    }
  }

  console.log(`[Cursor Copilot] ✓ Found ${totalSessions} copilot sessions`);
  if (copilotHeuristicTimestampsApplied > 0) {
    console.log(`[Cursor Copilot] 🕐 Applied heuristic timestamps to ${copilotHeuristicTimestampsApplied} session(s) with new messages`);
  }

  return conversations;
}

/**
 * Extract project information from all conversations
 * Groups sessions by project path (most unique identifier)
 */
export function extractProjectsFromConversations(
  conversations: CursorConversation[]
): ProjectInfo[] {
  const projectsMap = new Map<string, {
    name: string;
    path: string;
    workspaceIds: Set<string>;
    composerCount: number;
    copilotSessionCount: number;
    lastActivity: Date;
  }>();

  for (const conv of conversations) {
    const projectPath = conv.metadata?.projectPath;
    const projectName = conv.metadata?.projectName;

    if (!projectPath || !projectName) {
      continue;
    }

    if (!projectsMap.has(projectPath)) {
      projectsMap.set(projectPath, {
        name: projectName,
        path: projectPath,
        workspaceIds: new Set(),
        composerCount: 0,
        copilotSessionCount: 0,
        lastActivity: new Date(conv.timestamp)
      });
    }

    const project = projectsMap.get(projectPath)!;

    // Add workspace ID if available
    if (conv.metadata?.workspaceId) {
      project.workspaceIds.add(conv.metadata.workspaceId);
    }

    // Update counts
    if (conv.conversationType === 'composer') {
      project.composerCount++;
    } else if (conv.conversationType === 'copilot') {
      project.copilotSessionCount++;
    }

    // Update last activity
    const convDate = new Date(conv.timestamp);
    if (convDate > project.lastActivity) {
      project.lastActivity = convDate;
    }
  }

  return Array.from(projectsMap.values()).map(project => ({
    name: project.name,
    path: project.path,
    workspaceIds: Array.from(project.workspaceIds),
    composerCount: project.composerCount,
    copilotSessionCount: project.copilotSessionCount,
    lastActivity: project.lastActivity.toISOString()
  }));
}

/**
 * Detect which storage format is being used in the database
 */
function detectStorageFormat(db: Database.Database): 'cursorDiskKV' | 'ItemTable' {
  try {
    // Check if cursorDiskKV has data
    const cursorDiskKVCount = db.prepare(
      "SELECT COUNT(*) as count FROM cursorDiskKV WHERE key LIKE 'composerData:%'"
    ).get() as { count: number };

    if (cursorDiskKVCount.count > 0) {
      console.log('[Cursor] Detected cursorDiskKV format (legacy)');
      return 'cursorDiskKV';
    }

    // Check if ItemTable has composer data
    const itemTableCount = db.prepare(
      "SELECT COUNT(*) as count FROM ItemTable WHERE key = 'composer.composerData'"
    ).get() as { count: number };

    if (itemTableCount.count > 0) {
      console.log('[Cursor] Detected ItemTable format (new)');
      return 'ItemTable';
    }

    // Default to cursorDiskKV for backwards compatibility
    console.log('[Cursor] No data found, defaulting to cursorDiskKV format');
    return 'cursorDiskKV';
  } catch (error) {
    console.log('[Cursor] Error detecting format, defaulting to cursorDiskKV:', error);
    return 'cursorDiskKV';
  }
}

/**
 * Read composers from new ItemTable format
 */
function readComposersFromItemTable(db: Database.Database): Map<string, ComposerData> {
  const composers = new Map<string, ComposerData>();

  try {
    const row = db.prepare(
      "SELECT value FROM ItemTable WHERE key = 'composer.composerData'"
    ).get() as { value: string } | undefined;

    if (!row) {
      console.log('[Cursor] No composer data found in ItemTable');
      return composers;
    }

    const composerData = JSON.parse(row.value) as { allComposers: any[] };

    if (!composerData.allComposers || !Array.isArray(composerData.allComposers)) {
      console.log('[Cursor] Invalid composer data structure in ItemTable');
      return composers;
    }

    // In the new format, we only have metadata, not the full conversation
    // We'll need to mark these as having no messages for now
    for (const composer of composerData.allComposers) {
      if (composer.composerId) {
        composers.set(composer.composerId, {
          composerId: composer.composerId,
          name: composer.name,
          createdAt: composer.createdAt,
          lastUpdatedAt: composer.lastUpdatedAt,
          workspace: composer.workspace,
          // Note: The new format doesn't store full conversation data here
          // Messages would need to be reconstructed from other sources
          conversation: []
        } as ComposerData);
      }
    }

    console.log(`[Cursor] Found ${composers.size} composers in ItemTable format`);
  } catch (error) {
    console.error('[Cursor] Error reading composers from ItemTable:', error);
  }

  return composers;
}

/**
 * Read composers from legacy cursorDiskKV format
 */
function readComposersFromCursorDiskKV(db: Database.Database): Map<string, ComposerData> {
  const composers = new Map<string, ComposerData>();

  const composerRows = db.prepare(
    'SELECT key, value FROM cursorDiskKV WHERE key LIKE ?'
  ).all('composerData:%') as Array<{ key: string; value: string }>;

  for (const row of composerRows) {
    try {
      const composerData = JSON.parse(row.value) as ComposerData;
      const composerId = row.key.replace('composerData:', '');
      composerData.composerId = composerId;
      composers.set(composerId, composerData);
    } catch (e) {
      // Skip malformed composer data
      continue;
    }
  }

  console.log(`[Cursor] Found ${composers.size} composers in cursorDiskKV format`);
  return composers;
}

/**
 * Build a map of all workspace IDs to their workspace info
 */
function buildWorkspaceMap(): Map<string, WorkspaceInfo> {
  const workspaceMap = new Map<string, WorkspaceInfo>();
  const workspaceStoragePath = getCursorWorkspaceStoragePath();

  if (!fs.existsSync(workspaceStoragePath)) {
    return workspaceMap;
  }

  try {
    const workspaceDirs = fs.readdirSync(workspaceStoragePath)
      .map(name => path.join(workspaceStoragePath, name))
      .filter(p => fs.statSync(p).isDirectory());

    for (const workspaceDir of workspaceDirs) {
      const workspaceInfo = getWorkspaceInfo(workspaceDir);
      if (workspaceInfo && workspaceInfo.workspaceId) {
        workspaceMap.set(workspaceInfo.workspaceId, workspaceInfo);
      }
    }

    console.log(`[Cursor] Built workspace map with ${workspaceMap.size} workspaces`);
  } catch (error) {
    console.error('[Cursor] Error building workspace map:', error);
  }

  return workspaceMap;
}

/**
 * Read all Cursor chat histories from the SQLite database
 *
 * @param lookbackDays - Optional number of days to look back for conversations
 * @param accessToken - Optional access token for authenticated database lookups (enables heuristic timestamps)
 * @param refreshToken - Optional refresh token for authenticated database lookups
 * @param sinceTimestamp - Optional timestamp to filter sessions updated after this time (for incremental sync)
 * @param containerOrFactory - Optional ServiceContainer or repository factory for database lookups (enables heuristic timestamps)
 */
export async function readCursorHistories(
  lookbackDays?: number,
  accessToken?: string,
  refreshToken?: string,
  sinceTimestamp?: number,
  containerOrFactory?: ServiceContainer | IRepositoryFactory
): Promise<CursorConversation[]> {
  const conversations: CursorConversation[] = [];

  // Initialize repositories based on what was provided
  if (containerOrFactory) {
    // Check if it's a ServiceContainer (has isInitialized method)
    if ('isInitialized' in containerOrFactory && typeof containerOrFactory.isInitialized === 'function') {
      // It's a ServiceContainer
      const container = containerOrFactory as ServiceContainer;
      if (container.isInitialized()) {
        initializeFromContainer(container);
        console.log('[Cursor Reader] Repositories initialized from ServiceContainer for heuristic timestamps');
      } else {
        console.log('[Cursor Reader] ServiceContainer not initialized - heuristic timestamps disabled');
      }
    } else if (accessToken && refreshToken) {
      // It's a factory, use the old method
      await initializeRepositoriesFromFactory(accessToken, refreshToken, containerOrFactory as IRepositoryFactory);
      console.log('[Cursor Reader] Repositories initialized from factory for heuristic timestamps');
    } else {
      console.log('[Cursor Reader] Factory provided but no tokens - heuristic timestamps disabled');
    }
  } else {
    console.log('[Cursor Reader] No container or factory provided - heuristic timestamps disabled');
  }

  // Calculate cutoff date - use sinceTimestamp if provided, otherwise fall back to lookbackDays
  let cutoffDate: Date | null = null;
  if (sinceTimestamp && sinceTimestamp > 0) {
    cutoffDate = new Date(sinceTimestamp);
    console.log(`[Cursor Reader] Filtering conversations after ${cutoffDate.toISOString()} (incremental sync)`);
  } else if (lookbackDays && lookbackDays > 0) {
    cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
    console.log(`[Cursor Reader] Filtering conversations after ${cutoffDate.toISOString()}`);
  }

  try {
    const dbPath = getCursorStatePath();

    if (!fs.existsSync(dbPath)) {
      console.log(`Cursor state database not found at: ${dbPath}`);
      return conversations;
    }

    console.log('[Cursor] Reading Cursor chat histories...');

    // Build workspace map for reliable project path lookup
    const workspaceMap = buildWorkspaceMap();

    // Open database in read-only mode
    const db = new Database(dbPath, { readonly: true });

    try {
      // Detect which storage format is being used
      const format = detectStorageFormat(db);

      // Read composers based on the detected format
      let composers: Map<string, ComposerData>;
      if (format === 'ItemTable') {
        composers = readComposersFromItemTable(db);
      } else {
        composers = readComposersFromCursorDiskKV(db);
      }

      console.log(`[Cursor] Found ${composers.size} conversations`);

      // Get all bubble messages (only for legacy format)
      const bubblesByComposer = new Map<string, BubbleData[]>();

      if (format === 'cursorDiskKV') {
        const bubbleRows = db.prepare(
          'SELECT key, value FROM cursorDiskKV WHERE key LIKE ?'
        ).all('bubbleId:%') as Array<{ key: string; value: string }>;

        for (const row of bubbleRows) {
          try {
            const bubbleData = JSON.parse(row.value) as BubbleData;
            const keyParts = row.key.split(':');

            if (keyParts.length >= 3) {
              const composerId = keyParts[1];
              const bubbleId = keyParts[2];

              if (!composerId || !bubbleId) continue;

              bubbleData.bubbleId = bubbleId;

              if (!bubblesByComposer.has(composerId)) {
                bubblesByComposer.set(composerId, []);
              }
              bubblesByComposer.get(composerId)!.push(bubbleData);
            }
          } catch (e) {
            // Skip malformed bubble data
            continue;
          }
        }
      }
      // For ItemTable format, bubble data would need to be read from a different location
      // Currently, the new format appears to not store full conversation history in the same way

      // Build conversations
      let conversationsWithNoMessages = 0;
      let conversationsFromConversationArray = 0;
      let conversationsFromBubbleEntries = 0;
      let totalMessagesExtracted = 0;
      let composerHeuristicTimestampsApplied = 0;
      let processedCount = 0;
      let skippedByDate = 0;
      const totalComposers = composers.size;

      console.log(`[Cursor] Processing ${totalComposers} composers...`);

      for (const [composerId, composerData] of composers) {
        processedCount++;

        // Apply lookback filter early to skip old conversations
        if (cutoffDate) {
          const conversationTimestamp = normalizeTimestamp(
            composerData.lastUpdatedAt || composerData.createdAt
          );
          const convDate = new Date(conversationTimestamp);
          if (convDate < cutoffDate) {
            // Skip conversations outside lookback period
            skippedByDate++;
            continue;
          }
        }

        // Log progress every 100 composers
        if (processedCount % 100 === 0) {
          console.log(`[Cursor] Progress: ${processedCount}/${totalComposers} composers processed (filtered by date)...`);
        }
        let bubbles: BubbleData[] = [];

        // First, check if messages are stored in the 'conversation' array
        if (composerData.conversation && Array.isArray(composerData.conversation)) {
          bubbles = composerData.conversation;
          if (bubbles.length > 0) {
            conversationsFromConversationArray++;
          }
        }

        // If no conversation array, try to get bubbles from separate entries
        if (bubbles.length === 0) {
          const separateBubbles = bubblesByComposer.get(composerId) || [];
          if (separateBubbles.length > 0) {
            bubbles = separateBubbles;
            conversationsFromBubbleEntries++;
          }
        }

        if (bubbles.length === 0) {
          conversationsWithNoMessages++;
          continue;
        }

        const messages: CursorMessage[] = [];

        // Use composer-level timestamp since bubble timestamps are often incorrect
        // The createdAt is when the conversation started
        const conversationStartTime = normalizeTimestamp(composerData.createdAt);

        for (const bubble of bubbles) {
          // Determine role based on bubble type
          // type 1 = user message, type 2 = assistant message
          const role = bubble.type === 1 ? 'user' : 'assistant';

          // Extract text content
          let content = bubble.text || '';
          if (!content && bubble.richText) {
            content = parseRichText(bubble.richText);
          }

          // Skip empty messages
          if (!content || content.trim() === '') {
            continue;
          }

          // Use composer's createdAt as the base timestamp for all messages
          // since bubble-level timestamps are often incorrect/placeholder values
          const timestamp = conversationStartTime;

          messages.push({
            id: bubble.bubbleId,
            role,
            content,
            timestamp,
            composerId,
            bubbleId: bubble.bubbleId,
            modelName: bubble.modelInfo?.modelName
          });
        }

        // Apply heuristic timestamp for new messages (only if authenticated client available)
        if (chatHistoryRepo) {
          try {
            // Check if this session exists in the database and if new messages were added
            const existingSession = await fetchExistingSession(composerId);
            const { hasNewMessages, newMessageStartIndex } = detectNewMessages(existingSession, messages);

            if (hasNewMessages || !existingSession) {
              // Get state.vscdb modification time
              const stateDbModTime = await getStateDbModificationTime();

              if (!existingSession) {
                // First time reading this session - use state.vscdb mtime for ALL messages
                // since createdAt is often stale (when conversation was first created, not when messages were added)
                console.log(`[Cursor Reader] 🕐 New session detected - applying heuristic timestamp to all ${messages.length} message(s) in composer ${composerId.substring(0, 8)}...`);
                console.log(`[Cursor Reader]   Heuristic timestamp: ${stateDbModTime}`);

                for (const message of messages) {
                  if (message) {
                    message.timestamp = stateDbModTime;
                  }
                }
                composerHeuristicTimestampsApplied++;
              } else if (hasNewMessages) {
                // Session exists - only update new messages
                const newMessageCount = messages.length - newMessageStartIndex;
                console.log(`[Cursor Reader] 🕐 Applying heuristic timestamp to ${newMessageCount} new message(s) in composer ${composerId.substring(0, 8)}...`);
                console.log(`[Cursor Reader]   Existing: ${existingSession?.messages?.length || 0} messages, Current: ${messages.length} messages`);
                console.log(`[Cursor Reader]   Heuristic timestamp: ${stateDbModTime}`);

                // Apply heuristic timestamp only to new messages
                for (let i = newMessageStartIndex; i < messages.length; i++) {
                  const message = messages[i];
                  if (message) {
                    message.timestamp = stateDbModTime;
                  }
                }
                composerHeuristicTimestampsApplied++;
              }
            }
          } catch (error) {
            // Don't let heuristic timestamp errors stop the whole import
            console.warn(`[Cursor Reader] Error applying heuristic timestamp to composer ${composerId.substring(0, 8)}:`, error);
          }
        }

        if (messages.length === 0) {
          conversationsWithNoMessages++;
          continue;
        }

        totalMessagesExtracted += messages.length;

        // Extract project information using workspace map for reliable project names
        const projectInfo = extractProjectInfo(composerData, workspaceMap);

        // Use lastUpdatedAt for the conversation timestamp (when the last message was added)
        // Fall back to createdAt if lastUpdatedAt is not available
        const conversationTimestamp = normalizeTimestamp(
          composerData.lastUpdatedAt || composerData.createdAt
        );

        // Build metadata with only defined values
        const metadata: SessionMetadata = {
          source: 'cursor-composer'
        };

        if (composerData.workspace) {
          metadata.workspace = composerData.workspace;
        }

        if (projectInfo.workspaceId) {
          metadata.workspaceId = projectInfo.workspaceId;
        }

        if (projectInfo.projectName) {
          metadata.projectName = projectInfo.projectName;
        }

        if (projectInfo.projectPath) {
          metadata.projectPath = projectInfo.projectPath;
        }

        if (projectInfo.conversationName) {
          metadata.conversationName = projectInfo.conversationName;
        }

        // Note: lookback filter already applied at the start of the loop

        conversations.push({
          id: composerId,
          timestamp: conversationTimestamp,
          messages,
          conversationType: 'composer',
          metadata
        });
      }

      console.log(`\n[Cursor Composer] ✓ Parsed ${conversations.length} composer conversations with messages`);
      console.log(`[Cursor Composer] Total messages: ${totalMessagesExtracted}`);
      if (skippedByDate > 0) {
        console.log(`[Cursor Composer] Skipped ${skippedByDate} old conversations (outside ${lookbackDays || 30}-day window)`);
      }
      if (composerHeuristicTimestampsApplied > 0) {
        console.log(`[Cursor Composer] 🕐 Applied heuristic timestamps to ${composerHeuristicTimestampsApplied} conversation(s) with new messages`);
      }

      if (format === 'ItemTable' && conversationsWithNoMessages > 0) {
        console.log(`[Cursor] WARNING: New ItemTable format detected with ${conversationsWithNoMessages} conversations without messages`);
        console.log(`[Cursor] The new format stores conversation metadata separately from messages`);
        console.log(`[Cursor] Full conversation history may not be available in this format yet`);
      }

    } finally {
      db.close();
    }

  } catch (error) {
    console.error('[Cursor] Error reading Cursor histories:', error);
  }

  // Read Copilot sessions from workspace databases (separate from Composer)
  console.log(`\n[Cursor Copilot] Reading Copilot sessions from workspace databases...`);
  try {
    const copilotConversations = await readCopilotSessions(cutoffDate);
    conversations.push(...copilotConversations);
  } catch (error) {
    console.error('[Cursor Copilot] Error reading Copilot sessions:', error);
  }

  const composerCount = conversations.filter(c => c.conversationType === 'composer').length;
  const copilotCount = conversations.filter(c => c.conversationType === 'copilot').length;

  console.log(`\n[Cursor] ✓ Total conversations collected: ${conversations.length}`);
  console.log(`[Cursor]   • Composer: ${composerCount}`);
  console.log(`[Cursor]   • Copilot: ${copilotCount}`);

  return conversations;
}

/**
 * Convert Cursor conversations to the standard ChatHistory format
 */
export function convertCursorToStandardFormat(
  conversations: CursorConversation[]
): ChatHistory[] {
  return conversations.map(conv => ({
    id: conv.id,
    timestamp: conv.timestamp,
    agent_type: 'cursor' as const,
    messages: conv.messages.map(msg => ({
      display: msg.content,
      pastedContents: {},
      role: msg.role,
      timestamp: msg.timestamp
    })),
    metadata: {
      ...conv.metadata,
      source: 'cursor'
    }
  }));
}

/**
 * Cursor Loader - implements IDatabaseLoader interface
 */
export class CursorLoader implements IDatabaseLoader {
  readonly agentType = 'cursor' as const;
  readonly name = 'Cursor';
  readonly databasePath: string;

  private containerOrFactory?: ServiceContainer | IRepositoryFactory | undefined;
  private accessToken?: string | undefined;
  private refreshToken?: string | undefined;

  constructor(options?: {
    serviceContainer?: ServiceContainer;
    repositoryFactory?: IRepositoryFactory;
    accessToken?: string;
    refreshToken?: string;
  }) {
    this.databasePath = getCursorStatePath();
    // Prefer ServiceContainer over factory
    this.containerOrFactory = options?.serviceContainer ?? options?.repositoryFactory;
    this.accessToken = options?.accessToken;
    this.refreshToken = options?.refreshToken;
  }

  async readHistories(options?: LoaderOptions): Promise<ChatHistory[]> {
    const conversations = await readCursorHistories(
      options?.lookbackDays,
      this.accessToken,
      this.refreshToken,
      options?.sinceTimestamp,
      this.containerOrFactory
    );
    return convertCursorToStandardFormat(conversations);
  }

  extractProjects(histories: ChatHistory[]): SharedProjectInfo[] {
    // Convert back to CursorConversation format for project extraction
    const conversations: CursorConversation[] = histories.map(h => ({
      id: h.id,
      timestamp: h.timestamp,
      messages: h.messages
        .filter((m) => m.role !== 'system')
        .map((m, i) => ({
          id: `${h.id}-${i}`,
          role: (m.role || 'user') as 'user' | 'assistant',
          content: m.display,
          timestamp: m.timestamp || h.timestamp
        })),
      conversationType: (h.metadata?.conversationType as 'composer' | 'copilot') || 'composer',
      metadata: h.metadata
    }));
    return extractProjectsFromConversations(conversations);
  }

  isAvailable(): boolean {
    return fs.existsSync(this.databasePath);
  }

  isDatabaseAccessible(): boolean {
    if (!fs.existsSync(this.databasePath)) {
      return false;
    }
    try {
      const db = new Database(this.databasePath, { readonly: true });
      db.close();
      return true;
    } catch {
      return false;
    }
  }
}

export const cursorLoader = new CursorLoader();

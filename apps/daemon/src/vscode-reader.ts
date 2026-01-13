import Database from 'better-sqlite3';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { createHash } from 'crypto';
import type { SessionMetadata } from './types.js';

export interface VSCodeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sessionId?: string;
}

export interface VSCodeConversation {
  id: string;
  timestamp: string;
  messages: VSCodeMessage[];
  conversationType: 'chat' | 'inline';
  metadata?: SessionMetadata;
}

export interface ProjectInfo {
  name: string;
  path: string;
  workspaceIds: string[];
  chatCount: number;
  inlineChatCount: number;
  lastActivity: string;
}

/**
 * Generate a deterministic UUID v4-compatible ID from a string
 */
function generateDeterministicUUID(input: string): string {
  const hash = createHash('md5').update(input).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
}

/**
 * Get the path to VSCode's state database
 */
function getVSCodeStatePath(): string {
  const homeDir = os.homedir();
  return path.join(
    homeDir,
    'Library',
    'Application Support',
    'Code',
    'User',
    'globalStorage',
    'state.vscdb'
  );
}

/**
 * Get the path to VSCode's workspace storage
 */
function getVSCodeWorkspaceStoragePath(): string {
  const homeDir = os.homedir();
  return path.join(
    homeDir,
    'Library',
    'Application Support',
    'Code',
    'User',
    'workspaceStorage'
  );
}

/**
 * Normalize timestamp to ISO 8601 format
 */
function normalizeTimestamp(timestamp: string | number | undefined): string {
  if (!timestamp) {
    return new Date().toISOString();
  }

  if (typeof timestamp === 'string') {
    const numericTimestamp = parseInt(timestamp, 10);
    if (!isNaN(numericTimestamp) && numericTimestamp > 0) {
      timestamp = numericTimestamp;
    } else {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
      return new Date().toISOString();
    }
  }

  if (typeof timestamp === 'number') {
    if (timestamp > 946684800000) {
      return new Date(timestamp).toISOString();
    }
    if (timestamp > 946684800) {
      return new Date(timestamp * 1000).toISOString();
    }
  }

  return new Date().toISOString();
}

/**
 * Extract project name from a folder path
 */
function extractProjectNameFromPath(folderPath: string): string | undefined {
  let cleanPath = folderPath;

  if (cleanPath.startsWith('file://')) {
    cleanPath = cleanPath.replace('file://', '');
  }

  if (cleanPath.startsWith('vscode-remote://')) {
    const match = cleanPath.match(/vscode-remote:\/\/[^/]+(.+)/);
    if (match && match[1]) {
      cleanPath = match[1];
    }
  }

  try {
    cleanPath = decodeURIComponent(cleanPath);
  } catch (e) {
    // Use as-is if decoding fails
  }

  const parts = cleanPath.split('/').filter(p => p.trim() !== '');
  if (parts.length === 0) {
    return undefined;
  }

  const rootIndicators = ['Developer', 'projects', 'workspace', 'repos', 'code', 'work'];

  for (const indicator of rootIndicators) {
    const index = parts.indexOf(indicator);
    if (index >= 0 && index + 1 < parts.length) {
      return parts[index + 1];
    }
  }

  const homeIndex = parts.indexOf('home');
  if (homeIndex >= 0 && homeIndex + 2 < parts.length) {
    return parts[homeIndex + 2];
  }

  const lastPart = parts[parts.length - 1];
  if (!lastPart) {
    return undefined;
  }

  const hasExtension = lastPart.includes('.');

  if (hasExtension && parts.length > 1) {
    return parts[parts.length - 2];
  }

  return lastPart;
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

    let folder: string | undefined;
    if (workspaceJson.folder) {
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
 * Build a map of all workspace IDs to their workspace info
 */
function buildWorkspaceMap(): Map<string, WorkspaceInfo> {
  const workspaceMap = new Map<string, WorkspaceInfo>();
  const workspaceStoragePath = getVSCodeWorkspaceStoragePath();

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

    console.log(`[VSCode] Built workspace map with ${workspaceMap.size} workspaces`);
  } catch (error) {
    console.error('[VSCode] Error building workspace map:', error);
  }

  return workspaceMap;
}

/**
 * Read chat sessions from workspace chatSessions directories
 */
async function readChatSessions(cutoffDate: Date | null = null): Promise<VSCodeConversation[]> {
  const conversations: VSCodeConversation[] = [];
  const workspaceStoragePath = getVSCodeWorkspaceStoragePath();

  if (!fs.existsSync(workspaceStoragePath)) {
    console.log('[VSCode] Workspace storage not found');
    return conversations;
  }

  const workspaceDirs = fs.readdirSync(workspaceStoragePath)
    .map(name => path.join(workspaceStoragePath, name))
    .filter(p => fs.statSync(p).isDirectory());

  console.log(`[VSCode Chat] Scanning ${workspaceDirs.length} workspace directories...`);

  let totalSessions = 0;

  for (const workspaceDir of workspaceDirs) {
    const chatSessionsDir = path.join(workspaceDir, 'chatSessions');

    if (!fs.existsSync(chatSessionsDir)) {
      continue;
    }

    const workspaceInfo = getWorkspaceInfo(workspaceDir);
    if (!workspaceInfo) {
      continue;
    }

    try {
      const sessionFiles = fs.readdirSync(chatSessionsDir)
        .filter(f => f.endsWith('.json'));

      for (const sessionFile of sessionFiles) {
        const sessionPath = path.join(chatSessionsDir, sessionFile);

        try {
          const sessionContent = fs.readFileSync(sessionPath, 'utf-8');
          const sessionData = JSON.parse(sessionContent);

          if (!sessionData.requests || !Array.isArray(sessionData.requests)) {
            continue;
          }

          const messages: VSCodeMessage[] = [];
          const sessionId = sessionData.sessionId || path.basename(sessionFile, '.json');
          const sessionTimestamp = normalizeTimestamp(sessionData.lastMessageDate || sessionData.creationDate);

          for (const request of sessionData.requests) {
            const requestTimestamp = normalizeTimestamp(request.timestamp || sessionTimestamp);

            // User message
            if (request.message?.text) {
              messages.push({
                id: `${sessionId}-user-${messages.length}`,
                role: 'user',
                content: request.message.text,
                timestamp: requestTimestamp,
                sessionId
              });
            }

            // Assistant response
            if (request.response && Array.isArray(request.response)) {
              const responseText = request.response
                .map((part: any) => part.value || '')
                .filter((text: string) => text.trim() !== '')
                .join('\n');

              if (responseText) {
                messages.push({
                  id: `${sessionId}-assistant-${messages.length}`,
                  role: 'assistant',
                  content: responseText,
                  timestamp: requestTimestamp,
                  sessionId
                });
              }
            }
          }

          if (messages.length === 0) {
            continue;
          }

          totalSessions++;

          const projectPath = workspaceInfo.folder;
          const projectName = workspaceInfo.folder
            ? extractProjectNameFromPath(workspaceInfo.folder)
            : undefined;

          const lastMessage = messages[messages.length - 1];
          if (!lastMessage) {
            continue;
          }

          const metadata: SessionMetadata = {
            workspaceId: workspaceInfo.workspaceId,
            source: 'vscode-chat'
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

          if (sessionData.requesterUsername) {
            metadata.conversationName = sessionData.requesterUsername;
          }

          // Apply cutoff date filter
          if (cutoffDate) {
            const convDate = new Date(lastMessage.timestamp);
            if (convDate < cutoffDate) {
              continue;
            }
          }

          conversations.push({
            id: sessionId,
            timestamp: lastMessage.timestamp,
            messages,
            conversationType: 'chat',
            metadata
          });

        } catch (e) {
          // Skip malformed session files
          console.warn(`[VSCode] Failed to parse session file ${sessionFile}:`, e);
          continue;
        }
      }

    } catch (error) {
      // Skip directories we can't read
      continue;
    }
  }

  console.log(`[VSCode Chat] ✓ Found ${totalSessions} chat sessions`);

  return conversations;
}

/**
 * Read inline chat history from global state
 */
async function readInlineChatHistory(cutoffDate: Date | null = null): Promise<VSCodeConversation[]> {
  const conversations: VSCodeConversation[] = [];
  const statePath = getVSCodeStatePath();

  if (!fs.existsSync(statePath)) {
    console.log('[VSCode] State database not found');
    return conversations;
  }

  try {
    const db = new Database(statePath, { readonly: true });

    try {
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='ItemTable'"
      ).all();

      if (tables.length === 0) {
        db.close();
        return conversations;
      }

      const historyRow = db.prepare(
        "SELECT value FROM ItemTable WHERE key = 'inline-chat-history'"
      ).get() as { value: string } | undefined;

      if (historyRow) {
        try {
          const history = JSON.parse(historyRow.value);

          if (Array.isArray(history) && history.length > 0) {
            const sessionId = generateDeterministicUUID('vscode-inline-chat-global');
            const timestamp = new Date().toISOString();

            const messages: VSCodeMessage[] = history.map((item, index) => ({
              id: `${sessionId}-${index}`,
              role: index % 2 === 0 ? 'user' : 'assistant',
              content: typeof item === 'string' ? item : JSON.stringify(item),
              timestamp,
              sessionId
            }));

            if (messages.length > 0) {
              const metadata: SessionMetadata = {
                source: 'vscode-inline-chat'
              };

              conversations.push({
                id: sessionId,
                timestamp,
                messages,
                conversationType: 'inline',
                metadata
              });

              console.log(`[VSCode Inline Chat] ✓ Found ${messages.length} inline chat messages`);
            }
          }
        } catch (e) {
          // Skip malformed data
        }
      }

    } finally {
      db.close();
    }

  } catch (error) {
    console.error('[VSCode] Error reading inline chat history:', error);
  }

  return conversations;
}

/**
 * Read all VSCode chat histories
 *
 * @param lookbackDays - Optional number of days to look back for conversations
 * @param accessToken - Optional access token for authenticated database lookups
 * @param refreshToken - Optional refresh token for authenticated database lookups
 * @param sinceTimestamp - Optional timestamp to filter sessions updated after this time
 */
export async function readVSCodeHistories(
  lookbackDays?: number,
  accessToken?: string,
  refreshToken?: string,
  sinceTimestamp?: number
): Promise<VSCodeConversation[]> {
  const conversations: VSCodeConversation[] = [];

  let cutoffDate: Date | null = null;
  if (sinceTimestamp && sinceTimestamp > 0) {
    cutoffDate = new Date(sinceTimestamp);
    console.log(`[VSCode Reader] Filtering conversations after ${cutoffDate.toISOString()} (incremental sync)`);
  } else if (lookbackDays && lookbackDays > 0) {
    cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
    console.log(`[VSCode Reader] Filtering conversations after ${cutoffDate.toISOString()}`);
  }

  try {
    console.log('[VSCode] Reading VSCode chat histories...');

    // Read chat sessions from workspace databases
    const chatConversations = await readChatSessions(cutoffDate);
    conversations.push(...chatConversations);

    // Read inline chat history from global state
    const inlineChatConversations = await readInlineChatHistory(cutoffDate);
    conversations.push(...inlineChatConversations);

    const chatCount = conversations.filter(c => c.conversationType === 'chat').length;
    const inlineCount = conversations.filter(c => c.conversationType === 'inline').length;

    console.log(`\n[VSCode] ✓ Total conversations collected: ${conversations.length}`);
    console.log(`[VSCode]   • Chat: ${chatCount}`);
    console.log(`[VSCode]   • Inline: ${inlineCount}`);

  } catch (error) {
    console.error('[VSCode] Error reading VSCode histories:', error);
  }

  return conversations;
}

/**
 * Convert VSCode conversations to the standard ChatHistory format
 */
export function convertVSCodeToStandardFormat(
  conversations: VSCodeConversation[]
): Array<{
  id: string;
  timestamp: string;
  messages: Array<{
    display: string;
    pastedContents: Record<string, any>;
    role?: 'user' | 'assistant';
    timestamp?: string;
  }>;
  agent_type: 'vscode';
  metadata?: Record<string, any>;
}> {
  return conversations.map(conv => ({
    id: conv.id,
    timestamp: conv.timestamp,
    agent_type: 'vscode' as const,
    messages: conv.messages.map(msg => ({
      display: msg.content,
      pastedContents: {},
      role: msg.role,
      timestamp: msg.timestamp
    })),
    metadata: {
      ...conv.metadata,
      source: 'vscode',
      conversationType: conv.conversationType
    }
  }));
}

/**
 * Extract project information from all conversations
 */
export function extractProjectsFromConversations(
  conversations: VSCodeConversation[]
): ProjectInfo[] {
  const projectsMap = new Map<string, {
    name: string;
    path: string;
    workspaceIds: Set<string>;
    chatCount: number;
    inlineChatCount: number;
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
        chatCount: 0,
        inlineChatCount: 0,
        lastActivity: new Date(conv.timestamp)
      });
    }

    const project = projectsMap.get(projectPath)!;

    if (conv.metadata?.workspaceId) {
      project.workspaceIds.add(conv.metadata.workspaceId);
    }

    if (conv.conversationType === 'chat') {
      project.chatCount++;
    } else if (conv.conversationType === 'inline') {
      project.inlineChatCount++;
    }

    const convDate = new Date(conv.timestamp);
    if (convDate > project.lastActivity) {
      project.lastActivity = convDate;
    }
  }

  return Array.from(projectsMap.values()).map(project => ({
    name: project.name,
    path: project.path,
    workspaceIds: Array.from(project.workspaceIds),
    chatCount: project.chatCount,
    inlineChatCount: project.inlineChatCount,
    lastActivity: project.lastActivity.toISOString()
  }));
}

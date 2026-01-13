import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import type {
  ChatMessage,
  ChatHistory,
  SessionMetadata,
  ProjectInfo,
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

// Re-export types for backward compatibility
export type { ChatMessage, ChatHistory, SessionMetadata, ProjectInfo } from '@agent-orchestrator/shared';

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
  metadata?: SessionMetadata | undefined;
}

/**
 * Get the path to VSCode's state database
 */
function getVSCodeStatePath(): string {
  const globalStoragePath = IDE_DATA_PATHS.vscode();
  return path.join(globalStoragePath, 'state.vscdb');
}

/**
 * Get the path to VSCode's workspace storage
 */
function getVSCodeWorkspaceStoragePath(): string {
  const home = getHomeDir();
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Code', 'User', 'workspaceStorage');
  } else if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || '', 'Code', 'User', 'workspaceStorage');
  }
  return path.join(home, '.config', 'Code', 'User', 'workspaceStorage');
}

interface WorkspaceInfo {
  workspaceId: string;
  folder?: string | undefined;
  workspace?: unknown;
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
      } else if (uri && typeof uri === 'object' && 'path' in uri) {
        folder = String(uri.path);
      }
    }

    return {
      workspaceId,
      folder,
      workspace: workspaceJson
    };
  } catch {
    return null;
  }
}

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

            if (request.message?.text) {
              messages.push({
                id: `${sessionId}-user-${messages.length}`,
                role: 'user',
                content: request.message.text,
                timestamp: requestTimestamp,
                sessionId
              });
            }

            if (request.response && Array.isArray(request.response)) {
              const responseText = request.response
                .map((part: { value?: string }) => part.value || '')
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

        } catch {
          continue;
        }
      }

    } catch {
      continue;
    }
  }

  console.log(`[VSCode Chat] ✓ Found ${totalSessions} chat sessions`);

  return conversations;
}

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
              role: (index % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
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
        } catch {
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

    const chatConversations = await readChatSessions(cutoffDate);
    conversations.push(...chatConversations);

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
): ChatHistory[] {
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
    vscodeSessionCount: project.chatCount + project.inlineChatCount,
    lastActivity: project.lastActivity.toISOString()
  }));
}

/**
 * VSCode Loader - implements IDatabaseLoader interface
 */
export class VSCodeLoader implements IDatabaseLoader {
  readonly agentType = 'vscode' as const;
  readonly name = 'VSCode';
  readonly databasePath: string;

  constructor() {
    this.databasePath = getVSCodeStatePath();
  }

  async readHistories(options?: LoaderOptions): Promise<ChatHistory[]> {
    const conversations = await readVSCodeHistories(
      options?.lookbackDays,
      undefined,
      undefined,
      options?.sinceTimestamp
    );
    return convertVSCodeToStandardFormat(conversations);
  }

  extractProjects(histories: ChatHistory[]): ProjectInfo[] {
    // Convert back to VSCodeConversation format for project extraction
    const conversations: VSCodeConversation[] = histories.map(h => ({
      id: h.id,
      timestamp: h.timestamp,
      messages: h.messages.map((m, i) => ({
        id: `${h.id}-${i}`,
        role: m.role || 'user',
        content: m.display,
        timestamp: m.timestamp || h.timestamp,
        sessionId: h.id
      })),
      conversationType: (h.metadata?.conversationType as 'chat' | 'inline') || 'chat',
      metadata: h.metadata
    }));
    return extractProjectsFromConversations(conversations);
  }

  isAvailable(): boolean {
    const workspaceStoragePath = getVSCodeWorkspaceStoragePath();
    return fs.existsSync(workspaceStoragePath) || fs.existsSync(this.databasePath);
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

export const vscodeLoader = new VSCodeLoader();

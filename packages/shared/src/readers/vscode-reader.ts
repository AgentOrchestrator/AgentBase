import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import type { IDatabaseLoader } from '../loaders/interfaces.js';
import type { ChatHistory, LoaderOptions, ProjectInfo, SessionMetadata } from '../loaders/types.js';
import {
  extractProjectNameFromPath,
  getHomeDir,
  IDE_DATA_PATHS,
  normalizeTimestamp,
} from '../loaders/utilities.js';

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

interface WorkspaceInfo {
  workspaceId: string;
  folder?: string | undefined;
  workspace?: unknown;
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

/**
 * Parse workspace.json and extract workspace info
 */
export function parseWorkspaceInfo(workspaceDir: string): WorkspaceInfo | null {
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
      if (typeof uri === 'string' && uri.startsWith('file://')) {
        folder = fileURLToPath(uri);
      } else if (typeof uri === 'string') {
        folder = uri;
      } else if (uri && typeof uri === 'object' && 'path' in uri) {
        folder = String(uri.path);
      }
    }

    return {
      workspaceId,
      folder,
      workspace: workspaceJson,
    };
  } catch {
    return null;
  }
}

/**
 * Parse a chat session JSON file
 */
export function parseChatSessionFile(
  sessionPath: string,
  workspaceInfo: WorkspaceInfo | null
): VSCodeConversation | null {
  try {
    const sessionContent = fs.readFileSync(sessionPath, 'utf-8');
    const sessionData = JSON.parse(sessionContent);

    if (!sessionData.requests || !Array.isArray(sessionData.requests)) {
      return null;
    }

    const messages: VSCodeMessage[] = [];
    const sessionId = sessionData.sessionId || path.basename(sessionPath, '.json');
    const sessionTimestamp = normalizeTimestamp(
      sessionData.lastMessageDate || sessionData.creationDate
    );

    for (const request of sessionData.requests) {
      const requestTimestamp = normalizeTimestamp(request.timestamp || sessionTimestamp);

      if (request.message?.text) {
        messages.push({
          id: `${sessionId}-user-${messages.length}`,
          role: 'user',
          content: request.message.text,
          timestamp: requestTimestamp,
          sessionId,
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
            sessionId,
          });
        }
      }
    }

    if (messages.length === 0) {
      return null;
    }

    const projectPath = workspaceInfo?.folder;
    const projectName = workspaceInfo?.folder
      ? extractProjectNameFromPath(workspaceInfo.folder)
      : undefined;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      return null;
    }

    const metadata: SessionMetadata = {
      source: 'vscode-chat',
    };

    if (workspaceInfo?.workspaceId) {
      metadata.workspaceId = workspaceInfo.workspaceId;
    }

    if (workspaceInfo?.folder) {
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

    return {
      id: sessionId,
      timestamp: lastMessage.timestamp,
      messages,
      conversationType: 'chat',
      metadata,
    };
  } catch {
    return null;
  }
}

/**
 * Read chat sessions from workspace storage
 */
async function readChatSessions(
  workspaceStoragePath: string,
  cutoffDate: Date | null = null
): Promise<VSCodeConversation[]> {
  const conversations: VSCodeConversation[] = [];

  if (!fs.existsSync(workspaceStoragePath)) {
    return conversations;
  }

  const workspaceDirs = fs
    .readdirSync(workspaceStoragePath)
    .map((name) => path.join(workspaceStoragePath, name))
    .filter((p) => fs.statSync(p).isDirectory());

  for (const workspaceDir of workspaceDirs) {
    const chatSessionsDir = path.join(workspaceDir, 'chatSessions');

    if (!fs.existsSync(chatSessionsDir)) {
      continue;
    }

    const workspaceInfo = parseWorkspaceInfo(workspaceDir);
    if (!workspaceInfo) {
      continue;
    }

    try {
      const sessionFiles = fs.readdirSync(chatSessionsDir).filter((f) => f.endsWith('.json'));

      for (const sessionFile of sessionFiles) {
        const sessionPath = path.join(chatSessionsDir, sessionFile);
        const conversation = parseChatSessionFile(sessionPath, workspaceInfo);

        if (conversation) {
          if (cutoffDate) {
            const convDate = new Date(conversation.timestamp);
            if (convDate < cutoffDate) {
              continue;
            }
          }
          conversations.push(conversation);
        }
      }
    } catch {
      // Continue to next workspace
    }
  }

  return conversations;
}

/**
 * Read all VSCode chat histories
 * @param workspaceStoragePath - Path to workspace storage (defaults to system default)
 * @param options - Optional filtering options
 */
export async function readVSCodeHistories(
  workspaceStoragePath?: string,
  options?: LoaderOptions
): Promise<VSCodeConversation[]> {
  const conversations: VSCodeConversation[] = [];
  const storagePath = workspaceStoragePath || getVSCodeWorkspaceStoragePath();

  let cutoffDate: Date | null = null;
  if (options?.sinceTimestamp && options.sinceTimestamp > 0) {
    cutoffDate = new Date(options.sinceTimestamp);
  } else if (options?.lookbackDays && options.lookbackDays > 0) {
    cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.lookbackDays);
  }

  try {
    const chatConversations = await readChatSessions(storagePath, cutoffDate);
    conversations.push(...chatConversations);
  } catch {
    // Return empty on error
  }

  return conversations;
}

/**
 * Convert VSCode conversations to the standard ChatHistory format
 */
export function convertToStandardFormat(conversations: VSCodeConversation[]): ChatHistory[] {
  return conversations.map((conv) => ({
    id: conv.id,
    timestamp: conv.timestamp,
    agent_type: 'vscode' as const,
    messages: conv.messages.map((msg) => ({
      display: msg.content,
      pastedContents: {},
      role: msg.role,
      timestamp: msg.timestamp,
    })),
    metadata: {
      ...conv.metadata,
      source: 'vscode',
      conversationType: conv.conversationType,
    },
  }));
}

/**
 * Extract project information from VSCode conversations
 */
export function extractProjectsFromHistories(conversations: VSCodeConversation[]): ProjectInfo[] {
  const projectsMap = new Map<
    string,
    {
      name: string;
      path: string;
      workspaceIds: Set<string>;
      chatCount: number;
      inlineChatCount: number;
      lastActivity: Date;
    }
  >();

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
        lastActivity: new Date(conv.timestamp),
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

  return Array.from(projectsMap.values()).map((project) => ({
    name: project.name,
    path: project.path,
    workspaceIds: Array.from(project.workspaceIds),
    vscodeSessionCount: project.chatCount + project.inlineChatCount,
    lastActivity: project.lastActivity.toISOString(),
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
    const conversations = await readVSCodeHistories(undefined, options);
    return convertToStandardFormat(conversations);
  }

  extractProjects(histories: ChatHistory[]): ProjectInfo[] {
    // Convert back to VSCodeConversation format for project extraction
    const conversations: VSCodeConversation[] = histories.map((h) => ({
      id: h.id,
      timestamp: h.timestamp,
      messages: h.messages
        .filter((m) => m.role !== 'system')
        .map((m, i) => ({
          id: `${h.id}-${i}`,
          role: (m.role || 'user') as 'user' | 'assistant',
          content: m.display,
          timestamp: m.timestamp || h.timestamp,
          sessionId: h.id,
        })),
      conversationType: (h.metadata?.conversationType as 'chat' | 'inline') || 'chat',
      metadata: h.metadata,
    }));
    return extractProjectsFromHistories(conversations);
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

// Default instance for convenience
export const vscodeLoader = new VSCodeLoader();

import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import type { IDatabaseLoader } from '../loaders/interfaces.js';
import type { ChatHistory, LoaderOptions, ProjectInfo, SessionMetadata } from '../loaders/types.js';
import { IDE_DATA_PATHS, normalizeTimestamp } from '../loaders/utilities.js';

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
  id: string;
  timestamp: string;
  messages: CursorMessage[];
  conversationType: 'composer' | 'copilot';
  metadata?: SessionMetadata | undefined;
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
  [key: string]: unknown;
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
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface CopilotData {
  sessionId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
  }>;
  workspace?: string;
  [key: string]: unknown;
}

/**
 * Minimal database interface for dependency injection
 * Allows mocking in tests without requiring native better-sqlite3 module
 */
export interface IDatabase {
  prepare(sql: string): { get(): unknown; all(): unknown[] };
  close(): void;
}

/**
 * Factory function type for creating database instances
 * Enables dependency injection for testability
 */
export type DatabaseOpener = (path: string, options?: { readonly?: boolean }) => IDatabase;

/**
 * Default database opener using better-sqlite3
 */
const defaultDatabaseOpener: DatabaseOpener = (dbPath, options) =>
  new Database(dbPath, options) as unknown as IDatabase;

/**
 * Get the path to Cursor's state database
 */
function getCursorStatePath(): string {
  const globalStoragePath = IDE_DATA_PATHS.cursor();
  return path.join(globalStoragePath, 'state.vscdb');
}

/**
 * Detect the storage format used by Cursor
 * @param dbPath - Path to the database file
 * @param databaseOpener - Optional factory for creating database instances (for testing)
 */
export function detectStorageFormat(
  dbPath: string,
  databaseOpener: DatabaseOpener = defaultDatabaseOpener
): 'cursorDiskKV' | 'ItemTable' | null {
  if (!fs.existsSync(dbPath)) {
    return null;
  }

  try {
    const db = databaseOpener(dbPath, { readonly: true });

    try {
      // Check for cursorDiskKV table
      const cursorDiskKV = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cursorDiskKV'")
        .get();
      if (cursorDiskKV) {
        return 'cursorDiskKV';
      }

      // Check for ItemTable
      const itemTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ItemTable'")
        .get();
      if (itemTable) {
        return 'ItemTable';
      }
    } finally {
      db.close();
    }
  } catch {
    // Return null on error
  }

  return null;
}

/**
 * Parse composer data into a CursorConversation
 */
export function parseComposerData(data: ComposerData): CursorConversation | null {
  if (!data.conversation || data.conversation.length === 0) {
    return null;
  }

  const messages: CursorMessage[] = [];
  let lastTimestamp: string | null = null;

  for (const bubble of data.conversation) {
    const text = bubble.text || bubble.richText;
    if (!text) continue;

    const role: 'user' | 'assistant' = bubble.type === 1 ? 'user' : 'assistant';
    const timestamp = normalizeTimestamp(bubble.createdAt);
    lastTimestamp = timestamp;

    messages.push({
      id: bubble.bubbleId,
      role,
      content: text,
      timestamp,
      composerId: data.composerId,
      bubbleId: bubble.bubbleId,
      modelName: bubble.modelInfo?.modelName,
    });
  }

  if (messages.length === 0) {
    return null;
  }

  const projectPath = data.workspace;
  const projectName = projectPath ? path.basename(projectPath) : undefined;

  const metadata: SessionMetadata = {
    source: 'cursor-composer',
  };

  if (projectPath) {
    metadata.projectPath = projectPath;
  }

  if (projectName) {
    metadata.projectName = projectName;
  }

  if (data.name) {
    metadata.conversationName = data.name;
  }

  const timestamp =
    normalizeTimestamp(data.lastUpdatedAt || data.createdAt) ||
    lastTimestamp ||
    new Date().toISOString();

  return {
    id: data.composerId,
    timestamp,
    messages,
    conversationType: 'composer',
    metadata,
  };
}

/**
 * Parse copilot session data into a CursorConversation
 */
export function parseCopilotData(data: CopilotData): CursorConversation | null {
  if (!data.messages || data.messages.length === 0) {
    return null;
  }

  const messages: CursorMessage[] = data.messages.map((msg, index) => ({
    id: `${data.sessionId}-${index}`,
    role: msg.role,
    content: msg.content,
    timestamp: normalizeTimestamp(msg.timestamp),
    sessionId: data.sessionId,
  }));

  const projectPath = data.workspace;
  const projectName = projectPath ? path.basename(projectPath) : undefined;

  const metadata: SessionMetadata = {
    source: 'cursor-copilot',
  };

  if (projectPath) {
    metadata.projectPath = projectPath;
  }

  if (projectName) {
    metadata.projectName = projectName;
  }

  const lastMessage = messages[messages.length - 1];

  return {
    id: data.sessionId,
    timestamp: lastMessage?.timestamp || new Date().toISOString(),
    messages,
    conversationType: 'copilot',
    metadata,
  };
}

/**
 * Read composer conversations from Cursor database
 */
function readComposerConversations(
  db: IDatabase,
  format: 'cursorDiskKV' | 'ItemTable',
  cutoffDate: Date | null
): CursorConversation[] {
  const conversations: CursorConversation[] = [];
  const tableName = format === 'cursorDiskKV' ? 'cursorDiskKV' : 'ItemTable';

  try {
    // Get all composer data keys
    const rows = db
      .prepare(`SELECT key, value FROM ${tableName} WHERE key LIKE 'composerData:%'`)
      .all() as Array<{ key: string; value: string }>;

    for (const row of rows) {
      try {
        const data: ComposerData = JSON.parse(row.value);
        const conversation = parseComposerData(data);

        if (conversation) {
          if (cutoffDate) {
            const convDate = new Date(conversation.timestamp);
            if (convDate < cutoffDate) {
              continue;
            }
          }
          conversations.push(conversation);
        }
      } catch {
        // Skip malformed data
      }
    }
  } catch {
    // Return empty on error
  }

  return conversations;
}

/**
 * Read all Cursor chat histories from the database
 * @param dbPath - Path to the database file (defaults to system default)
 * @param options - Optional filtering options including databaseOpener for testing
 */
export async function readCursorHistories(
  dbPath?: string,
  options?: LoaderOptions & { databaseOpener?: DatabaseOpener }
): Promise<CursorConversation[]> {
  const conversations: CursorConversation[] = [];
  const resolvedPath = dbPath || getCursorStatePath();
  const databaseOpener = options?.databaseOpener ?? defaultDatabaseOpener;

  const format = detectStorageFormat(resolvedPath, databaseOpener);
  if (!format) {
    return conversations;
  }

  let cutoffDate: Date | null = null;
  if (options?.sinceTimestamp && options.sinceTimestamp > 0) {
    cutoffDate = new Date(options.sinceTimestamp);
  } else if (options?.lookbackDays && options.lookbackDays > 0) {
    cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.lookbackDays);
  }

  try {
    const db = databaseOpener(resolvedPath, { readonly: true });

    try {
      const composerConversations = readComposerConversations(db, format, cutoffDate);
      conversations.push(...composerConversations);
    } finally {
      db.close();
    }
  } catch {
    // Return empty on error
  }

  return conversations;
}

/**
 * Convert Cursor conversations to the standard ChatHistory format
 */
export function convertToStandardFormat(conversations: CursorConversation[]): ChatHistory[] {
  return conversations.map((conv) => ({
    id: conv.id,
    timestamp: conv.timestamp,
    agent_type: 'cursor' as const,
    messages: conv.messages.map((msg) => ({
      display: msg.content,
      pastedContents: {},
      role: msg.role,
      timestamp: msg.timestamp,
    })),
    metadata: {
      ...conv.metadata,
      conversationType: conv.conversationType,
    },
  }));
}

/**
 * Extract project information from Cursor conversations
 */
export function extractProjectsFromHistories(conversations: CursorConversation[]): ProjectInfo[] {
  const projectsMap = new Map<
    string,
    {
      name: string;
      path: string;
      workspaceIds: Set<string>;
      composerCount: number;
      copilotCount: number;
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
        composerCount: 0,
        copilotCount: 0,
        lastActivity: new Date(conv.timestamp),
      });
    }

    const project = projectsMap.get(projectPath)!;

    if (conv.metadata?.workspaceId) {
      project.workspaceIds.add(conv.metadata.workspaceId);
    }

    if (conv.conversationType === 'composer') {
      project.composerCount++;
    } else if (conv.conversationType === 'copilot') {
      project.copilotCount++;
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
    composerCount: project.composerCount,
    copilotSessionCount: project.copilotCount,
    lastActivity: project.lastActivity.toISOString(),
  }));
}

/**
 * Cursor Loader - implements IDatabaseLoader interface
 */
export class CursorLoader implements IDatabaseLoader {
  readonly agentType = 'cursor' as const;
  readonly name = 'Cursor';
  readonly databasePath: string;
  private readonly databaseOpener: DatabaseOpener;

  constructor(databaseOpener: DatabaseOpener = defaultDatabaseOpener) {
    this.databasePath = getCursorStatePath();
    this.databaseOpener = databaseOpener;
  }

  async readHistories(options?: LoaderOptions): Promise<ChatHistory[]> {
    const conversations = await readCursorHistories(undefined, {
      ...options,
      databaseOpener: this.databaseOpener,
    });
    return convertToStandardFormat(conversations);
  }

  extractProjects(histories: ChatHistory[]): ProjectInfo[] {
    // Convert back to CursorConversation format for project extraction
    const conversations: CursorConversation[] = histories.map((h) => ({
      id: h.id,
      timestamp: h.timestamp,
      messages: h.messages
        .filter((m) => m.role !== 'system')
        .map((m, i) => ({
          id: `${h.id}-${i}`,
          role: (m.role || 'user') as 'user' | 'assistant',
          content: m.display,
          timestamp: m.timestamp || h.timestamp,
        })),
      conversationType: (h.metadata?.conversationType as 'composer' | 'copilot') || 'composer',
      metadata: h.metadata,
    }));
    return extractProjectsFromHistories(conversations);
  }

  isAvailable(): boolean {
    return fs.existsSync(this.databasePath);
  }

  isDatabaseAccessible(): boolean {
    if (!fs.existsSync(this.databasePath)) {
      return false;
    }
    try {
      const db = this.databaseOpener(this.databasePath, { readonly: true });
      db.close();
      return true;
    } catch {
      return false;
    }
  }
}

// Default instance for convenience
export const cursorLoader = new CursorLoader();

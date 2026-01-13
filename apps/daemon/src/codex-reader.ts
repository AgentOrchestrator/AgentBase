import * as fs from 'fs';
import * as path from 'path';
import type {
  ChatMessage,
  ChatHistory,
  SessionMetadata,
  ProjectInfo,
  LoaderOptions,
  IChatHistoryLoader,
} from '@agent-orchestrator/shared';
import { IDE_DATA_PATHS } from '@agent-orchestrator/shared';

// Re-export types for backward compatibility
export type { ChatMessage, ChatHistory, SessionMetadata, ProjectInfo } from '@agent-orchestrator/shared';

/**
 * Get the path to Codex's sessions directory
 */
export function getCodexSessionsPath(): string {
  return IDE_DATA_PATHS.codex();
}

interface JsonlLine {
  timestamp?: string;
  type?: string;
  payload?: {
    id?: string;
    timestamp?: string;
    cwd?: string;
    git?: {
      branch?: string;
      commit_hash?: string;
      repository_url?: string;
    };
    type?: string;
    role?: 'user' | 'assistant';
    content?: Array<{
      type: string;
      text?: string;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Extract the actual user request from Codex message content
 */
function extractUserRequest(text: string): string | null {
  if (text.includes('<environment_context>')) {
    return null;
  }

  const requestMarker = '## My request for Codex:';
  const markerIndex = text.indexOf(requestMarker);

  if (markerIndex !== -1) {
    const request = text.substring(markerIndex + requestMarker.length).trim();
    return request || null;
  }

  if (text.includes('## Active file:') || text.includes('## Open tabs:')) {
    return null;
  }

  return text.trim() || null;
}

/**
 * Parse a single .jsonl session file
 */
function parseSessionFile(filePath: string): ChatHistory | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    if (lines.length === 0) return null;

    const messages: ChatMessage[] = [];
    let sessionId: string | null = null;
    let sessionTimestamp: string | null = null;
    let firstTimestamp: string | null = null;
    let lastTimestamp: string | null = null;
    let projectPath: string | null = null;
    let gitMetadata: Record<string, string | undefined> | null = null;

    const seenMessages = new Set<string>();

    for (const line of lines) {
      try {
        const data: JsonlLine = JSON.parse(line);

        if (data.type === 'session_meta' && data.payload) {
          sessionId = data.payload.id || null;
          sessionTimestamp = data.payload.timestamp || null;
          projectPath = data.payload.cwd || null;

          if (data.payload.git) {
            gitMetadata = {
              branch: data.payload.git.branch,
              commitHash: data.payload.git.commit_hash,
              repositoryUrl: data.payload.git.repository_url
            };
          }
        }

        if (data.type === 'response_item' && data.payload?.type === 'message') {
          const timestamp = data.timestamp || new Date().toISOString();
          if (!firstTimestamp) firstTimestamp = timestamp;
          lastTimestamp = timestamp;

          const role = data.payload.role;

          if (role !== 'user' && role !== 'assistant') {
            continue;
          }

          if (Array.isArray(data.payload.content)) {
            for (const contentPart of data.payload.content) {
              if (contentPart.type === 'input_text' && contentPart.text) {
                let messageText: string | null = null;

                if (role === 'user') {
                  messageText = extractUserRequest(contentPart.text);
                } else {
                  messageText = contentPart.text.trim();
                }

                if (messageText) {
                  const contentHash = `${role}:${messageText}`;
                  if (!seenMessages.has(contentHash)) {
                    seenMessages.add(contentHash);

                    messages.push({
                      display: messageText,
                      pastedContents: {},
                      role,
                      timestamp
                    });
                  }
                }
              }
            }
          }
        }
      } catch {
        continue;
      }
    }

    if (messages.length === 0) {
      return null;
    }

    const hasAssistant = messages.some(m => m.role === 'assistant');
    if (!hasAssistant) {
      console.log(`[Codex Reader] User-only session detected: ${path.basename(filePath)} (${messages.length} user messages, no assistant responses)`);
    }

    const finalSessionId = sessionId || path.basename(filePath, '.jsonl');
    const projectName = projectPath ? path.basename(projectPath) : undefined;

    const metadata: SessionMetadata = {
      source: 'codex'
    };

    if (projectPath) {
      metadata.projectPath = projectPath;
    }

    if (projectName) {
      metadata.projectName = projectName;
    }

    if (gitMetadata) {
      metadata.git = gitMetadata;
    }

    if (sessionTimestamp) {
      metadata.sessionCreatedAt = sessionTimestamp;
    }

    return {
      id: finalSessionId,
      timestamp: lastTimestamp || firstTimestamp || new Date().toISOString(),
      messages,
      agent_type: 'codex',
      metadata
    };
  } catch (error) {
    console.error(`[Codex Reader] Error parsing session file ${filePath}:`, error);
    return null;
  }
}

/**
 * Calculate date folders to scan based on lookback period
 */
function calculateDateFoldersToScan(lookbackDays: number): string[] {
  const folders: string[] = [];
  const today = new Date();

  for (let i = 0; i < lookbackDays; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    folders.push(`${year}/${month}/${day}`);
  }

  return folders;
}

/**
 * Read all Codex chat histories from ~/.codex/sessions
 */
export function readCodexHistories(lookbackDays?: number, sinceTimestamp?: number): ChatHistory[] {
  const histories: ChatHistory[] = [];

  try {
    const sessionsDir = getCodexSessionsPath();

    if (!fs.existsSync(sessionsDir)) {
      console.log('[Codex Reader] No ~/.codex/sessions directory found');
      return histories;
    }

    const effectiveLookbackDays = lookbackDays || 7;
    const dateFolders = calculateDateFoldersToScan(effectiveLookbackDays);

    console.log(`[Codex Reader] Scanning ${dateFolders.length} date folders (${effectiveLookbackDays} day lookback)`);

    let cutoffDate: Date | null = null;
    if (sinceTimestamp && sinceTimestamp > 0) {
      cutoffDate = new Date(sinceTimestamp);
      console.log(`[Codex Reader] Filtering files modified after ${cutoffDate.toISOString()} (incremental sync)`);
    }

    let totalFilesScanned = 0;

    for (const dateFolder of dateFolders) {
      const dateFolderPath = path.join(sessionsDir, dateFolder);

      if (!fs.existsSync(dateFolderPath)) {
        continue;
      }

      try {
        const sessionFiles = fs.readdirSync(dateFolderPath).filter(f => f.endsWith('.jsonl'));
        totalFilesScanned += sessionFiles.length;

        for (const sessionFile of sessionFiles) {
          const sessionFilePath = path.join(dateFolderPath, sessionFile);

          if (cutoffDate) {
            const stats = fs.statSync(sessionFilePath);
            if (stats.mtime < cutoffDate) {
              continue;
            }
          }

          const history = parseSessionFile(sessionFilePath);

          if (history && history.messages.length > 0) {
            histories.push(history);
          }
        }
      } catch (error) {
        console.warn(`[Codex Reader] Could not read folder ${dateFolder}:`, error);
        continue;
      }
    }

    console.log(`[Codex Reader] ✓ Scanned ${totalFilesScanned} files, parsed ${histories.length} Codex sessions with messages`);
  } catch (error) {
    console.error('[Codex Reader] Error reading Codex histories:', error);
  }

  return histories;
}

/**
 * Extract project information from Codex chat histories
 */
export function extractProjectsFromCodexHistories(
  histories: ChatHistory[]
): ProjectInfo[] {
  const projectsMap = new Map<string, {
    name: string;
    path: string;
    sessionCount: number;
    lastActivity: Date;
  }>();

  for (const history of histories) {
    const projectPath = history.metadata?.projectPath;

    if (!projectPath) {
      continue;
    }

    const projectName = path.basename(projectPath);

    if (!projectsMap.has(projectPath)) {
      projectsMap.set(projectPath, {
        name: projectName,
        path: projectPath,
        sessionCount: 0,
        lastActivity: new Date(history.timestamp)
      });
    }

    const project = projectsMap.get(projectPath)!;
    project.sessionCount++;

    const historyDate = new Date(history.timestamp);
    if (historyDate > project.lastActivity) {
      project.lastActivity = historyDate;
    }
  }

  return Array.from(projectsMap.values()).map(project => ({
    name: project.name,
    path: project.path,
    workspaceIds: [],
    codexSessionCount: project.sessionCount,
    lastActivity: project.lastActivity.toISOString()
  }));
}

/**
 * Codex Loader - implements IChatHistoryLoader interface
 */
export class CodexLoader implements IChatHistoryLoader {
  readonly agentType = 'codex' as const;
  readonly name = 'Codex';

  readHistories(options?: LoaderOptions): ChatHistory[] {
    return readCodexHistories(options?.lookbackDays, options?.sinceTimestamp);
  }

  extractProjects(histories: ChatHistory[]): ProjectInfo[] {
    return extractProjectsFromCodexHistories(histories);
  }

  isAvailable(): boolean {
    const sessionsDir = IDE_DATA_PATHS.codex();
    return fs.existsSync(sessionsDir);
  }
}

export const codexLoader = new CodexLoader();

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type {
  ChatHistory,
  ChatMessage,
  IChatHistoryLoader,
  LoaderOptions,
  ProjectInfo,
  SessionMetadata,
} from '@agent-orchestrator/shared';
import { IDE_DATA_PATHS } from '@agent-orchestrator/shared';

// Re-export types for backward compatibility
export type {
  ChatHistory,
  ChatMessage,
  ProjectInfo,
  SessionMetadata,
} from '@agent-orchestrator/shared';

interface JsonlLine {
  type?: string;
  message?: {
    role: string;
    content: unknown;
  };
  display?: string;
  pastedContents?: Record<string, unknown>;
  timestamp?: string | number;
  project?: string;
  sessionId?: string;
  cwd?: string;
  summary?: string;
}

export function getClaudeConfigPath(): string {
  const claudeHome = process.env.CLAUDE_CODE_HOME;

  if (claudeHome) {
    return path.join(claudeHome, 'chats');
  }

  const homeDir = os.homedir();
  const claudeJsonPath = path.join(homeDir, '.claude.json');

  if (fs.existsSync(claudeJsonPath)) {
    return path.dirname(claudeJsonPath);
  }

  return homeDir;
}

/**
 * Parse a single .jsonl session file
 */
function parseSessionFile(filePath: string, projectPath: string): ChatHistory | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content
      .trim()
      .split('\n')
      .filter((line) => line.trim());

    if (lines.length === 0) return null;

    const messages: ChatMessage[] = [];
    let sessionId = path.basename(filePath, '.jsonl');
    let firstTimestamp: string | null = null;
    let lastTimestamp: string | null = null;
    let summary: string | null = null;

    for (const line of lines) {
      try {
        const data: JsonlLine = JSON.parse(line);

        if (data.type === 'summary' && data.summary) {
          summary = data.summary;
        }

        if (data.sessionId) {
          sessionId = data.sessionId;
        }

        if (data.type === 'user' && data.message?.content) {
          const timestamp = data.timestamp?.toString() || '';
          if (!firstTimestamp) firstTimestamp = timestamp;
          lastTimestamp = timestamp;

          const contentParts = Array.isArray(data.message.content)
            ? data.message.content
            : [data.message.content];

          for (const part of contentParts) {
            if (typeof part === 'string') {
              messages.push({
                display: part,
                pastedContents: {},
                role: 'user',
                timestamp: timestamp || new Date().toISOString(),
              });
            } else if (
              part &&
              typeof part === 'object' &&
              'type' in part &&
              part.type === 'text' &&
              'text' in part
            ) {
              messages.push({
                display: String(part.text),
                pastedContents: {},
                role: 'user',
                timestamp: timestamp || new Date().toISOString(),
              });
            }
          }
        }

        if (data.type === 'assistant' && data.message?.content) {
          const timestamp = data.timestamp?.toString() || '';
          if (!firstTimestamp) firstTimestamp = timestamp;
          lastTimestamp = timestamp;

          const contentParts = Array.isArray(data.message.content)
            ? data.message.content
            : [data.message.content];

          for (const part of contentParts) {
            if (typeof part === 'string') {
              messages.push({
                display: part,
                pastedContents: {},
                role: 'assistant',
                timestamp: timestamp || new Date().toISOString(),
              });
            } else if (
              part &&
              typeof part === 'object' &&
              'type' in part &&
              part.type === 'text' &&
              'text' in part
            ) {
              messages.push({
                display: String(part.text),
                pastedContents: {},
                role: 'assistant',
                timestamp: timestamp || new Date().toISOString(),
              });
            }
          }
        }
      } catch {}
    }

    const projectName = projectPath ? path.basename(projectPath) : undefined;

    const metadata: SessionMetadata = {
      projectPath,
      source: 'claude_code',
    };

    if (projectName) {
      metadata.projectName = projectName;
    }

    if (summary) {
      metadata.summary = summary;
    }

    return {
      id: sessionId,
      timestamp: lastTimestamp || firstTimestamp || new Date().toISOString(),
      messages,
      agent_type: 'claude_code',
      metadata,
    };
  } catch (error) {
    console.error(`Error parsing session file ${filePath}:`, error);
    return null;
  }
}

/**
 * Read all chat histories from ~/.claude directory
 * @param lookbackDays - Number of days to look back (default: 30)
 * @param sinceTimestamp - Optional timestamp to filter files modified after this time
 */
export function readChatHistories(lookbackDays?: number, sinceTimestamp?: number): ChatHistory[] {
  const histories: ChatHistory[] = [];

  try {
    const projectsDir = IDE_DATA_PATHS.claudeCode();

    if (!fs.existsSync(projectsDir)) {
      console.log('No ~/.claude/projects directory found');
      return histories;
    }

    let cutoffDate: Date | null = null;
    if (sinceTimestamp && sinceTimestamp > 0) {
      cutoffDate = new Date(sinceTimestamp);
      console.log(
        `[Claude Code Reader] Filtering files modified after ${cutoffDate.toISOString()} (incremental sync)`
      );
    } else if (lookbackDays && lookbackDays > 0) {
      cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
      console.log(
        `[Claude Code Reader] Filtering files modified after ${cutoffDate.toISOString()}`
      );
    }

    const projectDirs = fs.readdirSync(projectsDir);

    for (const projectDir of projectDirs) {
      const projectDirPath = path.join(projectsDir, projectDir);

      if (!fs.statSync(projectDirPath).isDirectory()) continue;

      const projectPath = projectDir.replace(/^-/, '/').replace(/-/g, '/');
      const sessionFiles = fs.readdirSync(projectDirPath).filter((f) => f.endsWith('.jsonl'));

      for (const sessionFile of sessionFiles) {
        const sessionFilePath = path.join(projectDirPath, sessionFile);

        if (cutoffDate) {
          const stats = fs.statSync(sessionFilePath);
          if (stats.mtime < cutoffDate) {
            continue;
          }
        }

        const history = parseSessionFile(sessionFilePath, projectPath);

        if (history && history.messages.length > 0) {
          histories.push(history);
        }
      }
    }

    console.log(`Found ${histories.length} chat histories with messages.`);
  } catch (error) {
    console.error('Error reading chat histories:', error);
  }

  return histories;
}

/**
 * Extract project information from Claude Code chat histories
 */
export function extractProjectsFromClaudeCodeHistories(histories: ChatHistory[]): ProjectInfo[] {
  const projectsMap = new Map<
    string,
    {
      name: string;
      path: string;
      sessionCount: number;
      lastActivity: Date;
    }
  >();

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
        lastActivity: new Date(history.timestamp),
      });
    }

    const project = projectsMap.get(projectPath)!;
    project.sessionCount++;

    const historyDate = new Date(history.timestamp);
    if (historyDate > project.lastActivity) {
      project.lastActivity = historyDate;
    }
  }

  return Array.from(projectsMap.values()).map((project) => ({
    name: project.name,
    path: project.path,
    workspaceIds: [],
    claudeCodeSessionCount: project.sessionCount,
    lastActivity: project.lastActivity.toISOString(),
  }));
}

/**
 * Claude Code Loader - implements IChatHistoryLoader interface
 */
export class ClaudeCodeLoader implements IChatHistoryLoader {
  readonly agentType = 'claude_code' as const;
  readonly name = 'Claude Code';

  readHistories(options?: LoaderOptions): ChatHistory[] {
    return readChatHistories(options?.lookbackDays, options?.sinceTimestamp);
  }

  extractProjects(histories: ChatHistory[]): ProjectInfo[] {
    return extractProjectsFromClaudeCodeHistories(histories);
  }

  isAvailable(): boolean {
    const projectsDir = IDE_DATA_PATHS.claudeCode();
    return fs.existsSync(projectsDir);
  }
}

// Default instance for convenience
export const claudeCodeLoader = new ClaudeCodeLoader();

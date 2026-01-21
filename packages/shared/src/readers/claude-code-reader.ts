import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IChatHistoryLoader } from '../loaders/interfaces.js';
import type {
  ChatHistory,
  ChatMessage,
  LoaderOptions,
  ProjectInfo,
  SessionMetadata,
} from '../loaders/types.js';
import { IDE_DATA_PATHS } from '../loaders/utilities.js';

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

/**
 * Parse a single .jsonl session file
 */
export function parseSessionFile(filePath: string, projectPath: string): ChatHistory | null {
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
      } catch {
        // Skip malformed lines
      }
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
  } catch {
    return null;
  }
}

/**
 * Read all chat histories from a Claude Code projects directory
 * @param projectsDir - Path to the projects directory (defaults to ~/.claude/projects)
 * @param options - Optional filtering options
 */
export function readClaudeCodeHistories(
  projectsDir?: string,
  options?: LoaderOptions
): ChatHistory[] {
  const histories: ChatHistory[] = [];
  const dir = projectsDir || IDE_DATA_PATHS.claudeCode();

  try {
    if (!fs.existsSync(dir)) {
      return histories;
    }

    let cutoffDate: Date | null = null;
    if (options?.sinceTimestamp && options.sinceTimestamp > 0) {
      cutoffDate = new Date(options.sinceTimestamp);
    } else if (options?.lookbackDays && options.lookbackDays > 0) {
      cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - options.lookbackDays);
    }

    const projectDirs = fs.readdirSync(dir);

    for (const projectDir of projectDirs) {
      const projectDirPath = path.join(dir, projectDir);

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
  } catch {
    // Return empty array on error
  }

  return histories;
}

/**
 * Extract project information from Claude Code chat histories
 */
export function extractProjectsFromHistories(histories: ChatHistory[]): ProjectInfo[] {
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
    return readClaudeCodeHistories(undefined, options);
  }

  extractProjects(histories: ChatHistory[]): ProjectInfo[] {
    return extractProjectsFromHistories(histories);
  }

  isAvailable(): boolean {
    const projectsDir = IDE_DATA_PATHS.claudeCode();
    return fs.existsSync(projectsDir);
  }
}

// Default instance for convenience
export const claudeCodeLoader = new ClaudeCodeLoader();

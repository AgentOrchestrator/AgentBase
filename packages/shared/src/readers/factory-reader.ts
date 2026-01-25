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
  title?: string;
  message?: {
    role: 'user' | 'assistant';
    content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  };
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Extract project path from system-reminder message content
 */
export function extractProjectPathFromSystemReminder(content: string): string | null {
  const pwdMatch = content.match(/% pwd\n([^\n]+)/);
  if (pwdMatch?.[1]) {
    return pwdMatch[1].trim();
  }
  return null;
}

/**
 * Parse a single .jsonl session file
 */
export function parseSessionFile(filePath: string): ChatHistory | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content
      .trim()
      .split('\n')
      .filter((line) => line.trim());

    if (lines.length === 0) return null;

    const messages: ChatMessage[] = [];
    const sessionId = path.basename(filePath, '.jsonl');
    let firstTimestamp: string | null = null;
    let lastTimestamp: string | null = null;
    let projectPath: string | null = null;
    let sessionTitle: string | null = null;

    for (const line of lines) {
      try {
        const data: JsonlLine = JSON.parse(line);

        if (data.type === 'session_start' && data.title) {
          sessionTitle = data.title;
        }

        if (data.type === 'message' && data.message) {
          const timestamp = data.timestamp || new Date().toISOString();
          if (!firstTimestamp) firstTimestamp = timestamp;
          lastTimestamp = timestamp;

          const role = data.message.role;

          if (role !== 'user' && role !== 'assistant') {
            continue;
          }

          if (Array.isArray(data.message.content)) {
            for (const contentPart of data.message.content) {
              if (role === 'user' && contentPart.type === 'text' && contentPart.text) {
                if (
                  contentPart.text.includes('<system-reminder>') &&
                  contentPart.text.includes('% pwd')
                ) {
                  const extractedPath = extractProjectPathFromSystemReminder(contentPart.text);
                  if (extractedPath && !projectPath) {
                    projectPath = extractedPath;
                  }
                }
              }

              if (contentPart.type === 'text' && contentPart.text) {
                if (role === 'user' && contentPart.text.includes('<system-reminder>')) {
                  continue;
                }

                messages.push({
                  display: contentPart.text,
                  pastedContents: {},
                  role,
                  timestamp,
                });
              }
            }
          }
        }
      } catch {
        // Skip malformed lines
      }
    }

    if (messages.length === 0) {
      return null;
    }

    const projectName = projectPath ? path.basename(projectPath) : undefined;

    const metadata: SessionMetadata = {
      source: 'factory',
    };

    if (projectPath) {
      metadata.projectPath = projectPath;
    }

    if (projectName) {
      metadata.projectName = projectName;
    }

    if (sessionTitle) {
      metadata.conversationName = sessionTitle;
    }

    return {
      id: sessionId,
      timestamp: lastTimestamp || firstTimestamp || new Date().toISOString(),
      messages,
      agent_type: 'factory',
      metadata,
    };
  } catch {
    return null;
  }
}

/**
 * Read all Factory chat histories from a sessions directory
 * @param sessionsDir - Path to the sessions directory (defaults to ~/.factory/sessions)
 * @param options - Optional filtering options
 */
export function readFactoryHistories(sessionsDir?: string, options?: LoaderOptions): ChatHistory[] {
  const histories: ChatHistory[] = [];
  const dir = sessionsDir || IDE_DATA_PATHS.factory();

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

    const sessionFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));

    for (const sessionFile of sessionFiles) {
      const sessionFilePath = path.join(dir, sessionFile);

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
  } catch {
    // Return accumulated results on error
  }

  return histories;
}

/**
 * Extract project information from Factory chat histories
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
    factorySessionCount: project.sessionCount,
    lastActivity: project.lastActivity.toISOString(),
  }));
}

/**
 * Factory Loader - implements IChatHistoryLoader interface
 */
export class FactoryLoader implements IChatHistoryLoader {
  readonly agentType = 'factory' as const;
  readonly name = 'Factory';

  readHistories(options?: LoaderOptions): ChatHistory[] {
    return readFactoryHistories(undefined, options);
  }

  extractProjects(histories: ChatHistory[]): ProjectInfo[] {
    return extractProjectsFromHistories(histories);
  }

  isAvailable(): boolean {
    const sessionsDir = IDE_DATA_PATHS.factory();
    return fs.existsSync(sessionsDir);
  }
}

// Default instance for convenience
export const factoryLoader = new FactoryLoader();

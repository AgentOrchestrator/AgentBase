import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { ChatMessage, ChatHistory, SessionMetadata } from './types.js';

// Re-export types for backward compatibility
export type { ChatMessage, ChatHistory, SessionMetadata } from './types.js';

export interface ProjectInfo {
  name: string;
  path: string;
  sessionCount: number;
  lastActivity: string;
}

/**
 * Get the path to Factory's sessions directory
 */
export function getFactorySessionsPath(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, '.factory', 'sessions');
}

interface JsonlLine {
  type?: string;
  message?: {
    role: 'user' | 'assistant';
    content: Array<{ type: string; text?: string; [key: string]: any }>;
  };
  timestamp?: string;
  [key: string]: any;
}

/**
 * Extract project path from system-reminder message content
 * Looks for the pwd command output in system-reminder blocks
 */
function extractProjectPathFromSystemReminder(content: string): string | null {
  // Look for "% pwd\n/path/to/project" pattern in system-reminder
  const pwdMatch = content.match(/% pwd\n([^\n]+)/);
  if (pwdMatch && pwdMatch[1]) {
    return pwdMatch[1].trim();
  }
  return null;
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
    const sessionId = path.basename(filePath, '.jsonl');
    let firstTimestamp: string | null = null;
    let lastTimestamp: string | null = null;
    let projectPath: string | null = null;
    let sessionTitle: string | null = null;

    for (const line of lines) {
      try {
        const data: JsonlLine = JSON.parse(line);

        // Extract session title from session_start event
        if (data.type === 'session_start' && data.title) {
          sessionTitle = data.title;
        }

        // Extract messages
        if (data.type === 'message' && data.message) {
          const timestamp = data.timestamp || new Date().toISOString();
          if (!firstTimestamp) firstTimestamp = timestamp;
          lastTimestamp = timestamp;

          const role = data.message.role;
          
          // Only process user and assistant messages
          if (role !== 'user' && role !== 'assistant') {
            continue;
          }

          // Extract text content from message
          if (Array.isArray(data.message.content)) {
            for (const contentPart of data.message.content) {
              // Extract project path from system-reminder in user messages
              if (role === 'user' && contentPart.type === 'text' && contentPart.text) {
                if (contentPart.text.includes('<system-reminder>') && contentPart.text.includes('% pwd')) {
                  const extractedPath = extractProjectPathFromSystemReminder(contentPart.text);
                  if (extractedPath && !projectPath) {
                    projectPath = extractedPath;
                  }
                }
              }

              // Only include text content in messages (skip tool uses, tool results, etc.)
              if (contentPart.type === 'text' && contentPart.text) {
                // Skip system-reminder messages from user prompts
                if (role === 'user' && contentPart.text.includes('<system-reminder>')) {
                  continue;
                }

                messages.push({
                  display: contentPart.text,
                  pastedContents: {},
                  role,
                  timestamp
                });
              }
            }
          }
        }
      } catch (lineError) {
        // Skip malformed lines
        console.warn(`[Factory Reader] Skipping malformed line in ${sessionId}:`, lineError);
        continue;
      }
    }

    // Skip sessions with no valid messages
    if (messages.length === 0) {
      return null;
    }

    // Extract project name from path
    const projectName = projectPath ? path.basename(projectPath) : undefined;

    const metadata: SessionMetadata = {
      source: 'factory'
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
      metadata
    };
  } catch (error) {
    console.error(`[Factory Reader] Error parsing session file ${filePath}:`, error);
    return null;
  }
}

/**
 * Read all Factory chat histories from ~/.factory/sessions
 * @param lookbackDays - Number of days to look back (default: 30)
 * @param sinceTimestamp - Optional timestamp to filter files modified after this time (for incremental sync)
 */
export function readFactoryHistories(lookbackDays?: number, sinceTimestamp?: number): ChatHistory[] {
  const histories: ChatHistory[] = [];

  try {
    const sessionsDir = getFactorySessionsPath();

    if (!fs.existsSync(sessionsDir)) {
      console.log('[Factory Reader] No ~/.factory/sessions directory found');
      return histories;
    }

    // Calculate cutoff date - use sinceTimestamp if provided, otherwise fall back to lookbackDays
    let cutoffDate: Date | null = null;
    if (sinceTimestamp && sinceTimestamp > 0) {
      cutoffDate = new Date(sinceTimestamp);
      console.log(`[Factory Reader] Filtering files modified after ${cutoffDate.toISOString()} (incremental sync)`);
    } else if (lookbackDays && lookbackDays > 0) {
      cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
      console.log(`[Factory Reader] Filtering files modified after ${cutoffDate.toISOString()}`);
    }

    // Read all session files
    const sessionFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));

    console.log(`[Factory Reader] Found ${sessionFiles.length} session files`);

    for (const sessionFile of sessionFiles) {
      const sessionFilePath = path.join(sessionsDir, sessionFile);

      // Check file modification time if filtering is enabled
      if (cutoffDate) {
        const stats = fs.statSync(sessionFilePath);
        if (stats.mtime < cutoffDate) {
          // Skip files that haven't been modified within the lookback period
          continue;
        }
      }

      const history = parseSessionFile(sessionFilePath);

      if (history && history.messages.length > 0) {
        histories.push(history);
      }
    }

    console.log(`[Factory Reader] ✓ Parsed ${histories.length} Factory sessions with messages`);
  } catch (error) {
    console.error('[Factory Reader] Error reading Factory histories:', error);
  }

  return histories;
}

/**
 * Extract project information from Factory chat histories
 */
export function extractProjectsFromFactoryHistories(
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

    // Extract project name from path (last directory)
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

    // Update last activity
    const historyDate = new Date(history.timestamp);
    if (historyDate > project.lastActivity) {
      project.lastActivity = historyDate;
    }
  }

  return Array.from(projectsMap.values()).map(project => ({
    name: project.name,
    path: project.path,
    sessionCount: project.sessionCount,
    lastActivity: project.lastActivity.toISOString()
  }));
}

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { ChatMessage, ChatHistory, SessionMetadata } from './types.js';

// Re-export types for backward compatibility
export type { ChatMessage, ChatHistory, SessionMetadata } from './types.js';

export interface ProjectInfo {
  name: string;
  path: string;
  workspaceIds: string[];
  claudeCodeSessionCount: number;
  lastActivity: string;
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

  // Default to ~/.claude.json location
  return homeDir;
}

interface JsonlLine {
  type?: string;
  message?: {
    role: string;
    content: any;
  };
  display?: string;
  pastedContents?: Record<string, any>;
  timestamp?: string | number;
  project?: string;
  sessionId?: string;
  cwd?: string;
  summary?: string;
}

/**
 * Parse a single .jsonl session file
 */
function parseSessionFile(filePath: string, projectPath: string): ChatHistory | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    if (lines.length === 0) return null;

    const messages: ChatMessage[] = [];
    let sessionId = path.basename(filePath, '.jsonl');
    let firstTimestamp: string | null = null;
    let lastTimestamp: string | null = null;
    let summary: string | null = null;

    for (const line of lines) {
      try {
        const data: JsonlLine = JSON.parse(line);

        // Extract summary from first line if available
        if (data.type === 'summary' && data.summary) {
          summary = data.summary;
        }

        // Extract session ID
        if (data.sessionId) {
          sessionId = data.sessionId;
        }

        // Extract user messages
        if (data.type === 'user' && data.message?.content) {
          const timestamp = data.timestamp?.toString() || '';
          if (!firstTimestamp) firstTimestamp = timestamp;
          lastTimestamp = timestamp;

          // Parse content array
          const contentParts = Array.isArray(data.message.content)
            ? data.message.content
            : [data.message.content];

          for (const part of contentParts) {
            if (typeof part === 'string') {
              messages.push({
                display: part,
                pastedContents: {},
                role: 'user',
                timestamp: timestamp || new Date().toISOString()
              });
            } else if (part?.type === 'text' && part.text) {
              messages.push({
                display: part.text,
                pastedContents: {},
                role: 'user',
                timestamp: timestamp || new Date().toISOString()
              });
            }
          }
        }

        // Extract assistant messages
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
                timestamp: timestamp || new Date().toISOString()
              });
            } else if (part?.type === 'text' && part.text) {
              messages.push({
                display: part.text,
                pastedContents: {},
                role: 'assistant',
                timestamp: timestamp || new Date().toISOString()
              });
            }
          }
        }
      } catch (lineError) {
        // Skip malformed lines
        continue;
      }
    }

    // Extract project name from path
    const projectName = projectPath ? path.basename(projectPath) : undefined;

    const metadata: SessionMetadata = {
      projectPath,
      source: 'claude_code'
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
      metadata
    };
  } catch (error) {
    console.error(`Error parsing session file ${filePath}:`, error);
    return null;
  }
}

/**
 * Read all chat histories from ~/.claude directory
 * @param lookbackDays - Number of days to look back (default: 30)
 * @param sinceTimestamp - Optional timestamp to filter files modified after this time (for incremental sync)
 */
export function readChatHistories(lookbackDays?: number, sinceTimestamp?: number): ChatHistory[] {
  const histories: ChatHistory[] = [];

  try {
    const homeDir = os.homedir();
    const claudeDir = path.join(homeDir, '.claude');
    const projectsDir = path.join(claudeDir, 'projects');

    if (!fs.existsSync(projectsDir)) {
      console.log('No ~/.claude/projects directory found');
      return histories;
    }

    // Calculate cutoff date - use sinceTimestamp if provided, otherwise fall back to lookbackDays
    let cutoffDate: Date | null = null;
    if (sinceTimestamp && sinceTimestamp > 0) {
      cutoffDate = new Date(sinceTimestamp);
      console.log(`[Claude Code Reader] Filtering files modified after ${cutoffDate.toISOString()} (incremental sync)`);
    } else if (lookbackDays && lookbackDays > 0) {
      cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
      console.log(`[Claude Code Reader] Filtering files modified after ${cutoffDate.toISOString()}`);
    }

    // Read all project directories
    const projectDirs = fs.readdirSync(projectsDir);

    for (const projectDir of projectDirs) {
      const projectDirPath = path.join(projectsDir, projectDir);

      if (!fs.statSync(projectDirPath).isDirectory()) continue;

      // Convert directory name back to project path
      // e.g., "-Users-duonghaidang-Developer-agent-orchestrator" -> "/Users/duonghaidang/Developer/agent-orchestrator"
      const projectPath = projectDir.replace(/^-/, '/').replace(/-/g, '/');

      // Read all session files in this project
      const sessionFiles = fs.readdirSync(projectDirPath).filter(f => f.endsWith('.jsonl'));

      for (const sessionFile of sessionFiles) {
        const sessionFilePath = path.join(projectDirPath, sessionFile);

        // Check file modification time if filtering is enabled
        if (cutoffDate) {
          const stats = fs.statSync(sessionFilePath);
          if (stats.mtime < cutoffDate) {
            // Skip files that haven't been modified within the lookback period
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
export function extractProjectsFromClaudeCodeHistories(
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
    workspaceIds: [], // Claude Code doesn't have workspace IDs
    claudeCodeSessionCount: project.sessionCount,
    lastActivity: project.lastActivity.toISOString()
  }));
}

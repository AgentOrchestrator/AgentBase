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
 * Get the path to Codex's sessions directory
 */
export function getCodexSessionsPath(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, '.codex', 'sessions');
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
      [key: string]: any;
    }>;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Extract the actual user request from Codex message content
 * Filters out IDE context and embedded history, keeping only the new request
 */
function extractUserRequest(text: string): string | null {
  // Skip environment_context blocks entirely
  if (text.includes('<environment_context>')) {
    return null;
  }

  // Look for "## My request for Codex:" marker
  const requestMarker = '## My request for Codex:';
  const markerIndex = text.indexOf(requestMarker);
  
  if (markerIndex !== -1) {
    // Extract everything after the marker
    const request = text.substring(markerIndex + requestMarker.length).trim();
    return request || null;
  }

  // If no marker found, check if it's pure IDE context (has "Active file:" or "Open tabs:")
  if (text.includes('## Active file:') || text.includes('## Open tabs:')) {
    // This is likely IDE context without an actual request, skip it
    return null;
  }

  // Otherwise, use the full text (might be a direct message without IDE context)
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
    let gitMetadata: any = null;

    // Track message content to avoid duplicates
    const seenMessages = new Set<string>();

    for (const line of lines) {
      try {
        const data: JsonlLine = JSON.parse(line);

        // Extract session metadata
        if (data.type === 'session_meta' && data.payload) {
          sessionId = data.payload.id || null;
          sessionTimestamp = data.payload.timestamp || null;
          projectPath = data.payload.cwd || null;
          
          // Extract git metadata if available
          if (data.payload.git) {
            gitMetadata = {
              branch: data.payload.git.branch,
              commitHash: data.payload.git.commit_hash,
              repositoryUrl: data.payload.git.repository_url
            };
          }
        }

        // Extract messages from response_item events
        if (data.type === 'response_item' && data.payload?.type === 'message') {
          const timestamp = data.timestamp || new Date().toISOString();
          if (!firstTimestamp) firstTimestamp = timestamp;
          lastTimestamp = timestamp;

          const role = data.payload.role;

          // Only process user and assistant messages
          if (role !== 'user' && role !== 'assistant') {
            continue;
          }

          // Extract content
          if (Array.isArray(data.payload.content)) {
            for (const contentPart of data.payload.content) {
              if (contentPart.type === 'input_text' && contentPart.text) {
                let messageText: string | null = null;

                if (role === 'user') {
                  // For user messages, extract only the actual request
                  messageText = extractUserRequest(contentPart.text);
                } else {
                  // For assistant messages, use content directly
                  messageText = contentPart.text.trim();
                }

                if (messageText) {
                  // Check for duplicate content
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
      } catch (lineError) {
        // Skip malformed lines
        console.warn(`[Codex Reader] Skipping malformed line in file ${path.basename(filePath)}:`, lineError);
        continue;
      }
    }

    // TEMPORARILY ALLOW USER-ONLY SESSIONS FOR TESTING
    // TODO: Revert this - normally we want to skip sessions with no assistant responses
    if (messages.length === 0) {
      return null;
    }
    
    // Log if we have a user-only session (for debugging)
    const hasAssistant = messages.some(m => m.role === 'assistant');
    if (!hasAssistant) {
      console.log(`[Codex Reader] User-only session detected: ${path.basename(filePath)} (${messages.length} user messages, no assistant responses)`);
    }

    // Use session ID from metadata, or fallback to filename
    const finalSessionId = sessionId || path.basename(filePath, '.jsonl');

    // Extract project name from path
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
 * Returns array of date paths like ['2025/10/27', '2025/10/26', ...]
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
 * @param lookbackDays - Number of days to look back (default: 7)
 * @param sinceTimestamp - Optional timestamp to filter files modified after this time (for incremental sync)
 */
export function readCodexHistories(lookbackDays?: number, sinceTimestamp?: number): ChatHistory[] {
  const histories: ChatHistory[] = [];

  try {
    const sessionsDir = getCodexSessionsPath();

    if (!fs.existsSync(sessionsDir)) {
      console.log('[Codex Reader] No ~/.codex/sessions directory found');
      return histories;
    }

    // Use 7 days as default lookback
    const effectiveLookbackDays = lookbackDays || 7;

    // Calculate date folders to scan
    const dateFolders = calculateDateFoldersToScan(effectiveLookbackDays);

    console.log(`[Codex Reader] Scanning ${dateFolders.length} date folders (${effectiveLookbackDays} day lookback)`);

    // Calculate cutoff date for incremental sync
    let cutoffDate: Date | null = null;
    if (sinceTimestamp && sinceTimestamp > 0) {
      cutoffDate = new Date(sinceTimestamp);
      console.log(`[Codex Reader] Filtering files modified after ${cutoffDate.toISOString()} (incremental sync)`);
    }

    let totalFilesScanned = 0;

    // Scan each date folder
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

          // Check file modification time if filtering is enabled
          if (cutoffDate) {
            const stats = fs.statSync(sessionFilePath);
            if (stats.mtime < cutoffDate) {
              // Skip files that haven't been modified within the incremental sync period
              continue;
            }
          }

          const history = parseSessionFile(sessionFilePath);

          if (history && history.messages.length > 0) {
            histories.push(history);
          }
        }
      } catch (error) {
        // Skip folders we can't read
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

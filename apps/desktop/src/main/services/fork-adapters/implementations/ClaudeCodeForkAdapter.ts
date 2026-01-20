import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { JsonlFilterOptions } from '@agent-orchestrator/shared';
import { JSONLFile } from '@agent-orchestrator/shared';
import type { AgentError, Result } from '../../coding-agent/types';
import { AgentErrorCode, agentError, err, ok } from '../../coding-agent/types';
import { filterJsonl } from '../filter';
import type { IForkAdapter } from '../interfaces/IForkAdapter';

/**
 * Structure of a session entry in sessions-index.json
 */
interface SessionIndexEntry {
  sessionId: string;
  fullPath: string;
  fileMtime: number;
  firstPrompt: string;
  messageCount: number;
  created: string;
  modified: string;
  gitBranch?: string;
  projectPath: string;
  isSidechain: boolean;
}

/**
 * Structure of sessions-index.json
 */
interface SessionsIndex {
  version: number;
  entries: SessionIndexEntry[];
}

/**
 * Fork adapter for Claude Code sessions
 *
 * Handles copying .jsonl session files from ~/.claude/projects and
 * transforming any file paths from the source worktree to the target worktree.
 */
export class ClaudeCodeForkAdapter implements IForkAdapter {
  /**
   * Get the Claude Code projects directory path
   */
  private getProjectsDir(): string {
    const claudeHome = process.env.CLAUDE_CODE_HOME;
    if (claudeHome) {
      return path.join(claudeHome, 'projects');
    }
    return path.join(os.homedir(), '.claude', 'projects');
  }

  /**
   * Find the session file for a given session ID
   */
  private findSessionFile(sessionId: string): string | null {
    const projectsDir = this.getProjectsDir();

    if (!fs.existsSync(projectsDir)) {
      return null;
    }

    const projectDirs = fs.readdirSync(projectsDir);

    for (const projectDir of projectDirs) {
      const projectDirPath = path.join(projectsDir, projectDir);
      if (!fs.statSync(projectDirPath).isDirectory()) continue;

      const sessionFilePath = path.join(projectDirPath, `${sessionId}.jsonl`);
      if (fs.existsSync(sessionFilePath)) {
        return sessionFilePath;
      }
    }

    return null;
  }

  /**
   * Resolve real path (handles symlinks like /tmp -> /private/tmp on macOS)
   */
  private resolveRealPath(inputPath: string): string {
    try {
      // Create directory if it doesn't exist so we can resolve the path
      if (!fs.existsSync(inputPath)) {
        fs.mkdirSync(inputPath, { recursive: true });
      }
      return fs.realpathSync(inputPath);
    } catch {
      // If resolution fails, return the original path
      return inputPath;
    }
  }

  /**
   * Get or create the target project directory for the target working directory
   */
  private getTargetProjectDir(targetWorkingDir: string): string {
    const projectsDir = this.getProjectsDir();

    // Create projects dir if it doesn't exist
    if (!fs.existsSync(projectsDir)) {
      fs.mkdirSync(projectsDir, { recursive: true });
    }

    // Resolve real path to handle symlinks (e.g., /tmp -> /private/tmp on macOS)
    const resolvedPath = this.resolveRealPath(targetWorkingDir);

    // Convert path to directory name format used by Claude Code
    // e.g., /Users/foo/project -> -Users-foo-project
    // Also replace spaces with hyphens (e.g., "Application Support" -> "Application-Support")
    const projectDirName = resolvedPath.replace(/\//g, '-').replace(/ /g, '-');

    const targetProjectDir = path.join(projectsDir, projectDirName);

    // Create target project directory if it doesn't exist
    if (!fs.existsSync(targetProjectDir)) {
      fs.mkdirSync(targetProjectDir, { recursive: true });
    }

    return targetProjectDir;
  }

  supportsAgentType(agentType: string): boolean {
    return agentType === 'claude_code';
  }

  /**
   * Extract the cwd (working directory) from JSONL content
   * This is the actual workspace path where the session was created
   */
  private extractCwdFromContent(content: string): string | null {
    const lines = content.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.cwd && typeof obj.cwd === 'string') {
          return obj.cwd;
        }
      } catch {
        // Skip unparseable lines
      }
    }
    return null;
  }

  /**
   * Extract the first user prompt from JSONL content for the session index
   */
  private extractFirstPrompt(content: string): string {
    const lines = content.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'user' && obj.message?.content) {
          const contentBlocks = obj.message.content;
          for (const block of contentBlocks) {
            if (block.type === 'text' && block.text) {
              // Truncate to reasonable length for index
              return block.text.slice(0, 200) + (block.text.length > 200 ? '…' : '');
            }
          }
        }
      } catch {
        // Skip unparseable lines
      }
    }
    return '';
  }

  /**
   * Count messages in JSONL content
   */
  private countMessages(content: string): number {
    let count = 0;
    const lines = content.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'user' || obj.type === 'assistant') {
          count++;
        }
      } catch {
        // Skip unparseable lines
      }
    }
    return count;
  }

  /**
   * Get current git branch for the target directory
   */
  private getGitBranch(targetDir: string): string | undefined {
    try {
      const { execFileSync } = require('node:child_process');
      const branch = execFileSync('git', ['branch', '--show-current'], {
        cwd: targetDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      return branch || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Update or create sessions-index.json to register the forked session
   */
  private updateSessionsIndex(
    targetProjectDir: string,
    targetSessionId: string,
    targetFilePath: string,
    targetWorkingDir: string,
    content: string
  ): void {
    const indexPath = path.join(targetProjectDir, 'sessions-index.json');

    // Read existing index or create new one
    let index: SessionsIndex = { version: 1, entries: [] };
    if (fs.existsSync(indexPath)) {
      try {
        const existing = fs.readFileSync(indexPath, 'utf-8');
        index = JSON.parse(existing) as SessionsIndex;
      } catch {
        // If parsing fails, start with empty index
        console.warn('[ClaudeCodeForkAdapter] Failed to parse existing sessions-index.json, creating new one');
      }
    }

    // Remove any existing entry with same session ID
    index.entries = index.entries.filter((e) => e.sessionId !== targetSessionId);

    // Get file stats for mtime
    const stats = fs.statSync(targetFilePath);
    const now = new Date().toISOString();

    // Create new entry
    const newEntry: SessionIndexEntry = {
      sessionId: targetSessionId,
      fullPath: targetFilePath,
      fileMtime: stats.mtimeMs,
      firstPrompt: this.extractFirstPrompt(content),
      messageCount: this.countMessages(content),
      created: now,
      modified: now,
      gitBranch: this.getGitBranch(targetWorkingDir),
      projectPath: targetWorkingDir,
      isSidechain: false,
    };

    index.entries.push(newEntry);

    // Write updated index
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');

    console.log('[ClaudeCodeForkAdapter] Updated sessions-index.json:', {
      indexPath,
      sessionId: targetSessionId,
      messageCount: newEntry.messageCount,
    });
  }

  async forkSessionFile(
    sourceSessionId: string,
    targetSessionId: string,
    sourceWorkingDir: string,
    targetWorkingDir: string,
    filterOptions?: JsonlFilterOptions
  ): Promise<Result<void, AgentError>> {
    try {
      // Find source session file
      const sourceFilePath = this.findSessionFile(sourceSessionId);
      if (!sourceFilePath) {
        return err(
          agentError(
            AgentErrorCode.SESSION_NOT_FOUND,
            `Source session file not found for session ID: ${sourceSessionId}`
          )
        );
      }

      // Resolve real paths to handle symlinks (e.g., /tmp -> /private/tmp on macOS)
      const resolvedTargetDir = this.resolveRealPath(targetWorkingDir);

      // Get target project directory (uses resolved path)
      const targetProjectDir = this.getTargetProjectDir(targetWorkingDir);

      // IMPORTANT: Use the SAME session ID for the filename - this allows Claude Code
      // to find and load the session context when resuming
      const targetFilePath = path.join(targetProjectDir, `${targetSessionId}.jsonl`);

      // Read source file
      const sourceContent = fs.readFileSync(sourceFilePath, 'utf-8');

      // Extract the actual source cwd from the JSONL content
      // This is more reliable than the passed sourceWorkingDir which may be incorrect
      const actualSourceCwd = this.extractCwdFromContent(sourceContent) ?? sourceWorkingDir;

      console.log('[ClaudeCodeForkAdapter] Read source session file:', {
        sourceFilePath,
        sourceSessionId,
        targetSessionId,
        actualSourceCwd,
        passedSourceCwd: sourceWorkingDir,
        filterOptions,
      });

      // Apply filtering if options provided (filter by messageId or timestamp)
      let contentToTransform = sourceContent;
      if (filterOptions) {
        const filterResult = filterJsonl(sourceContent, filterOptions);
        contentToTransform = filterResult.content;

        console.log('[ClaudeCodeForkAdapter] Filtered session content:', {
          includedCount: filterResult.includedCount,
          filteredCount: filterResult.filteredCount,
          targetFound: filterResult.targetFound,
        });
      }

      // Use JSONLFile to transform paths and optionally replace sessionId
      const jsonlFile = new JSONLFile(contentToTransform);
      const needsSessionIdReplacement = sourceSessionId !== targetSessionId;
      const transformed = jsonlFile.replaceFields({
        cwd: { from: actualSourceCwd, to: resolvedTargetDir },
        sessionId: needsSessionIdReplacement ? targetSessionId : undefined,
      });
      const transformedContent = transformed.toString();

      // Write to target file
      fs.writeFileSync(targetFilePath, transformedContent, 'utf-8');

      // Update sessions-index.json to register the forked session
      // This allows Claude Code to discover and resume the session
      this.updateSessionsIndex(
        targetProjectDir,
        targetSessionId,
        targetFilePath,
        resolvedTargetDir,
        transformedContent
      );

      console.log('[ClaudeCodeForkAdapter] Session file forked:', {
        source: sourceFilePath,
        target: targetFilePath,
        sourceSessionId,
        targetSessionId,
        filtered: !!filterOptions,
      });

      return ok(undefined);
    } catch (error) {
      return err(
        agentError(
          AgentErrorCode.UNKNOWN_ERROR,
          `Failed to fork session file: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }
}

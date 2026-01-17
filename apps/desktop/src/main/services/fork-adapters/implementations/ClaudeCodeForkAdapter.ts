import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { IForkAdapter } from '../interfaces/IForkAdapter';
import type { Result, AgentError } from '../../coding-agent/types';
import { ok, err, agentError, AgentErrorCode } from '../../coding-agent/types';
import type { JsonlFilterOptions } from '@agent-orchestrator/shared';
import { JSONLFile } from '@agent-orchestrator/shared';
import { filterJsonl } from '../filter';

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


      console.log('[ClaudeCodeForkAdapter] Read source session file:', {
        sourceFilePath,
        sourceSessionId,
        targetSessionId,
        filterOptions
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
        cwd: { from: sourceWorkingDir, to: resolvedTargetDir },
        sessionId: needsSessionIdReplacement ? targetSessionId : undefined,
      });

      // Write to target file
      fs.writeFileSync(targetFilePath, transformed.toString(), 'utf-8');

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

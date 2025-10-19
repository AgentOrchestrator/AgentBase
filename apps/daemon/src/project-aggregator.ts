import type { ProjectInfo as CursorProjectInfo } from './cursor-reader.js';
import type { ProjectInfo as ClaudeCodeProjectInfo } from './claude-code-reader.js';

/**
 * Unified project information combining data from all sources
 */
export interface UnifiedProjectInfo {
  name: string;
  path: string;
  workspaceIds: string[];
  composerCount: number;
  copilotSessionCount: number;
  claudeCodeSessionCount: number;
  lastActivity: string;
}

/**
 * Merge projects from Cursor and Claude Code into a unified list
 * Projects with the same path are merged together
 */
export function mergeProjects(
  cursorProjects: CursorProjectInfo[],
  claudeCodeProjects: ClaudeCodeProjectInfo[]
): UnifiedProjectInfo[] {
  const projectsMap = new Map<string, UnifiedProjectInfo>();

  // Add Cursor projects
  for (const project of cursorProjects) {
    projectsMap.set(project.path, {
      name: project.name,
      path: project.path,
      workspaceIds: project.workspaceIds,
      composerCount: project.composerCount,
      copilotSessionCount: project.copilotSessionCount,
      claudeCodeSessionCount: 0,
      lastActivity: project.lastActivity
    });
  }

  // Merge or add Claude Code projects
  for (const project of claudeCodeProjects) {
    const existing = projectsMap.get(project.path);

    if (existing) {
      // Merge with existing project
      existing.claudeCodeSessionCount = project.claudeCodeSessionCount;

      // Update last activity if Claude Code activity is more recent
      if (project.lastActivity > existing.lastActivity) {
        existing.lastActivity = project.lastActivity;
      }
    } else {
      // Add new project from Claude Code
      projectsMap.set(project.path, {
        name: project.name,
        path: project.path,
        workspaceIds: [],
        composerCount: 0,
        copilotSessionCount: 0,
        claudeCodeSessionCount: project.claudeCodeSessionCount,
        lastActivity: project.lastActivity
      });
    }
  }

  return Array.from(projectsMap.values());
}

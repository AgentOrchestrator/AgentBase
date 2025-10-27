import type { ProjectInfo as CursorProjectInfo } from './cursor-reader.js';
import type { ProjectInfo as ClaudeCodeProjectInfo } from './claude-code-reader.js';
import type { ProjectInfo as VSCodeProjectInfo } from './vscode-reader.js';
import type { ProjectInfo as FactoryProjectInfo } from './factory-reader.js';
import type { ProjectInfo as CodexProjectInfo } from './codex-reader.js';

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
  vscodeChatCount: number;
  vscodeInlineChatCount: number;
  factorySessionCount: number;
  codexSessionCount: number;
  lastActivity: string;
}

/**
 * Merge projects from Cursor, Claude Code, VSCode, Factory, and Codex into a unified list
 * Projects with the same path are merged together
 */
export function mergeProjects(
  cursorProjects: CursorProjectInfo[],
  claudeCodeProjects: ClaudeCodeProjectInfo[],
  vscodeProjects: VSCodeProjectInfo[] = [],
  factoryProjects: FactoryProjectInfo[] = [],
  codexProjects: CodexProjectInfo[] = []
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
      vscodeChatCount: 0,
      vscodeInlineChatCount: 0,
      factorySessionCount: 0,
      codexSessionCount: 0,
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
        vscodeChatCount: 0,
        vscodeInlineChatCount: 0,
        factorySessionCount: 0,
        codexSessionCount: 0,
        lastActivity: project.lastActivity
      });
    }
  }

  // Merge or add VSCode projects
  for (const project of vscodeProjects) {
    const existing = projectsMap.get(project.path);

    if (existing) {
      // Merge with existing project
      existing.vscodeChatCount = project.chatCount;
      existing.vscodeInlineChatCount = project.inlineChatCount;

      // Merge workspace IDs
      for (const workspaceId of project.workspaceIds) {
        if (!existing.workspaceIds.includes(workspaceId)) {
          existing.workspaceIds.push(workspaceId);
        }
      }

      // Update last activity if VSCode activity is more recent
      if (project.lastActivity > existing.lastActivity) {
        existing.lastActivity = project.lastActivity;
      }
    } else {
      // Add new project from VSCode
      projectsMap.set(project.path, {
        name: project.name,
        path: project.path,
        workspaceIds: project.workspaceIds,
        composerCount: 0,
        copilotSessionCount: 0,
        claudeCodeSessionCount: 0,
        vscodeChatCount: project.chatCount,
        vscodeInlineChatCount: project.inlineChatCount,
        factorySessionCount: 0,
        codexSessionCount: 0,
        lastActivity: project.lastActivity
      });
    }
  }

  // Merge or add Factory projects
  for (const project of factoryProjects) {
    const existing = projectsMap.get(project.path);

    if (existing) {
      // Merge with existing project
      existing.factorySessionCount = project.sessionCount;

      // Update last activity if Factory activity is more recent
      if (project.lastActivity > existing.lastActivity) {
        existing.lastActivity = project.lastActivity;
      }
    } else {
      // Add new project from Factory
      projectsMap.set(project.path, {
        name: project.name,
        path: project.path,
        workspaceIds: [],
        composerCount: 0,
        copilotSessionCount: 0,
        claudeCodeSessionCount: 0,
        vscodeChatCount: 0,
        vscodeInlineChatCount: 0,
        factorySessionCount: project.sessionCount,
        codexSessionCount: 0,
        lastActivity: project.lastActivity
      });
    }
  }

  // Merge or add Codex projects
  for (const project of codexProjects) {
    const existing = projectsMap.get(project.path);

    if (existing) {
      // Merge with existing project
      existing.codexSessionCount = project.sessionCount;

      // Update last activity if Codex activity is more recent
      if (project.lastActivity > existing.lastActivity) {
        existing.lastActivity = project.lastActivity;
      }
    } else {
      // Add new project from Codex
      projectsMap.set(project.path, {
        name: project.name,
        path: project.path,
        workspaceIds: [],
        composerCount: 0,
        copilotSessionCount: 0,
        claudeCodeSessionCount: 0,
        vscodeChatCount: 0,
        vscodeInlineChatCount: 0,
        factorySessionCount: 0,
        codexSessionCount: project.sessionCount,
        lastActivity: project.lastActivity
      });
    }
  }

  return Array.from(projectsMap.values());
}

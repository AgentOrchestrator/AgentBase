import type { ProjectInfo } from '../loaders/types.js';

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
  vscodeSessionCount: number;
  factorySessionCount: number;
  codexSessionCount: number;
  lastActivity: string;
}

/**
 * Merge projects from all loaders into a unified list
 * Projects with the same path are merged together
 */
export function mergeProjects(
  cursorProjects: ProjectInfo[],
  claudeCodeProjects: ProjectInfo[],
  vscodeProjects: ProjectInfo[] = [],
  factoryProjects: ProjectInfo[] = [],
  codexProjects: ProjectInfo[] = []
): UnifiedProjectInfo[] {
  const projectsMap = new Map<string, UnifiedProjectInfo>();

  // Add Cursor projects
  for (const project of cursorProjects) {
    projectsMap.set(project.path, {
      name: project.name,
      path: project.path,
      workspaceIds: project.workspaceIds,
      composerCount: project.composerCount || 0,
      copilotSessionCount: project.copilotSessionCount || 0,
      claudeCodeSessionCount: 0,
      vscodeSessionCount: 0,
      factorySessionCount: 0,
      codexSessionCount: 0,
      lastActivity: project.lastActivity,
    });
  }

  // Merge or add Claude Code projects
  for (const project of claudeCodeProjects) {
    const existing = projectsMap.get(project.path);

    if (existing) {
      existing.claudeCodeSessionCount = project.claudeCodeSessionCount || 0;

      if (project.lastActivity > existing.lastActivity) {
        existing.lastActivity = project.lastActivity;
      }
    } else {
      projectsMap.set(project.path, {
        name: project.name,
        path: project.path,
        workspaceIds: [],
        composerCount: 0,
        copilotSessionCount: 0,
        claudeCodeSessionCount: project.claudeCodeSessionCount || 0,
        vscodeSessionCount: 0,
        factorySessionCount: 0,
        codexSessionCount: 0,
        lastActivity: project.lastActivity,
      });
    }
  }

  // Merge or add VSCode projects
  for (const project of vscodeProjects) {
    const existing = projectsMap.get(project.path);

    if (existing) {
      existing.vscodeSessionCount = project.vscodeSessionCount || 0;

      for (const workspaceId of project.workspaceIds) {
        if (!existing.workspaceIds.includes(workspaceId)) {
          existing.workspaceIds.push(workspaceId);
        }
      }

      if (project.lastActivity > existing.lastActivity) {
        existing.lastActivity = project.lastActivity;
      }
    } else {
      projectsMap.set(project.path, {
        name: project.name,
        path: project.path,
        workspaceIds: project.workspaceIds,
        composerCount: 0,
        copilotSessionCount: 0,
        claudeCodeSessionCount: 0,
        vscodeSessionCount: project.vscodeSessionCount || 0,
        factorySessionCount: 0,
        codexSessionCount: 0,
        lastActivity: project.lastActivity,
      });
    }
  }

  // Merge or add Factory projects
  for (const project of factoryProjects) {
    const existing = projectsMap.get(project.path);

    if (existing) {
      existing.factorySessionCount = project.factorySessionCount || 0;

      if (project.lastActivity > existing.lastActivity) {
        existing.lastActivity = project.lastActivity;
      }
    } else {
      projectsMap.set(project.path, {
        name: project.name,
        path: project.path,
        workspaceIds: [],
        composerCount: 0,
        copilotSessionCount: 0,
        claudeCodeSessionCount: 0,
        vscodeSessionCount: 0,
        factorySessionCount: project.factorySessionCount || 0,
        codexSessionCount: 0,
        lastActivity: project.lastActivity,
      });
    }
  }

  // Merge or add Codex projects
  for (const project of codexProjects) {
    const existing = projectsMap.get(project.path);

    if (existing) {
      existing.codexSessionCount = project.codexSessionCount || 0;

      if (project.lastActivity > existing.lastActivity) {
        existing.lastActivity = project.lastActivity;
      }
    } else {
      projectsMap.set(project.path, {
        name: project.name,
        path: project.path,
        workspaceIds: [],
        composerCount: 0,
        copilotSessionCount: 0,
        claudeCodeSessionCount: 0,
        vscodeSessionCount: 0,
        factorySessionCount: 0,
        codexSessionCount: project.codexSessionCount || 0,
        lastActivity: project.lastActivity,
      });
    }
  }

  return Array.from(projectsMap.values());
}

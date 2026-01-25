import { describe, expect, it } from 'vitest';
import type { ProjectInfo } from '../../loaders/types.js';
import { mergeProjects, type UnifiedProjectInfo } from '../project-aggregator.js';

describe('project-aggregator', () => {
  describe('mergeProjects', () => {
    it('should return empty array when no projects provided', () => {
      const result = mergeProjects([], [], [], [], []);
      expect(result).toEqual([]);
    });

    it('should preserve single cursor project', () => {
      const cursorProjects: ProjectInfo[] = [
        {
          name: 'my-app',
          path: '/Users/dev/my-app',
          workspaceIds: ['ws-123'],
          composerCount: 5,
          copilotSessionCount: 3,
          lastActivity: '2025-01-15T10:00:00.000Z',
        },
      ];

      const result = mergeProjects(cursorProjects, [], [], [], []);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'my-app',
        path: '/Users/dev/my-app',
        workspaceIds: ['ws-123'],
        composerCount: 5,
        copilotSessionCount: 3,
        claudeCodeSessionCount: 0,
        vscodeSessionCount: 0,
        factorySessionCount: 0,
        codexSessionCount: 0,
        lastActivity: '2025-01-15T10:00:00.000Z',
      } satisfies UnifiedProjectInfo);
    });

    it('should merge projects with same path from different sources', () => {
      const cursorProjects: ProjectInfo[] = [
        {
          name: 'my-app',
          path: '/Users/dev/my-app',
          workspaceIds: ['ws-123'],
          composerCount: 5,
          copilotSessionCount: 3,
          lastActivity: '2025-01-15T10:00:00.000Z',
        },
      ];

      const claudeCodeProjects: ProjectInfo[] = [
        {
          name: 'my-app',
          path: '/Users/dev/my-app',
          workspaceIds: [],
          claudeCodeSessionCount: 10,
          lastActivity: '2025-01-20T10:00:00.000Z', // More recent
        },
      ];

      const result = mergeProjects(cursorProjects, claudeCodeProjects, [], [], []);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'my-app',
        path: '/Users/dev/my-app',
        composerCount: 5,
        copilotSessionCount: 3,
        claudeCodeSessionCount: 10,
        lastActivity: '2025-01-20T10:00:00.000Z', // Should use latest
      });
    });

    it('should keep projects from different paths separate', () => {
      const cursorProjects: ProjectInfo[] = [
        {
          name: 'app-a',
          path: '/Users/dev/app-a',
          workspaceIds: ['ws-a'],
          composerCount: 2,
          copilotSessionCount: 1,
          lastActivity: '2025-01-10T10:00:00.000Z',
        },
      ];

      const claudeCodeProjects: ProjectInfo[] = [
        {
          name: 'app-b',
          path: '/Users/dev/app-b',
          workspaceIds: [],
          claudeCodeSessionCount: 5,
          lastActivity: '2025-01-12T10:00:00.000Z',
        },
      ];

      const result = mergeProjects(cursorProjects, claudeCodeProjects, [], [], []);

      expect(result).toHaveLength(2);
      expect(result.map((p) => p.path)).toContain('/Users/dev/app-a');
      expect(result.map((p) => p.path)).toContain('/Users/dev/app-b');
    });

    it('should merge all five source types for same project', () => {
      const cursorProjects: ProjectInfo[] = [
        {
          name: 'unified-app',
          path: '/Users/dev/unified-app',
          workspaceIds: ['ws-cursor'],
          composerCount: 2,
          copilotSessionCount: 1,
          lastActivity: '2025-01-01T10:00:00.000Z',
        },
      ];

      const claudeCodeProjects: ProjectInfo[] = [
        {
          name: 'unified-app',
          path: '/Users/dev/unified-app',
          workspaceIds: [],
          claudeCodeSessionCount: 3,
          lastActivity: '2025-01-02T10:00:00.000Z',
        },
      ];

      const vscodeProjects: ProjectInfo[] = [
        {
          name: 'unified-app',
          path: '/Users/dev/unified-app',
          workspaceIds: ['ws-vscode'],
          vscodeSessionCount: 4,
          lastActivity: '2025-01-03T10:00:00.000Z',
        },
      ];

      const factoryProjects: ProjectInfo[] = [
        {
          name: 'unified-app',
          path: '/Users/dev/unified-app',
          workspaceIds: [],
          factorySessionCount: 5,
          lastActivity: '2025-01-04T10:00:00.000Z',
        },
      ];

      const codexProjects: ProjectInfo[] = [
        {
          name: 'unified-app',
          path: '/Users/dev/unified-app',
          workspaceIds: [],
          codexSessionCount: 6,
          lastActivity: '2025-01-05T10:00:00.000Z', // Latest
        },
      ];

      const result = mergeProjects(
        cursorProjects,
        claudeCodeProjects,
        vscodeProjects,
        factoryProjects,
        codexProjects
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'unified-app',
        path: '/Users/dev/unified-app',
        workspaceIds: ['ws-cursor', 'ws-vscode'], // Merged from cursor + vscode
        composerCount: 2,
        copilotSessionCount: 1,
        claudeCodeSessionCount: 3,
        vscodeSessionCount: 4,
        factorySessionCount: 5,
        codexSessionCount: 6,
        lastActivity: '2025-01-05T10:00:00.000Z', // Latest from codex
      } satisfies UnifiedProjectInfo);
    });

    it('should deduplicate workspace IDs when merging', () => {
      const cursorProjects: ProjectInfo[] = [
        {
          name: 'my-app',
          path: '/Users/dev/my-app',
          workspaceIds: ['ws-123', 'ws-456'],
          composerCount: 1,
          copilotSessionCount: 0,
          lastActivity: '2025-01-10T10:00:00.000Z',
        },
      ];

      const vscodeProjects: ProjectInfo[] = [
        {
          name: 'my-app',
          path: '/Users/dev/my-app',
          workspaceIds: ['ws-123', 'ws-789'], // ws-123 already exists
          vscodeSessionCount: 2,
          lastActivity: '2025-01-11T10:00:00.000Z',
        },
      ];

      const result = mergeProjects(cursorProjects, [], vscodeProjects, [], []);

      expect(result).toHaveLength(1);
      expect(result[0]?.workspaceIds).toHaveLength(3);
      expect(result[0]?.workspaceIds).toContain('ws-123');
      expect(result[0]?.workspaceIds).toContain('ws-456');
      expect(result[0]?.workspaceIds).toContain('ws-789');
    });

    it('should keep latest lastActivity when merging projects', () => {
      const cursorProjects: ProjectInfo[] = [
        {
          name: 'my-app',
          path: '/Users/dev/my-app',
          workspaceIds: [],
          composerCount: 1,
          copilotSessionCount: 0,
          lastActivity: '2025-01-20T10:00:00.000Z', // More recent
        },
      ];

      const claudeCodeProjects: ProjectInfo[] = [
        {
          name: 'my-app',
          path: '/Users/dev/my-app',
          workspaceIds: [],
          claudeCodeSessionCount: 1,
          lastActivity: '2025-01-10T10:00:00.000Z', // Older
        },
      ];

      const result = mergeProjects(cursorProjects, claudeCodeProjects, [], [], []);

      expect(result).toHaveLength(1);
      // Should keep the more recent timestamp
      expect(result[0]?.lastActivity).toBe('2025-01-20T10:00:00.000Z');
    });
  });
});

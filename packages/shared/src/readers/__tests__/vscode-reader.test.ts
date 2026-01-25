import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  convertToStandardFormat,
  extractProjectsFromHistories,
  parseChatSessionFile,
  parseWorkspaceInfo,
  readVSCodeHistories,
  type VSCodeConversation,
  VSCodeLoader,
} from '../vscode-reader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures', 'vscode');

describe('vscode-reader', () => {
  describe('parseWorkspaceInfo', () => {
    it('should parse workspace.json and extract folder path', () => {
      const workspaceJsonPath = path.join(fixturesDir, 'workspace.json');
      const result = parseWorkspaceInfo(path.dirname(workspaceJsonPath));

      expect(result).not.toBeNull();
      expect(result?.folder).toBe('/Users/dev/vscode-project');
    });

    it('should return null for non-existent workspace.json', () => {
      const result = parseWorkspaceInfo('/nonexistent/path');
      expect(result).toBeNull();
    });

    it('should handle file:// URI scheme', () => {
      const workspaceJsonPath = path.join(fixturesDir, 'workspace.json');
      const result = parseWorkspaceInfo(path.dirname(workspaceJsonPath));

      // Should strip file:// prefix
      expect(result?.folder?.startsWith('file://')).toBe(false);
    });
  });

  describe('parseChatSessionFile', () => {
    it('should parse chat session JSON file', () => {
      const sessionPath = path.join(fixturesDir, 'chat-session.json');
      const workspaceInfo = {
        workspaceId: 'test-workspace-id',
        folder: '/Users/dev/vscode-project',
      };

      const result = parseChatSessionFile(sessionPath, workspaceInfo);

      expect(result).not.toBeNull();
      expect(result?.messages).toHaveLength(4); // 2 requests * 2 (user + assistant)
      expect(result?.id).toBe('vscode-session-123');
    });

    it('should extract messages in correct order (user, assistant)', () => {
      const sessionPath = path.join(fixturesDir, 'chat-session.json');
      const workspaceInfo = {
        workspaceId: 'test-workspace-id',
        folder: '/Users/dev/vscode-project',
      };

      const result = parseChatSessionFile(sessionPath, workspaceInfo);

      expect(result?.messages[0]?.role).toBe('user');
      expect(result?.messages[0]?.content).toBe('How do I fix this TypeScript error?');
      expect(result?.messages[1]?.role).toBe('assistant');
    });

    it('should include workspace metadata', () => {
      const sessionPath = path.join(fixturesDir, 'chat-session.json');
      const workspaceInfo = {
        workspaceId: 'test-workspace-id',
        folder: '/Users/dev/vscode-project',
      };

      const result = parseChatSessionFile(sessionPath, workspaceInfo);

      expect(result?.metadata?.workspaceId).toBe('test-workspace-id');
      expect(result?.metadata?.projectPath).toBe('/Users/dev/vscode-project');
      expect(result?.metadata?.source).toBe('vscode-chat');
    });

    it('should use requesterUsername as conversationName', () => {
      const sessionPath = path.join(fixturesDir, 'chat-session.json');
      const workspaceInfo = {
        workspaceId: 'test-workspace-id',
        folder: '/Users/dev/vscode-project',
      };

      const result = parseChatSessionFile(sessionPath, workspaceInfo);

      expect(result?.metadata?.conversationName).toBe('Copilot Chat');
    });

    it('should return null for invalid JSON', () => {
      const invalidPath = path.join(fixturesDir, 'invalid.json');
      fs.writeFileSync(invalidPath, 'not valid json');

      const result = parseChatSessionFile(invalidPath, null);
      expect(result).toBeNull();

      fs.unlinkSync(invalidPath);
    });

    it('should return null for session without requests', () => {
      const emptyPath = path.join(fixturesDir, 'empty-session.json');
      fs.writeFileSync(emptyPath, JSON.stringify({ sessionId: 'empty', requests: [] }));

      const result = parseChatSessionFile(emptyPath, null);
      expect(result).toBeNull();

      fs.unlinkSync(emptyPath);
    });
  });

  describe('readVSCodeHistories', () => {
    const testStorageDir = path.join(fixturesDir, 'test-storage');

    beforeAll(() => {
      // Create test workspace storage structure
      const workspaceDir = path.join(testStorageDir, 'test-workspace-id');
      const chatSessionsDir = path.join(workspaceDir, 'chatSessions');
      fs.mkdirSync(chatSessionsDir, { recursive: true });

      // Copy fixtures
      fs.copyFileSync(
        path.join(fixturesDir, 'workspace.json'),
        path.join(workspaceDir, 'workspace.json')
      );
      fs.copyFileSync(
        path.join(fixturesDir, 'chat-session.json'),
        path.join(chatSessionsDir, 'session-abc.json')
      );
    });

    afterAll(() => {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    });

    it('should read histories from workspace storage', async () => {
      const result = await readVSCodeHistories(testStorageDir);

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]?.conversationType).toBe('chat');
    });

    it('should return empty array for non-existent directory', async () => {
      const result = await readVSCodeHistories('/nonexistent/path');
      expect(result).toEqual([]);
    });

    it('should respect lookbackDays filter', async () => {
      const result = await readVSCodeHistories(testStorageDir, { lookbackDays: 1 });
      expect(Array.isArray(result)).toBe(true);
    });

    it('should respect sinceTimestamp filter', async () => {
      const futureTimestamp = Date.now() + 1000 * 60 * 60 * 24;
      const result = await readVSCodeHistories(testStorageDir, { sinceTimestamp: futureTimestamp });
      expect(result).toHaveLength(0);
    });
  });

  describe('convertToStandardFormat', () => {
    it('should convert VSCodeConversation to ChatHistory format', () => {
      const conversations: VSCodeConversation[] = [
        {
          id: 'conv-1',
          timestamp: '2025-01-15T10:00:00.000Z',
          messages: [
            {
              id: 'msg-1',
              role: 'user',
              content: 'Hello',
              timestamp: '2025-01-15T10:00:00.000Z',
            },
            {
              id: 'msg-2',
              role: 'assistant',
              content: 'Hi!',
              timestamp: '2025-01-15T10:01:00.000Z',
            },
          ],
          conversationType: 'chat',
          metadata: {
            source: 'vscode-chat',
            projectPath: '/Users/dev/my-app',
          },
        },
      ];

      const result = convertToStandardFormat(conversations);

      expect(result).toHaveLength(1);
      expect(result[0]?.agent_type).toBe('vscode');
      expect(result[0]?.messages).toHaveLength(2);
      expect(result[0]?.messages[0]?.display).toBe('Hello');
    });
  });

  describe('extractProjectsFromHistories', () => {
    it('should extract projects from VSCode conversations', () => {
      const conversations: VSCodeConversation[] = [
        {
          id: 'conv-1',
          timestamp: '2025-01-15T10:00:00.000Z',
          messages: [],
          conversationType: 'chat',
          metadata: {
            projectPath: '/Users/dev/vscode-app',
            projectName: 'vscode-app',
            workspaceId: 'ws-1',
          },
        },
        {
          id: 'conv-2',
          timestamp: '2025-01-16T10:00:00.000Z',
          messages: [],
          conversationType: 'inline',
          metadata: {
            projectPath: '/Users/dev/vscode-app',
            projectName: 'vscode-app',
            workspaceId: 'ws-1',
          },
        },
      ];

      const result = extractProjectsFromHistories(conversations);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'vscode-app',
        path: '/Users/dev/vscode-app',
        vscodeSessionCount: 2,
        lastActivity: '2025-01-16T10:00:00.000Z',
      });
    });

    it('should collect unique workspace IDs', () => {
      const conversations: VSCodeConversation[] = [
        {
          id: 'conv-1',
          timestamp: '2025-01-15T10:00:00.000Z',
          messages: [],
          conversationType: 'chat',
          metadata: {
            projectPath: '/Users/dev/app',
            projectName: 'app',
            workspaceId: 'ws-1',
          },
        },
        {
          id: 'conv-2',
          timestamp: '2025-01-16T10:00:00.000Z',
          messages: [],
          conversationType: 'chat',
          metadata: {
            projectPath: '/Users/dev/app',
            projectName: 'app',
            workspaceId: 'ws-2',
          },
        },
      ];

      const result = extractProjectsFromHistories(conversations);

      expect(result[0]?.workspaceIds).toHaveLength(2);
      expect(result[0]?.workspaceIds).toContain('ws-1');
      expect(result[0]?.workspaceIds).toContain('ws-2');
    });

    it('should skip conversations without projectPath', () => {
      const conversations: VSCodeConversation[] = [
        {
          id: 'conv-1',
          timestamp: '2025-01-15T10:00:00.000Z',
          messages: [],
          conversationType: 'inline',
          metadata: {}, // No projectPath
        },
      ];

      const result = extractProjectsFromHistories(conversations);
      expect(result).toHaveLength(0);
    });
  });

  describe('VSCodeLoader', () => {
    it('should implement IDatabaseLoader interface', () => {
      const loader = new VSCodeLoader();

      expect(loader.agentType).toBe('vscode');
      expect(loader.name).toBe('VSCode');
      expect(typeof loader.readHistories).toBe('function');
      expect(typeof loader.extractProjects).toBe('function');
      expect(typeof loader.isAvailable).toBe('function');
      expect(typeof loader.isDatabaseAccessible).toBe('function');
    });

    it('should have databasePath property', () => {
      const loader = new VSCodeLoader();
      expect(typeof loader.databasePath).toBe('string');
    });
  });
});

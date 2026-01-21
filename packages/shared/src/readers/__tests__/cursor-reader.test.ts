import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type CursorConversation,
  CursorLoader,
  convertToStandardFormat,
  type DatabaseOpener,
  detectStorageFormat,
  extractProjectsFromHistories,
  type IDatabase,
  parseComposerData,
  parseCopilotData,
  readCursorHistories,
} from '../cursor-reader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures', 'cursor');

/**
 * Create a mock database for testing
 * This avoids requiring the better-sqlite3 native module in CI
 */
function createMockDatabase(
  tables: string[],
  data: Array<{ key: string; value: string }> = []
): IDatabase {
  return {
    prepare: (sql: string) => ({
      get: () => {
        // Handle table existence checks - find matching table or return nothing
        const matchedTable = tables.find((table) => sql.includes(`name='${table}'`));
        return matchedTable ? { name: matchedTable } : null;
      },
      all: () => {
        // Handle data queries
        if (sql.includes('SELECT key, value FROM')) {
          return data;
        }
        return [];
      },
    }),
    close: () => {},
  };
}

/**
 * Create a mock database opener for testing
 */
function createMockDatabaseOpener(
  tables: string[],
  data: Array<{ key: string; value: string }> = []
): DatabaseOpener {
  return () => createMockDatabase(tables, data);
}

describe('cursor-reader', () => {
  describe('detectStorageFormat', () => {
    const testDbPath = path.join(fixturesDir, 'test-format.vscdb');

    beforeAll(() => {
      // Create fixtures directory for file existence checks
      fs.mkdirSync(fixturesDir, { recursive: true });
      // Create an empty file to pass fs.existsSync checks
      fs.writeFileSync(testDbPath, '');
    });

    afterAll(() => {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    });

    it('should detect cursorDiskKV format', () => {
      const mockOpener = createMockDatabaseOpener(['cursorDiskKV']);
      const result = detectStorageFormat(testDbPath, mockOpener);
      expect(result).toBe('cursorDiskKV');
    });

    it('should detect ItemTable format', () => {
      const mockOpener = createMockDatabaseOpener(['ItemTable']);
      const result = detectStorageFormat(testDbPath, mockOpener);
      expect(result).toBe('ItemTable');
    });

    it('should return null for non-existent database', () => {
      const result = detectStorageFormat('/nonexistent/path.vscdb');
      expect(result).toBeNull();
    });
  });

  describe('parseComposerData', () => {
    it('should parse composer data with conversation array', () => {
      const data = {
        composerId: 'composer-123',
        conversation: [
          {
            bubbleId: 'bubble-1',
            type: 1,
            text: 'User message',
            createdAt: '2025-01-15T10:00:00.000Z',
          },
          {
            bubbleId: 'bubble-2',
            type: 2,
            text: 'Assistant response',
            createdAt: '2025-01-15T10:01:00.000Z',
            modelInfo: { modelName: 'gpt-4' },
          },
        ],
        workspace: '/Users/dev/project',
        name: 'Session name',
        lastUpdatedAt: '2025-01-15T10:01:00.000Z',
      };

      const result = parseComposerData(data);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('composer-123');
      expect(result?.messages).toHaveLength(2);
      expect(result?.messages[0]).toMatchObject({
        role: 'user',
        content: 'User message',
      });
      expect(result?.messages[1]).toMatchObject({
        role: 'assistant',
        content: 'Assistant response',
        modelName: 'gpt-4',
      });
      expect(result?.conversationType).toBe('composer');
    });

    it('should handle richText field as fallback', () => {
      const data = {
        composerId: 'composer-123',
        conversation: [
          {
            bubbleId: 'bubble-1',
            type: 1,
            richText: 'Rich text content',
            createdAt: '2025-01-15T10:00:00.000Z',
          },
        ],
      };

      const result = parseComposerData(data);

      expect(result?.messages[0]?.content).toBe('Rich text content');
    });

    it('should map bubble types to roles correctly', () => {
      const data = {
        composerId: 'composer-123',
        conversation: [
          { bubbleId: '1', type: 1, text: 'User', createdAt: '2025-01-15T10:00:00.000Z' },
          { bubbleId: '2', type: 2, text: 'Assistant', createdAt: '2025-01-15T10:01:00.000Z' },
        ],
      };

      const result = parseComposerData(data);

      expect(result?.messages[0]?.role).toBe('user');
      expect(result?.messages[1]?.role).toBe('assistant');
    });

    it('should extract project metadata from workspace', () => {
      const data = {
        composerId: 'composer-123',
        conversation: [
          { bubbleId: '1', type: 1, text: 'Hello', createdAt: '2025-01-15T10:00:00.000Z' },
        ],
        workspace: '/Users/dev/my-project',
      };

      const result = parseComposerData(data);

      expect(result?.metadata?.projectPath).toBe('/Users/dev/my-project');
      expect(result?.metadata?.projectName).toBe('my-project');
    });

    it('should use name as conversationName', () => {
      const data = {
        composerId: 'composer-123',
        conversation: [
          { bubbleId: '1', type: 1, text: 'Hello', createdAt: '2025-01-15T10:00:00.000Z' },
        ],
        name: 'Bug fixing chat',
      };

      const result = parseComposerData(data);

      expect(result?.metadata?.conversationName).toBe('Bug fixing chat');
    });

    it('should return null for empty conversation', () => {
      const data = {
        composerId: 'composer-123',
        conversation: [],
      };

      const result = parseComposerData(data);
      expect(result).toBeNull();
    });
  });

  describe('parseCopilotData', () => {
    it('should parse copilot session data', () => {
      const data = {
        sessionId: 'copilot-123',
        messages: [
          { role: 'user' as const, content: 'Help me', timestamp: '2025-01-15T10:00:00.000Z' },
          { role: 'assistant' as const, content: 'Sure!', timestamp: '2025-01-15T10:01:00.000Z' },
        ],
      };

      const result = parseCopilotData(data);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('copilot-123');
      expect(result?.messages).toHaveLength(2);
      expect(result?.conversationType).toBe('copilot');
    });

    it('should return null for empty messages', () => {
      const data = {
        sessionId: 'copilot-123',
        messages: [],
      };

      const result = parseCopilotData(data);
      expect(result).toBeNull();
    });
  });

  describe('readCursorHistories', () => {
    const testDbPath = path.join(fixturesDir, 'test-state.vscdb');

    // Test data for mock database
    const composerData = {
      _v: 1,
      composerId: 'composer-123',
      conversation: [
        {
          bubbleId: 'bubble-1',
          type: 1,
          text: 'Help me with this code',
          createdAt: '2025-01-15T10:00:00.000Z',
        },
        {
          bubbleId: 'bubble-2',
          type: 2,
          text: 'I can help you with that code.',
          createdAt: '2025-01-15T10:01:00.000Z',
          modelInfo: { modelName: 'gpt-4' },
        },
      ],
      createdAt: '2025-01-15T09:00:00.000Z',
      lastUpdatedAt: '2025-01-15T10:01:00.000Z',
      workspace: '/Users/dev/cursor-project',
      name: 'Code help session',
    };

    const mockData = [{ key: 'composerData:composer-123', value: JSON.stringify(composerData) }];

    beforeAll(() => {
      fs.mkdirSync(fixturesDir, { recursive: true });
      // Create an empty file to pass fs.existsSync checks
      fs.writeFileSync(testDbPath, '');
    });

    afterAll(() => {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    });

    it('should read histories from Cursor database', async () => {
      const mockOpener = createMockDatabaseOpener(['cursorDiskKV'], mockData);
      const result = await readCursorHistories(testDbPath, { databaseOpener: mockOpener });

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]?.conversationType).toBe('composer');
    });

    it('should return empty array for non-existent database', async () => {
      const result = await readCursorHistories('/nonexistent/path.vscdb');
      expect(result).toEqual([]);
    });

    it('should respect lookbackDays filter', async () => {
      const mockOpener = createMockDatabaseOpener(['cursorDiskKV'], mockData);
      const result = await readCursorHistories(testDbPath, {
        lookbackDays: 1,
        databaseOpener: mockOpener,
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it('should respect sinceTimestamp filter', async () => {
      const mockOpener = createMockDatabaseOpener(['cursorDiskKV'], mockData);
      const futureTimestamp = Date.now() + 1000 * 60 * 60 * 24;
      const result = await readCursorHistories(testDbPath, {
        sinceTimestamp: futureTimestamp,
        databaseOpener: mockOpener,
      });
      expect(result).toHaveLength(0);
    });
  });

  describe('convertToStandardFormat', () => {
    it('should convert CursorConversation to ChatHistory format', () => {
      const conversations: CursorConversation[] = [
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
          ],
          conversationType: 'composer',
          metadata: {
            source: 'cursor-composer',
            projectPath: '/Users/dev/my-app',
          },
        },
      ];

      const result = convertToStandardFormat(conversations);

      expect(result).toHaveLength(1);
      expect(result[0]?.agent_type).toBe('cursor');
      expect(result[0]?.messages[0]?.display).toBe('Hello');
    });
  });

  describe('extractProjectsFromHistories', () => {
    it('should extract projects from Cursor conversations', () => {
      const conversations: CursorConversation[] = [
        {
          id: 'conv-1',
          timestamp: '2025-01-15T10:00:00.000Z',
          messages: [],
          conversationType: 'composer',
          metadata: {
            projectPath: '/Users/dev/cursor-app',
            projectName: 'cursor-app',
            workspaceId: 'ws-1',
          },
        },
        {
          id: 'conv-2',
          timestamp: '2025-01-16T10:00:00.000Z',
          messages: [],
          conversationType: 'copilot',
          metadata: {
            projectPath: '/Users/dev/cursor-app',
            projectName: 'cursor-app',
            workspaceId: 'ws-1',
          },
        },
      ];

      const result = extractProjectsFromHistories(conversations);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'cursor-app',
        path: '/Users/dev/cursor-app',
        composerCount: 1,
        copilotSessionCount: 1,
        lastActivity: '2025-01-16T10:00:00.000Z',
      });
    });

    it('should collect unique workspace IDs', () => {
      const conversations: CursorConversation[] = [
        {
          id: 'conv-1',
          timestamp: '2025-01-15T10:00:00.000Z',
          messages: [],
          conversationType: 'composer',
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
          conversationType: 'composer',
          metadata: {
            projectPath: '/Users/dev/app',
            projectName: 'app',
            workspaceId: 'ws-2',
          },
        },
      ];

      const result = extractProjectsFromHistories(conversations);

      expect(result[0]?.workspaceIds).toHaveLength(2);
    });

    it('should skip conversations without projectPath', () => {
      const conversations: CursorConversation[] = [
        {
          id: 'conv-1',
          timestamp: '2025-01-15T10:00:00.000Z',
          messages: [],
          conversationType: 'composer',
          metadata: {},
        },
      ];

      const result = extractProjectsFromHistories(conversations);
      expect(result).toHaveLength(0);
    });
  });

  describe('CursorLoader', () => {
    it('should implement IDatabaseLoader interface', () => {
      const loader = new CursorLoader();

      expect(loader.agentType).toBe('cursor');
      expect(loader.name).toBe('Cursor');
      expect(typeof loader.readHistories).toBe('function');
      expect(typeof loader.extractProjects).toBe('function');
      expect(typeof loader.isAvailable).toBe('function');
      expect(typeof loader.isDatabaseAccessible).toBe('function');
    });

    it('should have databasePath property', () => {
      const loader = new CursorLoader();
      expect(typeof loader.databasePath).toBe('string');
    });
  });
});

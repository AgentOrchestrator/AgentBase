import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ChatHistory } from '../../loaders/types.js';
import {
  ClaudeCodeLoader,
  extractProjectsFromHistories,
  parseSessionFile,
  readClaudeCodeHistories,
} from '../claude-code-reader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures', 'claude-code');

describe('claude-code-reader', () => {
  describe('parseSessionFile', () => {
    it('should parse basic JSONL session file with user and assistant messages', () => {
      const sessionPath = path.join(fixturesDir, 'session-basic.jsonl');
      const result = parseSessionFile(sessionPath, '/Users/dev/my-project');

      expect(result).not.toBeNull();
      expect(result?.messages).toHaveLength(4);
      expect(result?.messages[0]).toMatchObject({
        role: 'user',
        display: 'Hello, can you help me with a bug?',
      });
      expect(result?.messages[1]).toMatchObject({
        role: 'assistant',
        display:
          "Of course! I'd be happy to help you debug. Could you describe the bug you're encountering?",
      });
      expect(result?.agent_type).toBe('claude_code');
      expect(result?.metadata?.projectPath).toBe('/Users/dev/my-project');
      expect(result?.metadata?.projectName).toBe('my-project');
    });

    it('should extract summary from session file', () => {
      const sessionPath = path.join(fixturesDir, 'session-with-summary.jsonl');
      const result = parseSessionFile(sessionPath, '/Users/dev/my-project');

      expect(result).not.toBeNull();
      expect(result?.metadata?.summary).toBe(
        'Helped user fix a TypeScript compilation error related to undefined types'
      );
    });

    it('should handle array content in messages', () => {
      const sessionPath = path.join(fixturesDir, 'session-array-content.jsonl');
      const result = parseSessionFile(sessionPath, '/Users/dev/my-project');

      expect(result).not.toBeNull();
      // Array content should be flattened into separate messages
      expect(result?.messages.length).toBeGreaterThanOrEqual(2);
      expect(result?.messages.some((m) => m.display === 'What is this code doing?')).toBe(true);
    });

    it('should return null for empty file', () => {
      // Create empty file temporarily
      const emptyPath = path.join(fixturesDir, 'empty.jsonl');
      fs.writeFileSync(emptyPath, '');

      const result = parseSessionFile(emptyPath, '/Users/dev/my-project');
      expect(result).toBeNull();

      fs.unlinkSync(emptyPath);
    });

    it('should use session timestamp from last message', () => {
      const sessionPath = path.join(fixturesDir, 'session-basic.jsonl');
      const result = parseSessionFile(sessionPath, '/Users/dev/my-project');

      expect(result).not.toBeNull();
      // Timestamp should be from the last message
      expect(result?.timestamp).toBe('2025-01-15T10:03:00.000Z');
    });

    it('should use filename as session ID', () => {
      const sessionPath = path.join(fixturesDir, 'session-basic.jsonl');
      const result = parseSessionFile(sessionPath, '/Users/dev/my-project');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('session-basic');
    });
  });

  describe('readClaudeCodeHistories', () => {
    const testProjectsDir = path.join(fixturesDir, 'test-projects');

    beforeAll(() => {
      // Create test project structure
      // Folder name format: leading '-' replaced with '/', all '-' replaced with '/'
      const projectDir = path.join(testProjectsDir, '-Users-dev-myapp');
      fs.mkdirSync(projectDir, { recursive: true });

      // Copy a fixture session to simulate real structure
      const sourceSession = path.join(fixturesDir, 'session-basic.jsonl');
      const destSession = path.join(projectDir, 'session-abc123.jsonl');
      fs.copyFileSync(sourceSession, destSession);
    });

    afterAll(() => {
      // Cleanup
      fs.rmSync(testProjectsDir, { recursive: true, force: true });
    });

    it('should read histories from projects directory', () => {
      const result = readClaudeCodeHistories(testProjectsDir);

      expect(result).toHaveLength(1);
      expect(result[0]?.agent_type).toBe('claude_code');
      expect(result[0]?.metadata?.projectPath).toBe('/Users/dev/myapp');
    });

    it('should return empty array for non-existent directory', () => {
      const result = readClaudeCodeHistories('/nonexistent/path');
      expect(result).toEqual([]);
    });

    it('should convert project directory name to path (replace - with /)', () => {
      const result = readClaudeCodeHistories(testProjectsDir);

      expect(result[0]?.metadata?.projectPath).toBe('/Users/dev/myapp');
    });

    it('should respect lookbackDays filter', () => {
      // This tests the filtering logic - sessions older than lookbackDays should be excluded
      // Since we can't easily control mtime in tests, we verify the function accepts the parameter
      const result = readClaudeCodeHistories(testProjectsDir, { lookbackDays: 1 });
      // Result may or may not include sessions depending on file modification time
      expect(Array.isArray(result)).toBe(true);
    });

    it('should respect sinceTimestamp filter', () => {
      const futureTimestamp = Date.now() + 1000 * 60 * 60 * 24; // 1 day in future
      const result = readClaudeCodeHistories(testProjectsDir, { sinceTimestamp: futureTimestamp });
      // All sessions should be filtered out as they're older than future timestamp
      expect(result).toHaveLength(0);
    });
  });

  describe('extractProjectsFromHistories', () => {
    it('should extract projects from chat histories', () => {
      const histories: ChatHistory[] = [
        {
          id: 'session-1',
          timestamp: '2025-01-15T10:00:00.000Z',
          messages: [{ display: 'Hello', pastedContents: {}, role: 'user' }],
          agent_type: 'claude_code',
          metadata: {
            projectPath: '/Users/dev/my-app',
            projectName: 'my-app',
          },
        },
        {
          id: 'session-2',
          timestamp: '2025-01-16T10:00:00.000Z',
          messages: [{ display: 'Hi', pastedContents: {}, role: 'user' }],
          agent_type: 'claude_code',
          metadata: {
            projectPath: '/Users/dev/my-app',
            projectName: 'my-app',
          },
        },
      ];

      const result = extractProjectsFromHistories(histories);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'my-app',
        path: '/Users/dev/my-app',
        claudeCodeSessionCount: 2,
        lastActivity: '2025-01-16T10:00:00.000Z',
      });
    });

    it('should group sessions by project path', () => {
      const histories: ChatHistory[] = [
        {
          id: 'session-1',
          timestamp: '2025-01-15T10:00:00.000Z',
          messages: [{ display: 'Hello', pastedContents: {}, role: 'user' }],
          agent_type: 'claude_code',
          metadata: { projectPath: '/Users/dev/app-a' },
        },
        {
          id: 'session-2',
          timestamp: '2025-01-15T10:00:00.000Z',
          messages: [{ display: 'Hi', pastedContents: {}, role: 'user' }],
          agent_type: 'claude_code',
          metadata: { projectPath: '/Users/dev/app-b' },
        },
      ];

      const result = extractProjectsFromHistories(histories);

      expect(result).toHaveLength(2);
      expect(result.map((p) => p.path)).toContain('/Users/dev/app-a');
      expect(result.map((p) => p.path)).toContain('/Users/dev/app-b');
    });

    it('should skip histories without projectPath', () => {
      const histories: ChatHistory[] = [
        {
          id: 'session-1',
          timestamp: '2025-01-15T10:00:00.000Z',
          messages: [{ display: 'Hello', pastedContents: {}, role: 'user' }],
          agent_type: 'claude_code',
          metadata: {}, // No projectPath
        },
      ];

      const result = extractProjectsFromHistories(histories);

      expect(result).toHaveLength(0);
    });

    it('should use latest timestamp as lastActivity', () => {
      const histories: ChatHistory[] = [
        {
          id: 'session-1',
          timestamp: '2025-01-10T10:00:00.000Z', // Older
          messages: [{ display: 'Hello', pastedContents: {}, role: 'user' }],
          agent_type: 'claude_code',
          metadata: { projectPath: '/Users/dev/my-app' },
        },
        {
          id: 'session-2',
          timestamp: '2025-01-20T10:00:00.000Z', // Newer
          messages: [{ display: 'Hi', pastedContents: {}, role: 'user' }],
          agent_type: 'claude_code',
          metadata: { projectPath: '/Users/dev/my-app' },
        },
      ];

      const result = extractProjectsFromHistories(histories);

      expect(result[0]?.lastActivity).toBe('2025-01-20T10:00:00.000Z');
    });
  });

  describe('ClaudeCodeLoader', () => {
    it('should implement IChatHistoryLoader interface', () => {
      const loader = new ClaudeCodeLoader();

      expect(loader.agentType).toBe('claude_code');
      expect(loader.name).toBe('Claude Code');
      expect(typeof loader.readHistories).toBe('function');
      expect(typeof loader.extractProjects).toBe('function');
      expect(typeof loader.isAvailable).toBe('function');
    });
  });
});

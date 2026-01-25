import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ChatHistory } from '../../loaders/types.js';
import {
  extractProjectPathFromSystemReminder,
  extractProjectsFromHistories,
  FactoryLoader,
  parseSessionFile,
  readFactoryHistories,
} from '../factory-reader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures', 'factory');

describe('factory-reader', () => {
  describe('extractProjectPathFromSystemReminder', () => {
    it('should extract project path from pwd command output', () => {
      const content = `<system-reminder>
% pwd
/Users/dev/my-factory-app
</system-reminder>
What can you help me with?`;

      const result = extractProjectPathFromSystemReminder(content);
      expect(result).toBe('/Users/dev/my-factory-app');
    });

    it('should return null when no pwd found', () => {
      const content = '<system-reminder>Some other content</system-reminder>';
      const result = extractProjectPathFromSystemReminder(content);
      expect(result).toBeNull();
    });

    it('should handle pwd with trailing whitespace', () => {
      const content = `% pwd
/Users/dev/my-app
More content`;

      const result = extractProjectPathFromSystemReminder(content);
      expect(result).toBe('/Users/dev/my-app');
    });
  });

  describe('parseSessionFile', () => {
    it('should parse basic Factory session file', () => {
      const sessionPath = path.join(fixturesDir, 'session-basic.jsonl');
      const result = parseSessionFile(sessionPath);

      expect(result).not.toBeNull();
      expect(result?.messages).toHaveLength(2);
      expect(result?.messages[0]).toMatchObject({
        role: 'user',
        display: 'Help me fix this bug',
      });
      expect(result?.messages[1]).toMatchObject({
        role: 'assistant',
        display: "I'll help you fix the bug. What's the error message?",
      });
      expect(result?.agent_type).toBe('factory');
      expect(result?.metadata?.source).toBe('factory');
    });

    it('should extract session title as conversationName', () => {
      const sessionPath = path.join(fixturesDir, 'session-basic.jsonl');
      const result = parseSessionFile(sessionPath);

      expect(result?.metadata?.conversationName).toBe('Bug fixing session');
    });

    it('should extract project path from system-reminder', () => {
      const sessionPath = path.join(fixturesDir, 'session-with-pwd.jsonl');
      const result = parseSessionFile(sessionPath);

      expect(result?.metadata?.projectPath).toBe('/Users/dev/my-factory-app');
      expect(result?.metadata?.projectName).toBe('my-factory-app');
    });

    it('should filter out system-reminder messages from display', () => {
      const sessionPath = path.join(fixturesDir, 'session-with-pwd.jsonl');
      const result = parseSessionFile(sessionPath);

      // The system-reminder should be stripped from user messages
      const userMessages = result?.messages.filter((m) => m.role === 'user');
      expect(userMessages?.length).toBe(0); // System reminder messages should be skipped
    });

    it('should use filename as session ID', () => {
      const sessionPath = path.join(fixturesDir, 'session-basic.jsonl');
      const result = parseSessionFile(sessionPath);

      expect(result?.id).toBe('session-basic');
    });

    it('should return null for empty file', () => {
      const emptyPath = path.join(fixturesDir, 'empty.jsonl');
      fs.writeFileSync(emptyPath, '');

      const result = parseSessionFile(emptyPath);
      expect(result).toBeNull();

      fs.unlinkSync(emptyPath);
    });
  });

  describe('readFactoryHistories', () => {
    const testSessionsDir = path.join(fixturesDir, 'test-sessions');

    beforeAll(() => {
      fs.mkdirSync(testSessionsDir, { recursive: true });
      // Copy a fixture session
      const sourceSession = path.join(fixturesDir, 'session-basic.jsonl');
      const destSession = path.join(testSessionsDir, 'abc123.jsonl');
      fs.copyFileSync(sourceSession, destSession);
    });

    afterAll(() => {
      fs.rmSync(testSessionsDir, { recursive: true, force: true });
    });

    it('should read histories from sessions directory', () => {
      const result = readFactoryHistories(testSessionsDir);

      expect(result).toHaveLength(1);
      expect(result[0]?.agent_type).toBe('factory');
    });

    it('should return empty array for non-existent directory', () => {
      const result = readFactoryHistories('/nonexistent/path');
      expect(result).toEqual([]);
    });

    it('should respect lookbackDays filter', () => {
      const result = readFactoryHistories(testSessionsDir, { lookbackDays: 1 });
      expect(Array.isArray(result)).toBe(true);
    });

    it('should respect sinceTimestamp filter', () => {
      const futureTimestamp = Date.now() + 1000 * 60 * 60 * 24;
      const result = readFactoryHistories(testSessionsDir, { sinceTimestamp: futureTimestamp });
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
          agent_type: 'factory',
          metadata: {
            projectPath: '/Users/dev/factory-app',
            projectName: 'factory-app',
          },
        },
        {
          id: 'session-2',
          timestamp: '2025-01-16T10:00:00.000Z',
          messages: [{ display: 'Hi', pastedContents: {}, role: 'user' }],
          agent_type: 'factory',
          metadata: {
            projectPath: '/Users/dev/factory-app',
            projectName: 'factory-app',
          },
        },
      ];

      const result = extractProjectsFromHistories(histories);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'factory-app',
        path: '/Users/dev/factory-app',
        factorySessionCount: 2,
        lastActivity: '2025-01-16T10:00:00.000Z',
      });
    });

    it('should skip histories without projectPath', () => {
      const histories: ChatHistory[] = [
        {
          id: 'session-1',
          timestamp: '2025-01-15T10:00:00.000Z',
          messages: [{ display: 'Hello', pastedContents: {}, role: 'user' }],
          agent_type: 'factory',
          metadata: {},
        },
      ];

      const result = extractProjectsFromHistories(histories);
      expect(result).toHaveLength(0);
    });
  });

  describe('FactoryLoader', () => {
    it('should implement IChatHistoryLoader interface', () => {
      const loader = new FactoryLoader();

      expect(loader.agentType).toBe('factory');
      expect(loader.name).toBe('Factory');
      expect(typeof loader.readHistories).toBe('function');
      expect(typeof loader.extractProjects).toBe('function');
      expect(typeof loader.isAvailable).toBe('function');
    });
  });
});

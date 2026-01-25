import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ChatHistory } from '../../loaders/types.js';
import {
  CodexLoader,
  calculateDateFoldersToScan,
  extractProjectsFromHistories,
  extractUserRequest,
  parseSessionFile,
  readCodexHistories,
} from '../codex-reader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures', 'codex');

describe('codex-reader', () => {
  describe('extractUserRequest', () => {
    it('should extract request after "## My request for Codex:" marker', () => {
      const text = `Some context\n## My request for Codex:\nHelp me optimize this function`;
      const result = extractUserRequest(text);
      expect(result).toBe('Help me optimize this function');
    });

    it('should return null for environment_context messages', () => {
      const text = '<environment_context>file: main.ts</environment_context>';
      const result = extractUserRequest(text);
      expect(result).toBeNull();
    });

    it('should return null for Active file/Open tabs messages', () => {
      const text = '## Active file:\nmain.ts\n## Open tabs:\nutils.ts';
      const result = extractUserRequest(text);
      expect(result).toBeNull();
    });

    it('should return text as-is if no markers found', () => {
      const text = 'Simple question without markers';
      const result = extractUserRequest(text);
      expect(result).toBe('Simple question without markers');
    });

    it('should return null for empty request', () => {
      const text = '## My request for Codex:\n';
      const result = extractUserRequest(text);
      expect(result).toBeNull();
    });
  });

  describe('calculateDateFoldersToScan', () => {
    it('should return correct number of date folders', () => {
      const result = calculateDateFoldersToScan(7);
      expect(result).toHaveLength(7);
    });

    it('should return folders in YYYY/MM/DD format', () => {
      const result = calculateDateFoldersToScan(1);
      expect(result[0]).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    });

    it('should include today as the first folder', () => {
      const fixedDate = new Date('2025-01-15T12:00:00.000Z');
      vi.setSystemTime(fixedDate);
      try {
        const result = calculateDateFoldersToScan(1);
        expect(result[0]).toBe('2025/01/15');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('parseSessionFile', () => {
    it('should parse basic Codex session file', () => {
      const sessionPath = path.join(fixturesDir, 'session-basic.jsonl');
      const result = parseSessionFile(sessionPath);

      expect(result).not.toBeNull();
      expect(result?.messages).toHaveLength(2);
      expect(result?.messages[0]).toMatchObject({
        role: 'user',
        display: 'Help me optimize this function',
      });
      expect(result?.agent_type).toBe('codex');
    });

    it('should extract session metadata', () => {
      const sessionPath = path.join(fixturesDir, 'session-basic.jsonl');
      const result = parseSessionFile(sessionPath);

      expect(result?.id).toBe('codex-session-123');
      expect(result?.metadata?.projectPath).toBe('/Users/dev/codex-project');
      expect(result?.metadata?.projectName).toBe('codex-project');
      expect(result?.metadata?.git).toMatchObject({
        branch: 'main',
        commitHash: 'abc123',
      });
    });

    it('should filter out context messages (environment_context, Active file, etc.)', () => {
      const sessionPath = path.join(fixturesDir, 'session-with-context.jsonl');
      const result = parseSessionFile(sessionPath);

      // Should only include the actual request and response
      expect(result?.messages).toHaveLength(2);
      expect(result?.messages[0]?.display).toBe('What does this code do?');
      expect(result?.messages[1]?.display).toBe('This code processes data from an API.');
    });

    it('should deduplicate identical messages', () => {
      // Create a temp file with duplicate messages
      const dupPath = path.join(fixturesDir, 'session-dup.jsonl');
      const dupContent = `{"type":"session_meta","payload":{"id":"dup-123"}}
{"type":"response_item","timestamp":"2025-01-15T10:00:00.000Z","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Hello"}]}}
{"type":"response_item","timestamp":"2025-01-15T10:00:00.000Z","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Hello"}]}}
{"type":"response_item","timestamp":"2025-01-15T10:01:00.000Z","payload":{"type":"message","role":"assistant","content":[{"type":"input_text","text":"Hi there!"}]}}`;

      fs.writeFileSync(dupPath, dupContent);
      const result = parseSessionFile(dupPath);
      fs.unlinkSync(dupPath);

      expect(result?.messages).toHaveLength(2); // User "Hello" + Assistant "Hi there!"
    });

    it('should return null for empty file', () => {
      const emptyPath = path.join(fixturesDir, 'empty.jsonl');
      fs.writeFileSync(emptyPath, '');

      const result = parseSessionFile(emptyPath);
      expect(result).toBeNull();

      fs.unlinkSync(emptyPath);
    });

    it('should use filename as session ID when not in metadata', () => {
      const noIdPath = path.join(fixturesDir, 'session-no-id.jsonl');
      const content = `{"type":"response_item","timestamp":"2025-01-15T10:00:00.000Z","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Hello"}]}}
{"type":"response_item","timestamp":"2025-01-15T10:01:00.000Z","payload":{"type":"message","role":"assistant","content":[{"type":"input_text","text":"Hi!"}]}}`;

      fs.writeFileSync(noIdPath, content);
      const result = parseSessionFile(noIdPath);
      fs.unlinkSync(noIdPath);

      expect(result?.id).toBe('session-no-id');
    });
  });

  describe('readCodexHistories', () => {
    const testSessionsDir = path.join(fixturesDir, 'test-sessions');

    beforeAll(() => {
      // Create date-based folder structure: sessions/YYYY/MM/DD/
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');

      const datePath = path.join(testSessionsDir, `${year}/${month}/${day}`);
      fs.mkdirSync(datePath, { recursive: true });

      // Copy fixture session
      const sourceSession = path.join(fixturesDir, 'session-basic.jsonl');
      const destSession = path.join(datePath, 'abc123.jsonl');
      fs.copyFileSync(sourceSession, destSession);
    });

    afterAll(() => {
      fs.rmSync(testSessionsDir, { recursive: true, force: true });
    });

    it('should read histories from date-based folder structure', () => {
      const result = readCodexHistories(testSessionsDir, { lookbackDays: 7 });

      expect(result).toHaveLength(1);
      expect(result[0]?.agent_type).toBe('codex');
    });

    it('should return empty array for non-existent directory', () => {
      const result = readCodexHistories('/nonexistent/path');
      expect(result).toEqual([]);
    });

    it('should respect lookbackDays parameter', () => {
      // With lookbackDays: 1, should still find today's sessions
      const result = readCodexHistories(testSessionsDir, { lookbackDays: 1 });
      expect(result).toHaveLength(1);
    });

    it('should respect sinceTimestamp filter', () => {
      const futureTimestamp = Date.now() + 1000 * 60 * 60 * 24;
      const result = readCodexHistories(testSessionsDir, { sinceTimestamp: futureTimestamp });
      expect(result).toHaveLength(0);
    });

    it('should use default lookbackDays of 7 when not specified', () => {
      const result = readCodexHistories(testSessionsDir);
      // Should find sessions from today (within 7 days)
      expect(result).toHaveLength(1);
    });
  });

  describe('extractProjectsFromHistories', () => {
    it('should extract projects from chat histories', () => {
      const histories: ChatHistory[] = [
        {
          id: 'session-1',
          timestamp: '2025-01-15T10:00:00.000Z',
          messages: [{ display: 'Hello', pastedContents: {}, role: 'user' }],
          agent_type: 'codex',
          metadata: {
            projectPath: '/Users/dev/codex-app',
            projectName: 'codex-app',
          },
        },
        {
          id: 'session-2',
          timestamp: '2025-01-16T10:00:00.000Z',
          messages: [{ display: 'Hi', pastedContents: {}, role: 'user' }],
          agent_type: 'codex',
          metadata: {
            projectPath: '/Users/dev/codex-app',
            projectName: 'codex-app',
          },
        },
      ];

      const result = extractProjectsFromHistories(histories);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'codex-app',
        path: '/Users/dev/codex-app',
        codexSessionCount: 2,
        lastActivity: '2025-01-16T10:00:00.000Z',
      });
    });

    it('should skip histories without projectPath', () => {
      const histories: ChatHistory[] = [
        {
          id: 'session-1',
          timestamp: '2025-01-15T10:00:00.000Z',
          messages: [{ display: 'Hello', pastedContents: {}, role: 'user' }],
          agent_type: 'codex',
          metadata: {},
        },
      ];

      const result = extractProjectsFromHistories(histories);
      expect(result).toHaveLength(0);
    });
  });

  describe('CodexLoader', () => {
    it('should implement IChatHistoryLoader interface', () => {
      const loader = new CodexLoader();

      expect(loader.agentType).toBe('codex');
      expect(loader.name).toBe('Codex');
      expect(typeof loader.readHistories).toBe('function');
      expect(typeof loader.extractProjects).toBe('function');
      expect(typeof loader.isAvailable).toBe('function');
    });
  });
});

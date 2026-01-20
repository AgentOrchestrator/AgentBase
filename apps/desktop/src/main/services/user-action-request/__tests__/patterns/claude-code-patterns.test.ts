/**
 * Tests for Claude Code terminal permission prompt detection patterns
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { TerminalPatterns } from '../../interfaces/ITerminalPatternProvider';
import { ClaudeCodePatternProvider } from '../../patterns/claude-code-patterns';

describe('ClaudeCodePatternProvider', () => {
  let provider: ClaudeCodePatternProvider;
  let patterns: TerminalPatterns;

  beforeEach(() => {
    provider = new ClaudeCodePatternProvider();
    patterns = provider.getPatterns();
  });

  describe('getPatterns', () => {
    it('should return valid patterns object', () => {
      expect(patterns).toBeDefined();
      expect(patterns.promptStart).toBeInstanceOf(Array);
      expect(patterns.promptEnd).toBeInstanceOf(Array);
      expect(patterns.responseMap).toBeDefined();
    });

    it('should have non-empty pattern arrays', () => {
      expect(patterns.promptStart.length).toBeGreaterThan(0);
      expect(patterns.promptEnd.length).toBeGreaterThan(0);
    });

    it('should have valid response mappings', () => {
      expect(patterns.responseMap.allow).toBeDefined();
      expect(patterns.responseMap.deny).toBeDefined();
      expect(typeof patterns.responseMap.allow).toBe('string');
      expect(typeof patterns.responseMap.deny).toBe('string');
    });
  });

  describe('promptStart patterns', () => {
    const testCases = [
      {
        name: 'Claude wants to run',
        input: 'Claude wants to run: Bash',
        shouldMatch: true,
      },
      {
        name: 'Claude wants to execute',
        input: 'Claude wants to execute: Read',
        shouldMatch: true,
      },
      {
        name: 'Claude wants to use',
        input: 'Claude wants to use: Write',
        shouldMatch: true,
      },
      {
        name: 'Do you want to run',
        input: 'Do you want to run this command?',
        shouldMatch: true,
      },
      {
        name: 'Allow tool',
        input: 'Allow tool: Bash?',
        shouldMatch: true,
      },
      {
        name: 'random text',
        input: 'This is just some random text',
        shouldMatch: false,
      },
      {
        name: 'partial match should not trigger',
        input: 'Claude is running something',
        shouldMatch: false,
      },
    ];

    for (const testCase of testCases) {
      it(`should ${testCase.shouldMatch ? 'match' : 'not match'}: "${testCase.name}"`, () => {
        const matches = patterns.promptStart.some((pattern) => pattern.test(testCase.input));
        expect(matches).toBe(testCase.shouldMatch);
      });
    }
  });

  describe('promptEnd patterns', () => {
    const testCases = [
      {
        name: 'yes/no format',
        input: '(y)es / (n)o',
        shouldMatch: true,
      },
      {
        name: 'Y/n format',
        input: '[Y/n]',
        shouldMatch: true,
      },
      {
        name: 'y/N format',
        input: '[y/N]',
        shouldMatch: true,
      },
      {
        name: 'Allow? prompt',
        input: 'Allow? ',
        shouldMatch: true,
      },
      {
        name: 'random text',
        input: 'This is just some text',
        shouldMatch: false,
      },
    ];

    for (const testCase of testCases) {
      it(`should ${testCase.shouldMatch ? 'match' : 'not match'}: "${testCase.name}"`, () => {
        const matches = patterns.promptEnd.some((pattern) => pattern.test(testCase.input));
        expect(matches).toBe(testCase.shouldMatch);
      });
    }
  });

  describe('parsePrompt', () => {
    it('should extract tool name from "Claude wants to run: Bash"', () => {
      const text = 'Claude wants to run: Bash\nCommand: ls -la\nAllow? (y)es / (n)o';
      const result = provider.parsePrompt(text, 'permission_prompt');

      expect(result).not.toBeNull();
      expect(result?.toolName).toBe('Bash');
    });

    it('should extract command from prompt', () => {
      const text = 'Claude wants to run: Bash\nCommand: git status --short\nAllow? (y)es / (n)o';
      const result = provider.parsePrompt(text, 'permission_prompt');

      expect(result).not.toBeNull();
      expect(result?.command).toBe('git status --short');
    });

    it('should extract file path from file operations', () => {
      const text =
        'Claude wants to use: Write\nFile: /Users/test/project/src/main.ts\nAllow? (y)es / (n)o';
      const result = provider.parsePrompt(text, 'permission_prompt');

      expect(result).not.toBeNull();
      expect(result?.filePath).toBe('/Users/test/project/src/main.ts');
    });

    it('should handle multi-line commands', () => {
      const text =
        'Claude wants to run: Bash\n' +
        'Command: cat << EOF > test.txt\n' +
        'Hello World\n' +
        'EOF\n' +
        'Allow? (y)es / (n)o';
      const result = provider.parsePrompt(text, 'permission_prompt');

      expect(result).not.toBeNull();
      expect(result?.toolName).toBe('Bash');
    });

    it('should return null for non-matching text', () => {
      const text = 'This is just regular terminal output';
      const result = provider.parsePrompt(text, 'permission_prompt');

      // Should either return null or an object with no meaningful data
      expect(result?.toolName).toBeUndefined();
    });

    it('should handle Read tool prompts', () => {
      const text = 'Claude wants to use: Read\nPath: /etc/passwd\nAllow? (y)es / (n)o';
      const result = provider.parsePrompt(text, 'permission_prompt');

      expect(result?.toolName).toBe('Read');
      expect(result?.filePath).toBe('/etc/passwd');
    });

    it('should handle Edit tool prompts', () => {
      const text = 'Claude wants to use: Edit\nFile: src/app.ts\nAllow? (y)es / (n)o';
      const result = provider.parsePrompt(text, 'permission_prompt');

      expect(result?.toolName).toBe('Edit');
    });
  });

  describe('real-world Claude Code output samples', () => {
    it('should detect Bash permission prompt', () => {
      // Raw ANSI output (for reference):
      // '\x1b[1m\x1b[33m⚠️  Claude wants to run:\x1b[0m Bash\n' +
      // '\x1b[90mCommand:\x1b[0m npm install express\n' +
      // '\x1b[90mAllow? (y)es / (n)o:\x1b[0m'

      // After ANSI stripping, this should match
      const stripped =
        '⚠️  Claude wants to run: Bash\n' +
        'Command: npm install express\n' +
        'Allow? (y)es / (n)o:';

      const startsMatch = patterns.promptStart.some((p) => p.test(stripped));
      const endsMatch = patterns.promptEnd.some((p) => p.test(stripped));

      expect(startsMatch).toBe(true);
      expect(endsMatch).toBe(true);

      const parsed = provider.parsePrompt(stripped, 'detected');
      expect(parsed?.toolName).toBe('Bash');
      expect(parsed?.command).toBe('npm install express');
    });

    it('should detect Write permission prompt', () => {
      const stripped =
        'Claude wants to use: Write\n' +
        'File: /Users/dev/project/README.md\n' +
        'Allow? (y)es / (n)o';

      const startsMatch = patterns.promptStart.some((p) => p.test(stripped));
      const endsMatch = patterns.promptEnd.some((p) => p.test(stripped));

      expect(startsMatch).toBe(true);
      expect(endsMatch).toBe(true);

      const parsed = provider.parsePrompt(stripped, 'detected');
      expect(parsed?.toolName).toBe('Write');
      expect(parsed?.filePath).toBe('/Users/dev/project/README.md');
    });
  });
});

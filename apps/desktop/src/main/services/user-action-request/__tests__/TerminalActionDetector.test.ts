/**
 * Tests for TerminalActionDetector
 *
 * Tests the core detection logic for terminal permission prompts.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { TerminalActionDetector } from '../implementations/TerminalActionDetector';
import { DetectorState } from '../types/detection.types';

describe('TerminalActionDetector', () => {
  let detector: TerminalActionDetector;

  beforeEach(() => {
    detector = new TerminalActionDetector('claude_code');
  });

  describe('initialization', () => {
    it('should start in IDLE state', () => {
      expect(detector.state).toBe(DetectorState.IDLE);
    });

    it('should have the correct agent type', () => {
      expect(detector.agentType).toBe('claude_code');
    });
  });

  describe('processChunk', () => {
    it('should return null for regular terminal output', () => {
      const result = detector.processChunk('$ ls -la\ntotal 42\n');
      expect(result).toBeNull();
    });

    it('should return null for partial prompt (no end marker)', () => {
      const result = detector.processChunk('Claude wants to run: Bash\nCommand: ls');
      expect(result).toBeNull();
    });

    it('should detect complete permission prompt in single chunk', () => {
      const prompt = 'Claude wants to run: Bash\n' + 'Command: ls -la\n' + 'Allow? (y)es / (n)o';

      const result = detector.processChunk(prompt);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('permission_request');
      expect(result?.agentType).toBe('claude_code');
      expect(result?.toolName).toBe('Bash');
    });

    it('should detect permission prompt arriving in chunks', () => {
      // Simulate chunked PTY output
      expect(detector.processChunk('Claude wants to ')).toBeNull();
      expect(detector.processChunk('run: Bash\n')).toBeNull();
      expect(detector.processChunk('Command: ls -la\n')).toBeNull();

      const result = detector.processChunk('Allow? (y)es / (n)o');
      expect(result).not.toBeNull();
      expect(result?.toolName).toBe('Bash');
    });

    it('should strip ANSI codes before detection', () => {
      const promptWithAnsi =
        '\x1b[1m\x1b[33mClaude wants to run:\x1b[0m Bash\n' +
        '\x1b[90mCommand:\x1b[0m git status\n' +
        '\x1b[90mAllow? (y)es / (n)o\x1b[0m';

      const result = detector.processChunk(promptWithAnsi);

      expect(result).not.toBeNull();
      expect(result?.toolName).toBe('Bash');
      expect(result?.command).toBe('git status');
    });

    it('should include raw text in detection result', () => {
      const prompt = 'Claude wants to run: Bash\nCommand: ls\nAllow? (y)es / (n)o';
      const result = detector.processChunk(prompt);

      expect(result?.rawText).toContain('Claude wants to run');
    });

    it('should include response map in detection result', () => {
      const prompt = 'Claude wants to run: Bash\nCommand: ls\nAllow? (y)es / (n)o';
      const result = detector.processChunk(prompt);

      expect(result?.responseMap).toBeDefined();
      expect(result?.responseMap.allow).toBeDefined();
      expect(result?.responseMap.deny).toBeDefined();
    });

    it('should generate unique IDs for each detection', () => {
      const prompt = 'Claude wants to run: Bash\nCommand: ls\nAllow? (y)es / (n)o';

      const result1 = detector.processChunk(prompt);
      detector.reset();
      const result2 = detector.processChunk(prompt);

      expect(result1?.id).not.toBe(result2?.id);
    });

    it('should include timestamp in detection result', () => {
      const prompt = 'Claude wants to run: Bash\nCommand: ls\nAllow? (y)es / (n)o';
      const beforeTime = new Date().toISOString();

      const result = detector.processChunk(prompt);

      const afterTime = new Date().toISOString();
      expect(result).not.toBeNull();
      expect(result?.detectedAt).toBeDefined();
      // TypeScript requires non-null assertion after the above checks
      expect(result!.detectedAt >= beforeTime).toBe(true);
      expect(result!.detectedAt <= afterTime).toBe(true);
    });
  });

  describe('state machine', () => {
    it('should transition from IDLE to COLLECTING_PROMPT on prompt start', () => {
      detector.processChunk('Claude wants to run: Bash');
      expect(detector.state).toBe(DetectorState.COLLECTING_PROMPT);
    });

    it('should return to IDLE after successful detection', () => {
      const prompt = 'Claude wants to run: Bash\nCommand: ls\nAllow? (y)es / (n)o';
      detector.processChunk(prompt);
      expect(detector.state).toBe(DetectorState.IDLE);
    });

    it('should stay in IDLE for non-prompt content', () => {
      detector.processChunk('$ ls -la\nfile1.txt  file2.txt');
      expect(detector.state).toBe(DetectorState.IDLE);
    });
  });

  describe('buffer management', () => {
    it('should handle large amounts of non-prompt data', () => {
      // Send 10KB of regular output
      const largeOutput = 'x'.repeat(10000);
      expect(() => detector.processChunk(largeOutput)).not.toThrow();
    });

    it('should maintain buffer limit (4KB)', () => {
      // Internal implementation detail - buffer should not grow unbounded
      const chunk = 'a'.repeat(1000);
      for (let i = 0; i < 10; i++) {
        detector.processChunk(chunk);
      }
      // Should not throw or cause memory issues
      expect(detector.state).toBe(DetectorState.IDLE);
    });

    it('should still detect prompts after buffer trimming', () => {
      // Fill buffer with noise
      const noise = 'x'.repeat(5000);
      detector.processChunk(noise);

      // Then send a valid prompt
      const prompt = 'Claude wants to run: Bash\nCommand: ls\nAllow? (y)es / (n)o';
      const result = detector.processChunk(prompt);

      // Should still detect the prompt
      expect(result).not.toBeNull();
    });
  });

  describe('debouncing', () => {
    it('should debounce rapid detections', async () => {
      const prompt = 'Claude wants to run: Bash\nCommand: ls\nAllow? (y)es / (n)o';

      const result1 = detector.processChunk(prompt);
      expect(result1).not.toBeNull();

      // Immediate re-detection should be debounced
      detector.reset();
      const result2 = detector.processChunk(prompt);
      expect(result2).toBeNull();

      // Wait for debounce period
      await new Promise((resolve) => setTimeout(resolve, 350));

      detector.reset();
      const result3 = detector.processChunk(prompt);
      expect(result3).not.toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset state to IDLE', () => {
      detector.processChunk('Claude wants to run: Bash');
      expect(detector.state).toBe(DetectorState.COLLECTING_PROMPT);

      detector.reset();
      expect(detector.state).toBe(DetectorState.IDLE);
    });

    it('should clear internal buffer', () => {
      detector.processChunk('Claude wants to run: Bash\nCommand: ls');
      detector.reset();

      // After reset, should need complete prompt again
      const result = detector.processChunk('Allow? (y)es / (n)o');
      expect(result).toBeNull();
    });
  });

  describe('dispose', () => {
    it('should reset state on dispose', () => {
      detector.processChunk('Claude wants to run: Bash');
      detector.dispose();
      expect(detector.state).toBe(DetectorState.IDLE);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string input', () => {
      const result = detector.processChunk('');
      expect(result).toBeNull();
    });

    it('should handle whitespace-only input', () => {
      const result = detector.processChunk('   \n\n   ');
      expect(result).toBeNull();
    });

    it('should handle prompt with unusual whitespace', () => {
      const prompt = '  Claude wants to run:  Bash  \n  Command: ls  \n  Allow? (y)es / (n)o  ';
      const result = detector.processChunk(prompt);
      expect(result).not.toBeNull();
    });

    it('should handle prompt with Windows line endings', () => {
      const prompt = 'Claude wants to run: Bash\r\nCommand: ls\r\nAllow? (y)es / (n)o';
      const result = detector.processChunk(prompt);
      expect(result).not.toBeNull();
    });

    it('should handle multiple prompt types (Read, Write, Edit)', () => {
      const tools = ['Read', 'Write', 'Edit', 'Bash'];

      for (const tool of tools) {
        // Create fresh detector for each test to avoid debounce interference
        const freshDetector = new TerminalActionDetector('claude_code');
        const prompt = `Claude wants to use: ${tool}\nAllow? (y)es / (n)o`;
        const result = freshDetector.processChunk(prompt);

        expect(result?.toolName).toBe(tool);
      }
    });
  });
});

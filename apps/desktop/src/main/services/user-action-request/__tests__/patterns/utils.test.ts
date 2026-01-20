/**
 * Tests for ANSI stripping and pattern utilities
 */

import { describe, expect, it } from 'vitest';
import { stripAnsi } from '../../patterns/utils';

describe('stripAnsi', () => {
  it('should return plain text unchanged', () => {
    const input = 'Hello, world!';
    expect(stripAnsi(input)).toBe('Hello, world!');
  });

  it('should strip basic color codes', () => {
    // Red text: \x1b[31m
    const input = '\x1b[31mError:\x1b[0m Something went wrong';
    expect(stripAnsi(input)).toBe('Error: Something went wrong');
  });

  it('should strip bold formatting', () => {
    // Bold: \x1b[1m
    const input = '\x1b[1mBold text\x1b[0m';
    expect(stripAnsi(input)).toBe('Bold text');
  });

  it('should strip multiple ANSI codes', () => {
    // Bold + red + reset
    const input = '\x1b[1m\x1b[31mWarning:\x1b[0m Check your input';
    expect(stripAnsi(input)).toBe('Warning: Check your input');
  });

  it('should strip cursor movement codes', () => {
    // Move cursor up 2 lines: \x1b[2A
    const input = '\x1b[2ALine content\x1b[0m';
    expect(stripAnsi(input)).toBe('Line content');
  });

  it('should strip SGR (Select Graphic Rendition) sequences', () => {
    // 256-color foreground: \x1b[38;5;196m (bright red)
    const input = '\x1b[38;5;196mBright red\x1b[0m';
    expect(stripAnsi(input)).toBe('Bright red');
  });

  it('should strip 24-bit RGB color codes', () => {
    // RGB foreground: \x1b[38;2;255;100;50m
    const input = '\x1b[38;2;255;100;50mRGB colored\x1b[0m';
    expect(stripAnsi(input)).toBe('RGB colored');
  });

  it('should handle real Claude Code permission prompt', () => {
    const input =
      '\x1b[1m\x1b[33m⚠️  Claude wants to run:\x1b[0m Bash\n' +
      '\x1b[90mCommand:\x1b[0m ls -la\n' +
      '\x1b[90mAllow? (y)es / (n)o:\x1b[0m';

    const expected =
      '⚠️  Claude wants to run: Bash\n' + 'Command: ls -la\n' + 'Allow? (y)es / (n)o:';

    expect(stripAnsi(input)).toBe(expected);
  });

  it('should handle empty string', () => {
    expect(stripAnsi('')).toBe('');
  });

  it('should handle string with only ANSI codes', () => {
    const input = '\x1b[31m\x1b[0m';
    expect(stripAnsi(input)).toBe('');
  });

  it('should preserve newlines and whitespace', () => {
    const input = '\x1b[1mLine 1\x1b[0m\n  \x1b[32mLine 2\x1b[0m\n';
    expect(stripAnsi(input)).toBe('Line 1\n  Line 2\n');
  });

  it('should handle OSC (Operating System Command) sequences', () => {
    // Terminal title: \x1b]0;Title\x07
    const input = '\x1b]0;My Terminal\x07Content here';
    expect(stripAnsi(input)).toBe('Content here');
  });
});

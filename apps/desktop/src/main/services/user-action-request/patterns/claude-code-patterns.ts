/**
 * Claude Code pattern provider for terminal permission prompt detection
 *
 * This provider contains regex patterns specific to Claude Code CLI
 * permission prompts and parsing logic.
 */

import type { ITerminalPatternProvider, TerminalPatterns } from '../interfaces';
import type { TerminalDetectedAction } from '../types';

/**
 * Pattern provider for Claude Code CLI permission prompts
 */
export class ClaudeCodePatternProvider implements ITerminalPatternProvider {
  getPatterns(): TerminalPatterns {
    return {
      promptStart: [
        // Standard permission prompt formats
        /Claude wants to (?:run|execute|use):/i,
        /Allow tool:/i,
        /Do you want to run/i,
      ],
      promptEnd: [
        // Various input prompt formats
        /\(y\)es\s*\/\s*\(n\)o/i,
        /\[Y\/n\]/i,
        /\[y\/N\]/i,
        /Allow\?\s*$/i,
      ],
      responseMap: {
        allow: 'y',
        deny: 'n',
      },
    };
  }

  parsePrompt(text: string, _matchedPattern: string): Partial<TerminalDetectedAction> | null {
    const result: Partial<TerminalDetectedAction> = {};

    // Extract tool name from various formats:
    // "Claude wants to run: Bash"
    // "Claude wants to use: Read"
    // "Claude wants to execute: Write"
    const toolMatch = text.match(/(?:run|execute|use):\s*(\w+)/i);
    if (toolMatch) {
      result.toolName = toolMatch[1];
    }

    // Extract command for Bash tool
    // "Command: ls -la"
    // "Command: git status --short"
    const commandMatch = text.match(/Command:\s*(.+?)(?:\n|$)/i);
    if (commandMatch) {
      result.command = commandMatch[1].trim();
    }

    // Extract file path from various formats:
    // "File: /path/to/file.ts"
    // "Path: /etc/passwd"
    const fileMatch = text.match(/(?:File|Path):\s*(.+?)(?:\n|$)/i);
    if (fileMatch) {
      result.filePath = fileMatch[1].trim();
    }

    // If we found at least a tool name, return the result
    if (result.toolName) {
      return result;
    }

    // No meaningful data extracted
    return null;
  }
}

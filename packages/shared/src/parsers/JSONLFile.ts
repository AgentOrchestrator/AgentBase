/**
 * JSONLFile - A class representing a JSONL file with field replacement capabilities
 *
 * Provides clean methods to modify fields like cwd, sessionId, and gitBranch
 * across all lines in a JSONL file, including deep replacement within message content.
 *
 * Design:
 * - Immutable: replaceFields() returns a new instance
 * - No file I/O: keeps the class pure and testable; callers handle file operations
 * - Deep replacement: cwd replacement also searches within message.content recursively
 */

import type { ClaudeCodeJsonlLine } from './types.js';

/**
 * Options for replacing fields in a JSONL file
 */
export interface JSONLFileReplaceOptions {
  /** New sessionId to set on all lines */
  sessionId?: string;
  /** Replace cwd paths (also replaces in message content recursively) */
  cwd?: { from: string; to: string };
  /** New gitBranch to set on all lines */
  gitBranch?: string;
}

/**
 * Represents a JSONL file with parsed lines and field replacement capabilities
 */
export class JSONLFile {
  private readonly lines: Array<{ parsed: ClaudeCodeJsonlLine | null; raw: string }>;

  /**
   * Create a JSONLFile from JSONL content string
   * @param content - Raw JSONL content (newline-separated JSON objects)
   */
  constructor(content: string) {
    this.lines = content.split('\n').map((raw) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        return { parsed: null, raw };
      }
      try {
        return { parsed: JSON.parse(trimmed) as ClaudeCodeJsonlLine, raw };
      } catch {
        return { parsed: null, raw };
      }
    });
  }

  /**
   * Private constructor for creating from pre-parsed lines
   */
  private static fromLines(
    lines: Array<{ parsed: ClaudeCodeJsonlLine | null; raw: string }>
  ): JSONLFile {
    const instance = Object.create(JSONLFile.prototype) as JSONLFile;
    (instance as unknown as { lines: typeof lines }).lines = lines;
    return instance;
  }

  /**
   * Get all parsed lines (excluding unparseable lines)
   */
  getLines(): ClaudeCodeJsonlLine[] {
    return this.lines
      .filter((line) => line.parsed !== null)
      .map((line) => line.parsed as ClaudeCodeJsonlLine);
  }

  /**
   * Replace fields across all lines (immutable - returns new instance)
   *
   * @param options - Fields to replace
   * @returns New JSONLFile instance with replaced values
   */
  replaceFields(options: JSONLFileReplaceOptions): JSONLFile {
    const newLines = this.lines.map((line) => {
      if (line.parsed === null) {
        return line;
      }

      let modified = { ...line.parsed };

      // Replace sessionId
      if (options.sessionId !== undefined) {
        modified.sessionId = options.sessionId;
      }

      // Replace gitBranch
      if (options.gitBranch !== undefined) {
        modified.gitBranch = options.gitBranch;
      }

      // Replace cwd (top-level and deep in content)
      if (options.cwd !== undefined) {
        const { from, to } = options.cwd;

        // Replace top-level cwd
        if (modified.cwd && typeof modified.cwd === 'string') {
          modified.cwd = modified.cwd.replace(from, to);
        }

        // Replace in message content (deep replacement)
        if (modified.message?.content) {
          modified = {
            ...modified,
            message: {
              ...modified.message,
              content: this.transformValue(modified.message.content, from, to),
            },
          };
        }

        // Replace in any other string fields that might contain paths
        for (const key of Object.keys(modified)) {
          if (
            key !== 'cwd' &&
            key !== 'message' &&
            typeof modified[key as keyof ClaudeCodeJsonlLine] === 'string'
          ) {
            const value = modified[key as keyof ClaudeCodeJsonlLine] as string;
            if (value.includes(from)) {
              (modified as Record<string, unknown>)[key] = value.replace(
                new RegExp(this.escapeRegex(from), 'g'),
                to
              );
            }
          }
        }
      }

      return {
        parsed: modified,
        raw: JSON.stringify(modified),
      };
    });

    return JSONLFile.fromLines(newLines);
  }

  /**
   * Recursively transform path values in nested structures
   */
  private transformValue(value: unknown, from: string, to: string): unknown {
    if (typeof value === 'string') {
      return value.replace(new RegExp(this.escapeRegex(from), 'g'), to);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.transformValue(item, from, to));
    }

    if (typeof value === 'object' && value !== null) {
      const transformed: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        transformed[key] = this.transformValue(val, from, to);
      }
      return transformed;
    }

    return value;
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Serialize back to JSONL string
   */
  toString(): string {
    return this.lines
      .map((line) => {
        if (line.parsed === null) {
          return line.raw;
        }
        return JSON.stringify(line.parsed);
      })
      .join('\n');
  }
}

/**
 * Interface for terminal pattern providers
 *
 * Each coding agent (Claude Code, Cursor, Codex, etc.) has different
 * permission prompt formats. Pattern providers encapsulate the regex
 * patterns and parsing logic for each agent type.
 */

import type { TerminalDetectedAction, TerminalResponseMap } from '../types';

/**
 * Collection of patterns for detecting permission prompts
 */
export interface TerminalPatterns {
  /** Patterns that indicate start of permission prompt */
  promptStart: RegExp[];

  /** Patterns that indicate end of prompt (ready for input) */
  promptEnd: RegExp[];

  /** Response key mappings for allow/deny */
  responseMap: TerminalResponseMap;
}

/**
 * Interface for agent-specific pattern providers
 */
export interface ITerminalPatternProvider {
  /**
   * Get the patterns for this agent type
   */
  getPatterns(): TerminalPatterns;

  /**
   * Parse detected prompt text into structured action data
   *
   * @param text - The normalized terminal text (ANSI stripped)
   * @param matchedPattern - Identifier of the pattern that matched
   * @returns Partial action data extracted from the prompt, or null if parsing fails
   */
  parsePrompt(text: string, matchedPattern: string): Partial<TerminalDetectedAction> | null;
}

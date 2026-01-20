/**
 * Action types for terminal permission prompt detection
 *
 * These types represent detected actions from terminal output
 * that require user interaction (permission requests, clarifying questions).
 */

import type { CodingAgentType } from '../../coding-agent';

/**
 * Represents a detected action from terminal output requiring user response
 */
export interface TerminalDetectedAction {
  /** Unique identifier for this action */
  id: string;

  /** Type of action detected */
  type: 'permission_request' | 'clarifying_question';

  /** Type of coding agent that generated this prompt */
  agentType: CodingAgentType;

  /** Terminal ID where this was detected */
  terminalId: string;

  /** ISO timestamp when detected */
  detectedAt: string;

  // Permission-specific fields
  /** Tool name being requested (e.g., 'Bash', 'Read', 'Write') */
  toolName?: string;

  /** Command to execute (for Bash tool) */
  command?: string;

  /** File path being accessed (for file operations) */
  filePath?: string;

  /** Working directory context */
  workingDirectory?: string;

  // Question-specific fields
  /** Array of questions with optional predefined options */
  questions?: Array<{ question: string; options?: string[] }>;

  // Raw detection data
  /** Original terminal output with ANSI codes */
  rawText: string;

  /** Normalized text with ANSI codes stripped */
  normalizedText: string;

  /** Pattern that matched this detection */
  matchedPattern: string;

  /** Maps user decisions to terminal input strings */
  responseMap: TerminalResponseMap;
}

/**
 * Maps user UI decisions to actual terminal input strings
 */
export interface TerminalResponseMap {
  /** String to write for "allow" decision (e.g., "y") */
  allow: string;

  /** String to write for "deny" decision (e.g., "n") */
  deny: string;
}

/**
 * Response to a terminal action - sent from UI back to terminal
 */
export type TerminalActionResponse =
  | {
      actionId: string;
      type: 'approval';
      decision: 'allow' | 'deny';
      message?: string;
    }
  | {
      actionId: string;
      type: 'answer';
      answers: Record<string, string>;
    };

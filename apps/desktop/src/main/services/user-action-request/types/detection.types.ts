/**
 * Detection state machine types for terminal action detection
 */

import type { TerminalDetectedAction } from './action.types';

/**
 * States for the terminal action detector state machine
 */
export enum DetectorState {
  /** Waiting for prompt start pattern */
  IDLE = 'IDLE',

  /** Collecting prompt content after start detected */
  COLLECTING_PROMPT = 'COLLECTING_PROMPT',

  /** Prompt complete, ready for user input */
  AWAITING_INPUT = 'AWAITING_INPUT',
}

/**
 * Result of processing a terminal data chunk
 */
export interface DetectionResult {
  /** Whether a complete action was detected */
  detected: boolean;

  /** The detected action if detected is true */
  action?: TerminalDetectedAction;
}

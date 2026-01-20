/**
 * Interface for terminal action detectors
 *
 * Detectors process terminal output and identify permission prompts
 * or clarifying questions that require user interaction.
 */

import type { CodingAgentType } from '../../coding-agent';
import type { DetectorState, TerminalDetectedAction } from '../types';

/**
 * Interface for terminal action detection
 */
export interface ITerminalActionDetector {
  /**
   * Process incoming terminal data chunk
   *
   * @param data - Raw terminal output (may include ANSI codes)
   * @returns Detected action if a complete prompt was found, null otherwise
   */
  processChunk(data: string): TerminalDetectedAction | null;

  /**
   * Reset detector state (e.g., on session end or manual reset)
   */
  reset(): void;

  /**
   * Dispose of detector resources
   */
  dispose(): void;

  /**
   * Current detector state
   */
  readonly state: DetectorState;

  /**
   * Agent type this detector handles
   */
  readonly agentType: CodingAgentType;
}

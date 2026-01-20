/**
 * Terminal Action Detector implementation
 *
 * Detects permission prompts and clarifying questions from terminal output
 * using a state machine approach to handle multi-line prompts arriving in chunks.
 */

import * as crypto from 'node:crypto';
import type { CodingAgentType } from '../../coding-agent';
import type { ITerminalActionDetector, ITerminalPatternProvider } from '../interfaces';
import { ClaudeCodePatternProvider, stripAnsi } from '../patterns';
import type { TerminalDetectedAction } from '../types';
import { DetectorState } from '../types';

/**
 * Get the appropriate pattern provider for an agent type
 */
function getPatternProvider(agentType: CodingAgentType): ITerminalPatternProvider {
  switch (agentType) {
    case 'claude_code':
      return new ClaudeCodePatternProvider();
    default:
      // Default to Claude Code patterns for now
      return new ClaudeCodePatternProvider();
  }
}

/**
 * Terminal action detector that processes PTY output and detects permission prompts
 */
export class TerminalActionDetector implements ITerminalActionDetector {
  readonly agentType: CodingAgentType;

  private _state = DetectorState.IDLE;
  private buffer = '';
  private readonly maxBufferSize = 4096; // 4KB
  private readonly patterns: ITerminalPatternProvider;
  private lastDetectionTime = 0;
  private readonly debounceMs = 300;

  constructor(agentType: CodingAgentType, patterns?: ITerminalPatternProvider) {
    this.agentType = agentType;
    this.patterns = patterns ?? getPatternProvider(agentType);
  }

  get state(): DetectorState {
    return this._state;
  }

  processChunk(data: string): TerminalDetectedAction | null {
    // Strip ANSI codes for pattern matching
    const normalized = stripAnsi(data);
    this.buffer += normalized;

    // Trim buffer if too large (keep last 4KB)
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer = this.buffer.slice(-this.maxBufferSize);
    }

    return this.detect();
  }

  private detect(): TerminalDetectedAction | null {
    const terminalPatterns = this.patterns.getPatterns();

    switch (this._state) {
      case DetectorState.IDLE: {
        // Look for prompt start
        const startsMatch = terminalPatterns.promptStart.some((pattern) =>
          pattern.test(this.buffer)
        );
        if (startsMatch) {
          this._state = DetectorState.COLLECTING_PROMPT;
        }
        // Check if we also have the end (complete prompt in one chunk)
        if (this._state === DetectorState.COLLECTING_PROMPT) {
          return this.checkForCompletePrompt(terminalPatterns);
        }
        return null;
      }

      case DetectorState.COLLECTING_PROMPT: {
        return this.checkForCompletePrompt(terminalPatterns);
      }

      default:
        return null;
    }
  }

  private checkForCompletePrompt(
    terminalPatterns: ReturnType<ITerminalPatternProvider['getPatterns']>
  ): TerminalDetectedAction | null {
    // Look for prompt end (ready for user input)
    const endsMatch = terminalPatterns.promptEnd.some((pattern) => pattern.test(this.buffer));

    if (endsMatch) {
      // Debounce rapid detections
      const now = Date.now();
      if (now - this.lastDetectionTime < this.debounceMs) {
        this.reset();
        return null;
      }
      this.lastDetectionTime = now;

      const action = this.createAction(terminalPatterns);
      this.reset();
      return action;
    }

    return null;
  }

  private createAction(
    terminalPatterns: ReturnType<ITerminalPatternProvider['getPatterns']>
  ): TerminalDetectedAction {
    const parsed = this.patterns.parsePrompt(this.buffer, 'detected');

    return {
      id: crypto.randomUUID(),
      type: 'permission_request',
      agentType: this.agentType,
      terminalId: '', // Will be set by manager
      detectedAt: new Date().toISOString(),
      rawText: this.buffer,
      normalizedText: this.buffer,
      matchedPattern: 'permission_prompt',
      responseMap: terminalPatterns.responseMap,
      toolName: parsed?.toolName,
      command: parsed?.command,
      filePath: parsed?.filePath,
      workingDirectory: parsed?.workingDirectory,
    };
  }

  reset(): void {
    this._state = DetectorState.IDLE;
    this.buffer = '';
  }

  dispose(): void {
    this.reset();
  }
}

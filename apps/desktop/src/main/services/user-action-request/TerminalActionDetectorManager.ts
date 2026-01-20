/**
 * Terminal Action Detector Manager
 *
 * Singleton manager that coordinates terminal action detectors for multiple terminals.
 * Integrates with the agent event bridge to emit events and handle responses.
 */

import type { AgentActionResponse } from '@agent-orchestrator/shared';
import type { CodingAgentType } from '../coding-agent';
import { awaitAgentActionResponse, emitAgentEvent } from '../coding-agent/agent-event-bridge';
import { TerminalActionDetector } from './implementations/TerminalActionDetector';
import type { ITerminalActionDetector } from './interfaces';
import type { TerminalDetectedAction } from './types';

interface PendingAction {
  terminalId: string;
  action: TerminalDetectedAction;
}

/**
 * Manager that coordinates terminal action detectors for multiple terminals
 */
export class TerminalActionDetectorManager {
  private detectors = new Map<string, ITerminalActionDetector>();
  private ptyWriters = new Map<string, (data: string) => void>();
  private pendingActions = new Map<string, PendingAction>();

  /**
   * Attach a detector to a terminal
   *
   * @param terminalId - Unique identifier for the terminal
   * @param agentType - Type of coding agent running in the terminal
   * @param ptyWriter - Function to write data to the PTY process
   */
  attach(terminalId: string, agentType: CodingAgentType, ptyWriter: (data: string) => void): void {
    // Dispose existing detector if any
    const existing = this.detectors.get(terminalId);
    if (existing) {
      existing.dispose();
    }

    const detector = new TerminalActionDetector(agentType);
    this.detectors.set(terminalId, detector);
    this.ptyWriters.set(terminalId, ptyWriter);
  }

  /**
   * Process terminal output and detect action prompts
   *
   * @param terminalId - Terminal identifier
   * @param data - Raw terminal output data
   */
  async processOutput(terminalId: string, data: string): Promise<void> {
    const detector = this.detectors.get(terminalId);
    if (!detector) {
      return;
    }

    const action = detector.processChunk(data);
    if (action) {
      action.terminalId = terminalId;
      this.pendingActions.set(action.id, { terminalId, action });

      // Emit to UI via existing bridge
      emitAgentEvent({
        id: action.id,
        type: 'permission:request',
        agent: action.agentType,
        timestamp: action.detectedAt,
        payload: {
          toolName: action.toolName ?? 'Unknown',
          command: action.command,
          filePath: action.filePath,
          workingDirectory: action.workingDirectory,
          rawPrompt: action.rawText,
        },
        raw: {
          terminalId,
          responseMap: action.responseMap,
        },
      });

      // Await response and write to PTY
      try {
        const response = await awaitAgentActionResponse(action.id);
        this.handleResponse(action.id, response);
      } catch (error) {
        console.error('[TerminalActionDetectorManager] Response error:', error);
        // Clean up pending action on error
        this.pendingActions.delete(action.id);
      }
    }
  }

  /**
   * Handle user response to an action
   */
  private handleResponse(actionId: string, response: AgentActionResponse): void {
    const pending = this.pendingActions.get(actionId);
    if (!pending) {
      return;
    }

    const { terminalId, action } = pending;
    const ptyWriter = this.ptyWriters.get(terminalId);

    // Terminal may have been detached while waiting for response
    if (!ptyWriter) {
      this.pendingActions.delete(actionId);
      return;
    }

    // Map response to terminal input
    if (response.type === 'tool_approval') {
      const key =
        response.decision === 'allow' ? action.responseMap.allow : action.responseMap.deny;
      ptyWriter(key);
    }

    this.pendingActions.delete(actionId);
  }

  /**
   * Detach a terminal and clean up resources
   *
   * @param terminalId - Terminal identifier to detach
   */
  detach(terminalId: string): void {
    const detector = this.detectors.get(terminalId);
    if (detector) {
      detector.dispose();
    }

    this.detectors.delete(terminalId);
    this.ptyWriters.delete(terminalId);

    // Cancel any pending actions for this terminal
    for (const [actionId, pending] of this.pendingActions) {
      if (pending.terminalId === terminalId) {
        this.pendingActions.delete(actionId);
      }
    }
  }
}

// Singleton instance
let managerInstance: TerminalActionDetectorManager | null = null;

/**
 * Get the singleton terminal action detector manager
 */
export function getTerminalActionDetectorManager(): TerminalActionDetectorManager {
  if (!managerInstance) {
    managerInstance = new TerminalActionDetectorManager();
  }
  return managerInstance;
}

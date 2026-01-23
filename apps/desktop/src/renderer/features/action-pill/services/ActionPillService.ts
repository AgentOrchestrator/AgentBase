/**
 * ActionPill Service Implementation
 *
 * Handles business logic for submitting action responses to the coding agent API.
 * Separates API calls and store mutations from UI components.
 *
 * Supports two response channels:
 * 1. SDK-based agents: Uses codingAgentAPI.respondToAction IPC
 * 2. Terminal-based agents: Sends keystrokes to the terminal PTY
 */

import type {
  ClarifyingQuestionAction,
  ToolApprovalAction,
  ToolApprovalDecision,
} from '@agent-orchestrator/shared';
import { useActionPillStore } from '../store';
import type { IActionPillService } from './IActionPillService';

/**
 * Map decision to Claude Code terminal keystroke.
 * Claude Code uses @inquirer/prompts for interactive menus:
 *   ❯ 1. Yes
 *     2. Yes, allow all edits during this session (shift+tab)
 *     3. No
 *   Esc to cancel
 *
 * Based on testing, Claude Code accepts single number keys directly
 * (no Enter needed) to select the option.
 */
function decisionToKeystroke(decision: ToolApprovalDecision): string {
  switch (decision) {
    case 'allow':
      return '1'; // Just the number key
    case 'allow_all':
      return '2';
    case 'deny':
      return '3';
  }
}

/**
 * ActionPillService implementation
 *
 * Note: This is a stateless service that operates on the Zustand store.
 * It can be used as a singleton or instantiated per-use.
 */
class ActionPillServiceImpl implements IActionPillService {
  async submitToolApproval(
    action: ToolApprovalAction,
    decision: ToolApprovalDecision
  ): Promise<void> {
    const store = useActionPillStore.getState();
    const isDummyAction = action.id.startsWith('dummy-action-') || action.id.startsWith('debug-');
    const isTerminalAction = action.terminalId != null;

    store.setSubmitting(action.id, true);

    try {
      if (isDummyAction) {
        // For dummy/debug actions, just remove from store
        store.removeAction(action.id);
      } else if (isTerminalAction) {
        // Terminal-based action: send keystroke to terminal PTY
        const keystroke = decisionToKeystroke(decision);
        console.log('[ActionPillService] Sending terminal response', {
          terminalId: action.terminalId,
          decision,
          keystroke: JSON.stringify(keystroke),
        });
        window.electronAPI.sendTerminalInput(action.terminalId, keystroke);
        store.removeAction(action.id);
      } else if (window.codingAgentAPI?.respondToAction) {
        // SDK-based action: use IPC response channel
        await window.codingAgentAPI.respondToAction({
          actionId: action.id,
          type: 'tool_approval',
          decision,
        });
        store.removeAction(action.id);
      } else {
        console.warn('[ActionPillService] No response channel available for action', action.id);
      }
    } finally {
      store.setSubmitting(action.id, false);
    }
  }

  async submitClarifyingQuestion(
    action: ClarifyingQuestionAction,
    answers: Record<string, string>
  ): Promise<void> {
    const store = useActionPillStore.getState();
    const isDummyAction = action.id.startsWith('dummy-action-') || action.id.startsWith('debug-');

    // Normalize answers to only include questions that have values
    const normalizedAnswers: Record<string, string> = {};
    for (const question of action.questions) {
      const value = answers[question.question];
      if (value) {
        normalizedAnswers[question.question] = value;
      }
    }

    store.setSubmitting(action.id, true);

    try {
      if (isDummyAction) {
        store.removeAction(action.id);
        store.clearActionAnswers(action.id);
      } else if (window.codingAgentAPI?.respondToAction) {
        await window.codingAgentAPI.respondToAction({
          actionId: action.id,
          type: 'clarifying_question',
          answers: normalizedAnswers,
        });
        store.removeAction(action.id);
        store.clearActionAnswers(action.id);
      } else {
        console.warn('[ActionPillService] codingAgentAPI.respondToAction not available');
      }
    } finally {
      store.setSubmitting(action.id, false);
    }
  }

  /**
   * Submit an option selection for a clarifying question.
   * For terminal-based actions, sends the option number as a keystroke.
   * Claude Code's @inquirer/prompts accepts single number keys to select options.
   */
  async submitOptionSelection(
    action: ClarifyingQuestionAction,
    _questionIndex: number,
    optionIndex: number
  ): Promise<void> {
    const store = useActionPillStore.getState();
    const isDummyAction = action.id.startsWith('dummy-action-') || action.id.startsWith('debug-');
    const isTerminalAction = action.terminalId != null;

    store.setSubmitting(action.id, true);

    try {
      if (isDummyAction) {
        store.removeAction(action.id);
      } else if (isTerminalAction) {
        // Terminal-based action: send option number as keystroke (1-indexed)
        const keystroke = String(optionIndex + 1);
        console.log('[ActionPillService] Sending terminal option selection', {
          terminalId: action.terminalId,
          optionIndex,
          keystroke,
        });
        window.electronAPI.sendTerminalInput(action.terminalId!, keystroke);
        store.removeAction(action.id);
      } else if (window.codingAgentAPI?.respondToAction) {
        // SDK-based action: build answer from selected option
        const question = action.questions[_questionIndex];
        const selectedOption = question?.options?.[optionIndex];
        if (question && selectedOption) {
          await window.codingAgentAPI.respondToAction({
            actionId: action.id,
            type: 'clarifying_question',
            answers: { [question.question]: selectedOption.label },
          });
        }
        store.removeAction(action.id);
      } else {
        console.warn('[ActionPillService] No response channel available for action', action.id);
      }
    } finally {
      store.setSubmitting(action.id, false);
    }
  }
}

/**
 * Singleton service instance
 */
export const actionPillService: IActionPillService = new ActionPillServiceImpl();

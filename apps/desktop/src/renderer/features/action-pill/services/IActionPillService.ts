/**
 * ActionPill Service Interface
 *
 * Defines the contract for business logic operations on actions.
 */

import type {
  ClarifyingQuestionAction,
  ToolApprovalAction,
  ToolApprovalDecision,
} from '@agent-orchestrator/shared';

export interface IActionPillService {
  /**
   * Submit a tool approval decision (allow/deny/allow_all)
   */
  submitToolApproval(action: ToolApprovalAction, decision: ToolApprovalDecision): Promise<void>;

  /**
   * Submit answers to clarifying questions
   */
  submitClarifyingQuestion(
    action: ClarifyingQuestionAction,
    answers: Record<string, string>
  ): Promise<void>;

  /**
   * Submit a selected option for a clarifying question.
   * For terminal-based actions, sends the option number as a keystroke.
   */
  submitOptionSelection(
    action: ClarifyingQuestionAction,
    questionIndex: number,
    optionIndex: number
  ): Promise<void>;
}

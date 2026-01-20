/**
 * ActionPill Service Interface
 *
 * Defines the contract for business logic operations on actions.
 */

import type { ClarifyingQuestionAction, ToolApprovalAction } from '@agent-orchestrator/shared';

export interface IActionPillService {
  /**
   * Submit a tool approval decision (allow/deny)
   */
  submitToolApproval(
    action: ToolApprovalAction,
    decision: 'allow' | 'deny'
  ): Promise<void>;

  /**
   * Submit answers to clarifying questions
   */
  submitClarifyingQuestion(
    action: ClarifyingQuestionAction,
    answers: Record<string, string>
  ): Promise<void>;
}

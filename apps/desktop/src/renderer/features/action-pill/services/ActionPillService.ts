/**
 * ActionPill Service Implementation
 *
 * Handles business logic for submitting action responses to the coding agent API.
 * Separates API calls and store mutations from UI components.
 */

import type { ClarifyingQuestionAction, ToolApprovalAction } from '@agent-orchestrator/shared';
import { useActionPillStore } from '../store';
import type { IActionPillService } from './IActionPillService';

/**
 * ActionPillService implementation
 *
 * Note: This is a stateless service that operates on the Zustand store.
 * It can be used as a singleton or instantiated per-use.
 */
class ActionPillServiceImpl implements IActionPillService {
  async submitToolApproval(action: ToolApprovalAction, decision: 'allow' | 'deny'): Promise<void> {
    const store = useActionPillStore.getState();
    const isDummyAction = action.id.startsWith('dummy-action-') || action.id.startsWith('debug-');

    store.setSubmitting(action.id, true);

    try {
      if (isDummyAction) {
        // For dummy/debug actions, just remove from store
        store.removeAction(action.id);
      } else if (window.codingAgentAPI?.respondToAction) {
        await window.codingAgentAPI.respondToAction({
          actionId: action.id,
          type: 'tool_approval',
          decision,
        });
        store.removeAction(action.id);
      } else {
        console.warn('[ActionPillService] codingAgentAPI.respondToAction not available');
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
}

/**
 * Singleton service instance
 */
export const actionPillService: IActionPillService = new ActionPillServiceImpl();

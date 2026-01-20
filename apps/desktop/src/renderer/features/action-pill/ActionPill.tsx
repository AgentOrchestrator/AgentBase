/**
 * ActionPill Container Component
 *
 * Connects the ActionPill feature to the Zustand store and service layer.
 * Handles keyboard shortcuts and delegates rendering to the presentation component.
 */

import type {
  ClarifyingQuestionAction,
  ToolApprovalAction,
} from '@agent-orchestrator/shared';
import { useCallback, useEffect } from 'react';
import './ActionPill.css';
import { ActionPillPresentation } from './ActionPillPresentation';
import { useActionPillHighlight } from './hooks';
import { actionPillService } from './services';
import { selectSortedActions, useActionPillStore } from './store';

export function ActionPill() {
  // Store state
  const sortedActions = useActionPillStore(selectSortedActions);
  const isExpanded = useActionPillStore((state) => state.isExpanded);
  const animationState = useActionPillStore((state) => state.animationState);
  const actionAnswers = useActionPillStore((state) => state.actionAnswers);
  const submittingActions = useActionPillStore((state) => state.submittingActions);

  // Store actions
  const expand = useActionPillStore((state) => state.expand);
  const collapse = useActionPillStore((state) => state.collapse);
  const updateActionAnswer = useActionPillStore((state) => state.updateActionAnswer);

  // Highlight state
  const { shouldHighlightPill } = useActionPillHighlight();

  const hasActions = sortedActions.length > 0;

  // Toggle handler
  const handleToggle = useCallback(() => {
    if (!hasActions) return;
    if (isExpanded) {
      collapse();
    } else {
      expand();
    }
  }, [hasActions, isExpanded, expand, collapse]);

  // Submit handlers using service
  const handleSubmitClarifying = useCallback(
    async (action: ClarifyingQuestionAction) => {
      const answers = actionAnswers[action.id] || {};
      await actionPillService.submitClarifyingQuestion(action, answers);
    },
    [actionAnswers]
  );

  const handleToolApproval = useCallback(
    async (action: ToolApprovalAction, decision: 'allow' | 'deny') => {
      await actionPillService.submitToolApproval(action, decision);
    },
    []
  );

  // Keyboard shortcuts: Tab to open, Shift+Tab to close
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't interfere if user is typing in an input/textarea
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Tab to open pill (only if not already expanded)
      if (event.key === 'Tab' && !event.shiftKey) {
        if (!isExpanded && hasActions) {
          event.preventDefault();
          expand();
        }
        return;
      }

      // Shift+Tab to close pill (only if expanded)
      if (event.key === 'Tab' && event.shiftKey) {
        if (isExpanded) {
          event.preventDefault();
          collapse();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpanded, hasActions, expand, collapse]);

  // Keyboard shortcuts: Enter to accept, Delete/Backspace to deny (topmost action)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't interfere if user is typing in an input/textarea
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Enter to accept topmost tool approval action
      if (event.key === 'Enter' && isExpanded && sortedActions.length > 0) {
        const topAction = sortedActions[0];
        if (topAction.type === 'tool_approval' && !submittingActions.has(topAction.id)) {
          event.preventDefault();
          handleToolApproval(topAction as ToolApprovalAction, 'allow');
        }
        return;
      }

      // Delete/Backspace to deny topmost tool approval action
      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        isExpanded &&
        sortedActions.length > 0
      ) {
        const topAction = sortedActions[0];
        if (topAction.type === 'tool_approval' && !submittingActions.has(topAction.id)) {
          event.preventDefault();
          handleToolApproval(topAction as ToolApprovalAction, 'deny');
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpanded, sortedActions, submittingActions, handleToolApproval]);

  return (
    <ActionPillPresentation
      actions={sortedActions}
      actionAnswers={actionAnswers}
      submittingActions={submittingActions}
      isExpanded={isExpanded}
      animationState={animationState}
      shouldHighlightPill={shouldHighlightPill}
      onToggle={handleToggle}
      onCollapse={collapse}
      onUpdateAnswer={updateActionAnswer}
      onSubmitClarifying={handleSubmitClarifying}
      onToolApproval={handleToolApproval}
    />
  );
}

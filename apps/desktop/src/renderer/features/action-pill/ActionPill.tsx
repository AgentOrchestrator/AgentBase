/**
 * ActionPill Container Component
 *
 * Connects the ActionPill feature to the Zustand store and service layer.
 * Handles keyboard shortcuts and delegates rendering to the presentation component.
 */

import type {
  ClarifyingQuestionAction,
  ToolApprovalAction,
  ToolApprovalDecision,
} from '@agent-orchestrator/shared';
import { useCallback, useEffect } from 'react';
import './ActionPill.css';
import { ActionPillPresentation } from './ActionPillPresentation';
import { useActionPillHighlight, useToolCompletionService } from './hooks';
import { actionPillService } from './services';
import { selectActiveAction, selectSortedActions, useActionPillStore } from './store';

export function ActionPill() {
  // Store state
  const sortedActions = useActionPillStore(selectSortedActions);
  const activeAction = useActionPillStore(selectActiveAction);
  const isExpanded = useActionPillStore((state) => state.isExpanded);
  const animationState = useActionPillStore((state) => state.animationState);
  const actionAnswers = useActionPillStore((state) => state.actionAnswers);
  const submittingActions = useActionPillStore((state) => state.submittingActions);

  // Store actions
  const expand = useActionPillStore((state) => state.expand);
  const collapse = useActionPillStore((state) => state.collapse);
  const updateActionAnswer = useActionPillStore((state) => state.updateActionAnswer);
  const cycleActiveAgent = useActionPillStore((state) => state.cycleActiveAgent);

  // Highlight state
  const { shouldHighlightPill } = useActionPillHighlight();

  // Initialize tool completion service for auto-dismissal
  useToolCompletionService();

  // Dismissing actions for visual feedback
  const dismissingActions = useActionPillStore((state) => state.dismissingActions);

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

  const handleSelectOption = useCallback(
    async (action: ClarifyingQuestionAction, questionIndex: number, optionIndex: number) => {
      await actionPillService.submitOptionSelection(action, questionIndex, optionIndex);
    },
    []
  );

  const handleToolApproval = useCallback(
    async (action: ToolApprovalAction, decision: ToolApprovalDecision) => {
      await actionPillService.submitToolApproval(action, decision);
    },
    []
  );

  // Keyboard shortcuts: Tab/Shift+Tab to toggle, Enter to accept, Delete/Backspace to deny
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
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

      // ArrowDown to cycle to next agent (when expanded)
      if (event.key === 'ArrowDown' && isExpanded) {
        event.preventDefault();
        cycleActiveAgent('next');
        return;
      }

      // ArrowUp to cycle to previous agent (when expanded)
      if (event.key === 'ArrowUp' && isExpanded) {
        event.preventDefault();
        cycleActiveAgent('prev');
        return;
      }

      // Enter to accept active tool approval action
      if (event.key === 'Enter' && isExpanded && activeAction) {
        if (activeAction.type === 'tool_approval' && !submittingActions.has(activeAction.id)) {
          event.preventDefault();
          handleToolApproval(activeAction as ToolApprovalAction, 'allow');
        }
        return;
      }

      // Delete/Backspace to deny active tool approval action
      if ((event.key === 'Delete' || event.key === 'Backspace') && isExpanded && activeAction) {
        if (activeAction.type === 'tool_approval' && !submittingActions.has(activeAction.id)) {
          event.preventDefault();
          handleToolApproval(activeAction as ToolApprovalAction, 'deny');
        }
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isExpanded,
    hasActions,
    expand,
    collapse,
    activeAction,
    cycleActiveAgent,
    submittingActions,
    handleToolApproval,
  ]);

  return (
    <ActionPillPresentation
      actions={sortedActions}
      actionAnswers={actionAnswers}
      submittingActions={submittingActions}
      dismissingActions={dismissingActions}
      isExpanded={isExpanded}
      animationState={animationState}
      shouldHighlightPill={shouldHighlightPill}
      onToggle={handleToggle}
      onCollapse={collapse}
      onUpdateAnswer={updateActionAnswer}
      onSubmitClarifying={handleSubmitClarifying}
      onSelectOption={handleSelectOption}
      onToolApproval={handleToolApproval}
    />
  );
}

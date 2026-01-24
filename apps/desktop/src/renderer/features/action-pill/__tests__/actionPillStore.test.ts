/**
 * ActionPill Store Tests
 */

import type { ToolApprovalAction } from '@agent-orchestrator/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useActionPillStore } from '../store/actionPillStore';

// Mock action data with proper types
function createMockToolApproval(id: string, agentId: string): ToolApprovalAction {
  return {
    id,
    type: 'tool_approval',
    agentId,
    sessionId: 'session-1',
    workspacePath: '/Users/test/project',
    gitBranch: 'main',
    toolUseId: `tool-${id}`,
    createdAt: new Date().toISOString(),
    toolName: 'Bash',
    command: 'ls -la',
  };
}

describe('ActionPillStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useActionPillStore.setState({
      actions: [],
      isExpanded: false,
      hasNewActions: false,
      animationState: {
        isSquare: false,
        showContent: false,
        isContentVisible: false,
        isTextVisible: true,
      },
      actionAnswers: {},
      submittingActions: new Set(),
      highlightedAgentId: null,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('addAction', () => {
    it('should add an action to the store', () => {
      const action = createMockToolApproval('action-1', 'agent-1');
      useActionPillStore.getState().addAction(action);

      const state = useActionPillStore.getState();
      expect(state.actions).toHaveLength(1);
      expect(state.actions[0].id).toBe('action-1');
    });

    it('should set hasNewActions to true when action is added', () => {
      const action = createMockToolApproval('action-1', 'agent-1');
      useActionPillStore.getState().addAction(action);

      expect(useActionPillStore.getState().hasNewActions).toBe(true);
    });

    it('should not add duplicate actions', () => {
      const action = createMockToolApproval('action-1', 'agent-1');
      useActionPillStore.getState().addAction(action);
      useActionPillStore.getState().addAction(action);

      expect(useActionPillStore.getState().actions).toHaveLength(1);
    });

    it('should update highlightedAgentId when expanded and action added', () => {
      // First expand the pill
      useActionPillStore.setState({ isExpanded: true });

      const action = createMockToolApproval('action-1', 'agent-1');
      useActionPillStore.getState().addAction(action);

      expect(useActionPillStore.getState().highlightedAgentId).toBe('agent-1');
    });
  });

  describe('removeAction', () => {
    it('should remove an action from the store', () => {
      const action = createMockToolApproval('action-1', 'agent-1');
      useActionPillStore.getState().addAction(action);
      useActionPillStore.getState().removeAction('action-1');

      expect(useActionPillStore.getState().actions).toHaveLength(0);
    });

    it('should collapse pill when last action is removed', () => {
      const action = createMockToolApproval('action-1', 'agent-1');
      useActionPillStore.getState().addAction(action);
      useActionPillStore.setState({ isExpanded: true });

      useActionPillStore.getState().removeAction('action-1');

      const state = useActionPillStore.getState();
      expect(state.isExpanded).toBe(false);
      expect(state.hasNewActions).toBe(false);
      expect(state.highlightedAgentId).toBeNull();
    });

    it('should update highlightedAgentId to next action when current is removed', () => {
      const action1 = createMockToolApproval('action-1', 'agent-1');
      const action2 = createMockToolApproval('action-2', 'agent-2');

      // Add actions with different timestamps
      useActionPillStore.getState().addAction({ ...action1, createdAt: '2024-01-01T00:00:00Z' });
      useActionPillStore.getState().addAction({ ...action2, createdAt: '2024-01-01T00:01:00Z' });

      // Use expand() to properly set highlightedAgentId (not just setState)
      useActionPillStore.getState().expand();

      // Check initial state
      const state = useActionPillStore.getState();
      expect(state.highlightedAgentId).toBe('agent-1'); // First action (earliest timestamp)

      // Remove first action
      useActionPillStore.getState().removeAction('action-1');
      expect(useActionPillStore.getState().highlightedAgentId).toBe('agent-2');
    });
  });

  describe('clearAgent', () => {
    it('should remove all actions for a specific agent', () => {
      useActionPillStore.getState().addAction(createMockToolApproval('action-1', 'agent-1'));
      useActionPillStore.getState().addAction(createMockToolApproval('action-2', 'agent-1'));
      useActionPillStore.getState().addAction(createMockToolApproval('action-3', 'agent-2'));

      useActionPillStore.getState().clearAgent('agent-1');

      const state = useActionPillStore.getState();
      expect(state.actions).toHaveLength(1);
      expect(state.actions[0].agentId).toBe('agent-2');
    });
  });

  describe('expand/collapse', () => {
    it('should expand the pill when there are actions', () => {
      const action = createMockToolApproval('action-1', 'agent-1');
      useActionPillStore.getState().addAction(action);

      useActionPillStore.getState().expand();

      const state = useActionPillStore.getState();
      expect(state.isExpanded).toBe(true);
      expect(state.hasNewActions).toBe(false); // Cleared on expand
      expect(state.animationState.isSquare).toBe(true);
    });

    it('should not expand when there are no actions', () => {
      useActionPillStore.getState().expand();

      expect(useActionPillStore.getState().isExpanded).toBe(false);
    });

    it('should set highlightedAgentId when expanding', () => {
      const action = createMockToolApproval('action-1', 'agent-1');
      useActionPillStore.getState().addAction(action);

      useActionPillStore.getState().expand();

      expect(useActionPillStore.getState().highlightedAgentId).toBe('agent-1');
    });

    it('should collapse the pill', () => {
      const action = createMockToolApproval('action-1', 'agent-1');
      useActionPillStore.getState().addAction(action);
      useActionPillStore.getState().expand();

      useActionPillStore.getState().collapse();

      // Run animation timers
      vi.advanceTimersByTime(400);

      const state = useActionPillStore.getState();
      expect(state.isExpanded).toBe(false);
      expect(state.highlightedAgentId).toBeNull();
    });
  });

  describe('markActionsViewed', () => {
    it('should clear hasNewActions flag', () => {
      const action = createMockToolApproval('action-1', 'agent-1');
      useActionPillStore.getState().addAction(action);

      expect(useActionPillStore.getState().hasNewActions).toBe(true);

      useActionPillStore.getState().markActionsViewed();

      expect(useActionPillStore.getState().hasNewActions).toBe(false);
    });
  });

  describe('form state', () => {
    it('should update action answers', () => {
      useActionPillStore.getState().updateActionAnswer('action-1', 'Which option?', 'Option A');

      const state = useActionPillStore.getState();
      expect(state.actionAnswers['action-1']['Which option?']).toBe('Option A');
    });

    it('should clear action answers', () => {
      useActionPillStore.getState().updateActionAnswer('action-1', 'Which option?', 'Option A');
      useActionPillStore.getState().clearActionAnswers('action-1');

      expect(useActionPillStore.getState().actionAnswers['action-1']).toBeUndefined();
    });

    it('should track submitting state', () => {
      useActionPillStore.getState().setSubmitting('action-1', true);
      expect(useActionPillStore.getState().submittingActions.has('action-1')).toBe(true);

      useActionPillStore.getState().setSubmitting('action-1', false);
      expect(useActionPillStore.getState().submittingActions.has('action-1')).toBe(false);
    });
  });
});

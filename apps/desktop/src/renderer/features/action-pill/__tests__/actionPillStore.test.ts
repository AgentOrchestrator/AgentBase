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
      selectedAgentId: null,
      actionAnswers: {},
      submittingActions: new Set(),
      dismissingActions: new Set(),
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

    it('should preserve selectedAgentId when actions are removed', () => {
      const action = createMockToolApproval('action-1', 'agent-1');
      useActionPillStore.getState().addAction(action);
      useActionPillStore.getState().selectAgent('agent-1');
      useActionPillStore.getState().removeAction('action-1');

      // Selection is preserved even when agent has no more actions
      expect(useActionPillStore.getState().selectedAgentId).toBe('agent-1');
    });

    it('should update highlightedAgentId to next action when current is removed', () => {
      const action1 = createMockToolApproval('action-1', 'agent-1');
      const action2 = createMockToolApproval('action-2', 'agent-2');

      // Add actions with different timestamps
      useActionPillStore.getState().addAction({ ...action1, createdAt: '2024-01-01T00:00:00Z' });
      useActionPillStore.getState().addAction({ ...action2, createdAt: '2024-01-01T00:01:00Z' });

      // Use expand() to properly set highlightedAgentId (not just setState)
      useActionPillStore.getState().expand();

      // Check initial state - first action is highlighted by default
      const state = useActionPillStore.getState();
      expect(state.highlightedAgentId).toBe('agent-1');

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

    it('should use pre-selected agent when expanding if it has actions', () => {
      const action1 = createMockToolApproval('action-1', 'agent-1');
      const action2 = createMockToolApproval('action-2', 'agent-2');

      // Add actions with different timestamps
      useActionPillStore.getState().addAction({ ...action1, createdAt: '2024-01-01T00:00:00Z' });
      useActionPillStore.getState().addAction({ ...action2, createdAt: '2024-01-01T00:01:00Z' });

      // Pre-select agent-2 while collapsed
      useActionPillStore.getState().selectAgent('agent-2');

      // Verify selection was stored but highlight not updated (collapsed)
      expect(useActionPillStore.getState().selectedAgentId).toBe('agent-2');
      expect(useActionPillStore.getState().highlightedAgentId).toBeNull();

      // Now expand - should use the pre-selected agent
      useActionPillStore.getState().expand();

      expect(useActionPillStore.getState().highlightedAgentId).toBe('agent-2');
    });

    it('should fall back to first action agent when selected agent has no actions', () => {
      const action1 = createMockToolApproval('action-1', 'agent-1');

      useActionPillStore.getState().addAction({ ...action1, createdAt: '2024-01-01T00:00:00Z' });

      // Select an agent that has no actions
      useActionPillStore.getState().selectAgent('agent-nonexistent');

      // Expand - should fall back to first action's agent
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

    it('should preserve selection when collapsing', () => {
      const action1 = createMockToolApproval('action-1', 'agent-1');
      const action2 = createMockToolApproval('action-2', 'agent-2');

      useActionPillStore.getState().addAction({ ...action1, createdAt: '2024-01-01T00:00:00Z' });
      useActionPillStore.getState().addAction({ ...action2, createdAt: '2024-01-01T00:01:00Z' });
      useActionPillStore.getState().expand();

      // Select agent-2
      useActionPillStore.getState().selectAgent('agent-2');
      expect(useActionPillStore.getState().selectedAgentId).toBe('agent-2');

      // Collapse
      useActionPillStore.getState().collapse();
      vi.advanceTimersByTime(400);

      // Selection should be preserved
      expect(useActionPillStore.getState().selectedAgentId).toBe('agent-2');
      expect(useActionPillStore.getState().highlightedAgentId).toBeNull();

      // Expand again - should restore to agent-2
      useActionPillStore.getState().expand();
      expect(useActionPillStore.getState().highlightedAgentId).toBe('agent-2');
    });
  });

  describe('selectAgent', () => {
    it('should select any agent, even without actions', () => {
      const result = useActionPillStore.getState().selectAgent('agent-nonexistent');

      expect(result).toBe(true);
      expect(useActionPillStore.getState().selectedAgentId).toBe('agent-nonexistent');
    });

    it('should select agent with actions', () => {
      const action = createMockToolApproval('action-1', 'agent-1');
      useActionPillStore.getState().addAction(action);

      const result = useActionPillStore.getState().selectAgent('agent-1');

      expect(result).toBe(true);
      expect(useActionPillStore.getState().selectedAgentId).toBe('agent-1');
    });

    it('should NOT auto-expand when selecting while collapsed', () => {
      const action = createMockToolApproval('action-1', 'agent-1');
      useActionPillStore.getState().addAction(action);

      useActionPillStore.getState().selectAgent('agent-1');

      expect(useActionPillStore.getState().isExpanded).toBe(false);
    });

    it('should update highlightedAgentId only when expanded and agent has actions', () => {
      const action1 = createMockToolApproval('action-1', 'agent-1');
      const action2 = createMockToolApproval('action-2', 'agent-2');

      useActionPillStore.getState().addAction({ ...action1, createdAt: '2024-01-01T00:00:00Z' });
      useActionPillStore.getState().addAction({ ...action2, createdAt: '2024-01-01T00:01:00Z' });
      useActionPillStore.getState().expand();

      // Now select agent-2 while expanded
      useActionPillStore.getState().selectAgent('agent-2');

      expect(useActionPillStore.getState().highlightedAgentId).toBe('agent-2');
    });

    it('should not change highlight when selecting agent without actions while expanded', () => {
      const action = createMockToolApproval('action-1', 'agent-1');
      useActionPillStore.getState().addAction(action);
      useActionPillStore.getState().expand();

      expect(useActionPillStore.getState().highlightedAgentId).toBe('agent-1');

      // Select agent without actions
      useActionPillStore.getState().selectAgent('agent-nonexistent');

      // Highlight falls back to first action's agent
      expect(useActionPillStore.getState().highlightedAgentId).toBe('agent-1');
      expect(useActionPillStore.getState().selectedAgentId).toBe('agent-nonexistent');
    });
  });

  describe('clearSelection', () => {
    it('should reset selection to null', () => {
      useActionPillStore.getState().selectAgent('agent-1');
      expect(useActionPillStore.getState().selectedAgentId).toBe('agent-1');

      useActionPillStore.getState().clearSelection();

      expect(useActionPillStore.getState().selectedAgentId).toBeNull();
    });

    it('should update highlightedAgentId to first action when expanded', () => {
      const action1 = createMockToolApproval('action-1', 'agent-1');
      const action2 = createMockToolApproval('action-2', 'agent-2');

      useActionPillStore.getState().addAction({ ...action1, createdAt: '2024-01-01T00:00:00Z' });
      useActionPillStore.getState().addAction({ ...action2, createdAt: '2024-01-01T00:01:00Z' });
      useActionPillStore.getState().expand();

      // Select agent-2
      useActionPillStore.getState().selectAgent('agent-2');
      expect(useActionPillStore.getState().highlightedAgentId).toBe('agent-2');

      // Clear selection
      useActionPillStore.getState().clearSelection();

      expect(useActionPillStore.getState().selectedAgentId).toBeNull();
      expect(useActionPillStore.getState().highlightedAgentId).toBe('agent-1');
    });

    it('should NOT collapse the pill', () => {
      const action = createMockToolApproval('action-1', 'agent-1');
      useActionPillStore.getState().addAction(action);
      useActionPillStore.getState().expand();

      useActionPillStore.getState().clearSelection();

      expect(useActionPillStore.getState().isExpanded).toBe(true);
    });
  });

  describe('cycleSelectedAgent', () => {
    it('should cycle to next agent', () => {
      const action1 = createMockToolApproval('action-1', 'agent-1');
      const action2 = createMockToolApproval('action-2', 'agent-2');

      useActionPillStore.getState().addAction({ ...action1, createdAt: '2024-01-01T00:00:00Z' });
      useActionPillStore.getState().addAction({ ...action2, createdAt: '2024-01-01T00:01:00Z' });
      useActionPillStore.getState().expand();

      useActionPillStore.getState().cycleSelectedAgent('next');

      expect(useActionPillStore.getState().selectedAgentId).toBe('agent-2');
      expect(useActionPillStore.getState().highlightedAgentId).toBe('agent-2');
    });

    it('should wrap around when cycling past last', () => {
      const action1 = createMockToolApproval('action-1', 'agent-1');
      const action2 = createMockToolApproval('action-2', 'agent-2');

      useActionPillStore.getState().addAction({ ...action1, createdAt: '2024-01-01T00:00:00Z' });
      useActionPillStore.getState().addAction({ ...action2, createdAt: '2024-01-01T00:01:00Z' });
      useActionPillStore.getState().expand();

      // Cycle next twice to wrap around
      useActionPillStore.getState().cycleSelectedAgent('next');
      useActionPillStore.getState().cycleSelectedAgent('next');

      expect(useActionPillStore.getState().selectedAgentId).toBe('agent-1');
    });

    it('should cycle to previous agent', () => {
      const action1 = createMockToolApproval('action-1', 'agent-1');
      const action2 = createMockToolApproval('action-2', 'agent-2');

      useActionPillStore.getState().addAction({ ...action1, createdAt: '2024-01-01T00:00:00Z' });
      useActionPillStore.getState().addAction({ ...action2, createdAt: '2024-01-01T00:01:00Z' });
      useActionPillStore.getState().expand();
      useActionPillStore.getState().selectAgent('agent-2');

      useActionPillStore.getState().cycleSelectedAgent('prev');

      expect(useActionPillStore.getState().selectedAgentId).toBe('agent-1');
      expect(useActionPillStore.getState().highlightedAgentId).toBe('agent-1');
    });

    it('should not cycle when collapsed', () => {
      const action = createMockToolApproval('action-1', 'agent-1');
      useActionPillStore.getState().addAction(action);

      useActionPillStore.getState().cycleSelectedAgent('next');

      // No change since collapsed
      expect(useActionPillStore.getState().selectedAgentId).toBeNull();
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

/**
 * useActionPillHighlight Hook Tests
 *
 * Tests the highlight behavior for ActionPill feature.
 */

import type { ToolApprovalAction } from '@agent-orchestrator/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { useActionPillStore } from '../store/actionPillStore';

// Mock action data with proper types
function createMockToolApproval(id: string, agentId: string): ToolApprovalAction {
  return {
    id,
    type: 'tool_approval',
    agentId,
    sessionId: 'session-1',
    createdAt: new Date().toISOString(),
    toolName: 'Bash',
    command: 'ls -la',
  };
}

describe('useActionPillHighlight behavior', () => {
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
  });

  describe('shouldHighlightPill', () => {
    it('should not highlight pill when there are no actions', () => {
      const state = useActionPillStore.getState();
      const shouldHighlight = state.hasNewActions && state.actions.length > 0;

      expect(shouldHighlight).toBe(false);
    });

    it('should highlight pill when new action arrives', () => {
      const action = createMockToolApproval('action-1', 'agent-1');
      useActionPillStore.getState().addAction(action);

      const state = useActionPillStore.getState();
      const shouldHighlight = state.hasNewActions && state.actions.length > 0;

      expect(shouldHighlight).toBe(true);
    });

    it('should clear highlight when actions are viewed', () => {
      const action = createMockToolApproval('action-1', 'agent-1');
      useActionPillStore.getState().addAction(action);
      useActionPillStore.getState().markActionsViewed();

      const state = useActionPillStore.getState();
      const shouldHighlight = state.hasNewActions && state.actions.length > 0;

      expect(shouldHighlight).toBe(false);
    });

    it('should clear highlight when all actions are processed', () => {
      const action = createMockToolApproval('action-1', 'agent-1');
      useActionPillStore.getState().addAction(action);
      useActionPillStore.getState().markActionsViewed();
      useActionPillStore.getState().removeAction('action-1');

      const state = useActionPillStore.getState();
      const shouldHighlight = state.hasNewActions && state.actions.length > 0;

      expect(shouldHighlight).toBe(false);
    });
  });

  describe('highlightedAgentId', () => {
    it('should be null when pill is collapsed', () => {
      const action = createMockToolApproval('action-1', 'agent-1');
      useActionPillStore.getState().addAction(action);

      expect(useActionPillStore.getState().highlightedAgentId).toBeNull();
    });

    it('should be set to topmost action agentId when pill is expanded', () => {
      const action = createMockToolApproval('action-1', 'agent-1');
      useActionPillStore.getState().addAction(action);
      useActionPillStore.getState().expand();

      expect(useActionPillStore.getState().highlightedAgentId).toBe('agent-1');
    });

    it('should update to next action when current topmost is removed', () => {
      // Add actions with explicit timestamps (earlier timestamp = topmost)
      const action1 = { ...createMockToolApproval('action-1', 'agent-1'), createdAt: '2024-01-01T00:00:00Z' };
      const action2 = { ...createMockToolApproval('action-2', 'agent-2'), createdAt: '2024-01-01T00:01:00Z' };

      useActionPillStore.getState().addAction(action1);
      useActionPillStore.getState().addAction(action2);
      useActionPillStore.getState().expand();

      expect(useActionPillStore.getState().highlightedAgentId).toBe('agent-1');

      // Remove first action
      useActionPillStore.getState().removeAction('action-1');

      expect(useActionPillStore.getState().highlightedAgentId).toBe('agent-2');
    });

    it('should be null when all actions are removed while expanded', () => {
      const action = createMockToolApproval('action-1', 'agent-1');
      useActionPillStore.getState().addAction(action);
      useActionPillStore.getState().expand();

      expect(useActionPillStore.getState().highlightedAgentId).toBe('agent-1');

      useActionPillStore.getState().removeAction('action-1');

      expect(useActionPillStore.getState().highlightedAgentId).toBeNull();
    });
  });

  describe('integration: highlight shows on new permission, clears when processed', () => {
    it('complete flow: add action -> expand (clears new flag) -> process -> highlights clear', () => {
      // Step 1: New action arrives - pill should glow
      const action = createMockToolApproval('action-1', 'agent-1');
      useActionPillStore.getState().addAction(action);

      let state = useActionPillStore.getState();
      expect(state.hasNewActions).toBe(true);
      expect(state.actions.length > 0).toBe(true);
      // shouldHighlightPill = true

      // Step 2: User clicks pill to expand - glow should stop, agent node should highlight
      useActionPillStore.getState().expand();

      state = useActionPillStore.getState();
      expect(state.hasNewActions).toBe(false);
      expect(state.isExpanded).toBe(true);
      expect(state.highlightedAgentId).toBe('agent-1');
      // shouldHighlightPill = false (hasNewActions is false)

      // Step 3: User processes the action - everything should be clear
      useActionPillStore.getState().removeAction('action-1');

      state = useActionPillStore.getState();
      expect(state.actions.length).toBe(0);
      expect(state.isExpanded).toBe(false);
      expect(state.highlightedAgentId).toBeNull();
      expect(state.hasNewActions).toBe(false);
    });
  });
});

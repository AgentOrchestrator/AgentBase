/**
 * Tests for CodingAgentStatusManager
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CodingAgentState,
  IStatusPersistence,
  ISummaryComputer,
  ITitleComputer,
} from '../../../../types/coding-agent-status';
import { CodingAgentStatusManager } from '../CodingAgentStatusManager';

// =============================================================================
// Mock Implementations
// =============================================================================

class MockTitleComputer implements ITitleComputer {
  async computeTitle(messages: string[]): Promise<string> {
    if (messages.length === 0) return 'Untitled';
    return `Title: ${messages[0].slice(0, 30)}`;
  }
}

class MockSummaryComputer implements ISummaryComputer {
  async computeSummary(messages: string[]): Promise<string> {
    if (messages.length === 0) return 'No summary';
    return `Summary of ${messages.length} messages`;
  }
}

class MockPersistence implements IStatusPersistence {
  private storage = new Map<string, CodingAgentState>();

  async save(state: CodingAgentState): Promise<void> {
    this.storage.set(state.agentId, { ...state });
  }

  async load(agentId: string): Promise<CodingAgentState | null> {
    const state = this.storage.get(agentId);
    return state ? { ...state } : null;
  }

  async delete(agentId: string): Promise<void> {
    this.storage.delete(agentId);
  }

  async loadAll(): Promise<CodingAgentState[]> {
    return Array.from(this.storage.values()).map((s) => ({ ...s }));
  }

  // Test helper
  clear(): void {
    this.storage.clear();
  }
}

// =============================================================================
// Test Suite
// =============================================================================

describe('CodingAgentStatusManager', () => {
  let manager: CodingAgentStatusManager;
  let titleComputer: MockTitleComputer;
  let summaryComputer: MockSummaryComputer;
  let persistence: MockPersistence;

  beforeEach(() => {
    titleComputer = new MockTitleComputer();
    summaryComputer = new MockSummaryComputer();
    persistence = new MockPersistence();
    manager = new CodingAgentStatusManager(titleComputer, summaryComputer, persistence);
  });

  // ===========================================================================
  // Agent Registration
  // ===========================================================================

  describe('Agent Registration', () => {
    it('should register a new agent with default state', () => {
      manager.registerAgent('agent-1', 'claude_code');

      const state = manager.getState('agent-1');
      expect(state).not.toBeNull();
      expect(state?.agentId).toBe('agent-1');
      expect(state?.agentType).toBe('claude_code');
      expect(state?.statusInfo.status).toBe('idle');
      expect(state?.title.value).toBe('Untitled Session');
      expect(state?.title.isManuallySet).toBe(false);
      expect(state?.summary).toBeNull();
    });

    it('should not overwrite existing agent on duplicate registration', () => {
      manager.registerAgent('agent-1', 'claude_code');
      manager.updateStatus('agent-1', 'running');

      // Try to register again
      manager.registerAgent('agent-1', 'cursor');

      const state = manager.getState('agent-1');
      expect(state?.agentType).toBe('claude_code'); // Original type
      expect(state?.statusInfo.status).toBe('running'); // Status preserved
    });

    it('should unregister an agent', () => {
      manager.registerAgent('agent-1', 'claude_code');
      expect(manager.getState('agent-1')).not.toBeNull();

      manager.unregisterAgent('agent-1');
      expect(manager.getState('agent-1')).toBeNull();
    });

    it('should handle unregistering non-existent agent gracefully', () => {
      expect(() => manager.unregisterAgent('non-existent')).not.toThrow();
    });
  });

  // ===========================================================================
  // Status Management
  // ===========================================================================

  describe('Status Management', () => {
    beforeEach(() => {
      manager.registerAgent('agent-1', 'claude_code');
    });

    it('should get status for registered agent', () => {
      const status = manager.getStatus('agent-1');
      expect(status).not.toBeNull();
      expect(status?.status).toBe('idle');
    });

    it('should return null for unregistered agent', () => {
      expect(manager.getStatus('non-existent')).toBeNull();
    });

    it('should update status', () => {
      manager.updateStatus('agent-1', 'running');

      const status = manager.getStatus('agent-1');
      expect(status?.status).toBe('running');
    });

    it('should update status with tool context', () => {
      manager.updateStatus('agent-1', 'executing_tool', {
        toolName: 'bash',
        toolType: 'bash',
      });

      const status = manager.getStatus('agent-1');
      expect(status?.status).toBe('executing_tool');
      expect(status?.toolName).toBe('bash');
      expect(status?.toolType).toBe('bash');
    });

    it('should update status with error context', () => {
      manager.updateStatus('agent-1', 'error', {
        errorMessage: 'Something went wrong',
      });

      const status = manager.getStatus('agent-1');
      expect(status?.status).toBe('error');
      expect(status?.errorMessage).toBe('Something went wrong');
    });

    it('should update startedAt timestamp on status change', () => {
      const beforeUpdate = Date.now();
      manager.updateStatus('agent-1', 'running');
      const afterUpdate = Date.now();

      const status = manager.getStatus('agent-1');
      expect(status?.startedAt).toBeGreaterThanOrEqual(beforeUpdate);
      expect(status?.startedAt).toBeLessThanOrEqual(afterUpdate);
    });

    it('should not update status for unregistered agent', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      manager.updateStatus('non-existent', 'running');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot update status for unregistered agent')
      );
      consoleSpy.mockRestore();
    });

    it('should cycle through all status states', () => {
      const statuses = [
        'idle',
        'running',
        'thinking',
        'streaming',
        'executing_tool',
        'awaiting_input',
        'paused',
        'completed',
        'error',
      ] as const;

      for (const status of statuses) {
        manager.updateStatus('agent-1', status);
        expect(manager.getStatus('agent-1')?.status).toBe(status);
      }
    });
  });

  // ===========================================================================
  // Title Management
  // ===========================================================================

  describe('Title Management', () => {
    beforeEach(() => {
      manager.registerAgent('agent-1', 'claude_code');
    });

    it('should get default title', () => {
      const title = manager.getTitle('agent-1');
      expect(title?.value).toBe('Untitled Session');
      expect(title?.isManuallySet).toBe(false);
    });

    it('should set title manually', () => {
      manager.setTitle('agent-1', 'My Custom Title');

      const title = manager.getTitle('agent-1');
      expect(title?.value).toBe('My Custom Title');
      expect(title?.isManuallySet).toBe(true);
    });

    it('should compute title from messages', async () => {
      await manager.computeTitle('agent-1', ['Help me refactor auth']);

      const title = manager.getTitle('agent-1');
      expect(title?.value).toBe('Title: Help me refactor auth');
      expect(title?.isManuallySet).toBe(false);
      expect(title?.computedFrom).toEqual(['Help me refactor auth']);
    });

    it('should not overwrite manually set title with computed one', async () => {
      manager.setTitle('agent-1', 'My Manual Title');
      await manager.computeTitle('agent-1', ['Some message']);

      const title = manager.getTitle('agent-1');
      expect(title?.value).toBe('My Manual Title');
      expect(title?.isManuallySet).toBe(true);
    });

    it('should store first 3 messages in computedFrom', async () => {
      const messages = ['msg1', 'msg2', 'msg3', 'msg4', 'msg5'];
      await manager.computeTitle('agent-1', messages);

      const title = manager.getTitle('agent-1');
      expect(title?.computedFrom).toHaveLength(3);
      expect(title?.computedFrom).toEqual(['msg1', 'msg2', 'msg3']);
    });
  });

  // ===========================================================================
  // Summary Management
  // ===========================================================================

  describe('Summary Management', () => {
    beforeEach(() => {
      manager.registerAgent('agent-1', 'claude_code');
    });

    it('should have null summary initially', () => {
      expect(manager.getSummary('agent-1')).toBeNull();
    });

    it('should compute summary from messages', async () => {
      await manager.computeSummary('agent-1', ['msg1', 'msg2', 'msg3']);

      expect(manager.getSummary('agent-1')).toBe('Summary of 3 messages');
    });

    it('should update summary on recompute', async () => {
      await manager.computeSummary('agent-1', ['msg1']);
      expect(manager.getSummary('agent-1')).toBe('Summary of 1 messages');

      await manager.computeSummary('agent-1', ['msg1', 'msg2']);
      expect(manager.getSummary('agent-1')).toBe('Summary of 2 messages');
    });
  });

  // ===========================================================================
  // State Access
  // ===========================================================================

  describe('State Access', () => {
    it('should get all states', () => {
      manager.registerAgent('agent-1', 'claude_code');
      manager.registerAgent('agent-2', 'cursor');
      manager.registerAgent('agent-3', 'codex');

      const states = manager.getAllStates();
      expect(states).toHaveLength(3);
      expect(states.map((s) => s.agentId).sort()).toEqual(['agent-1', 'agent-2', 'agent-3']);
    });

    it('should return empty array when no agents registered', () => {
      expect(manager.getAllStates()).toEqual([]);
    });

    it('should return defensive copy of state', () => {
      manager.registerAgent('agent-1', 'claude_code');

      const state1 = manager.getState('agent-1');
      const state2 = manager.getState('agent-1');

      expect(state1).not.toBe(state2); // Different objects
      expect(state1).toEqual(state2); // Same content
    });
  });

  // ===========================================================================
  // Event Subscription
  // ===========================================================================

  describe('Event Subscription', () => {
    beforeEach(() => {
      manager.registerAgent('agent-1', 'claude_code');
    });

    it('should notify listeners on status change', () => {
      const listener = vi.fn();
      manager.onStatusChange(listener);

      manager.updateStatus('agent-1', 'running');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        'agent-1',
        expect.objectContaining({ status: 'idle' }),
        expect.objectContaining({ status: 'running' })
      );
    });

    it('should notify multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      manager.onStatusChange(listener1);
      manager.onStatusChange(listener2);

      manager.updateStatus('agent-1', 'running');

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe listener', () => {
      const listener = vi.fn();
      const unsubscribe = manager.onStatusChange(listener);

      manager.updateStatus('agent-1', 'running');
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      manager.updateStatus('agent-1', 'completed');
      expect(listener).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const normalListener = vi.fn();

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      manager.onStatusChange(errorListener);
      manager.onStatusChange(normalListener);

      // Should not throw
      expect(() => manager.updateStatus('agent-1', 'running')).not.toThrow();

      // Normal listener should still be called
      expect(normalListener).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  // Persistence
  // ===========================================================================

  describe('Persistence', () => {
    beforeEach(() => {
      manager.registerAgent('agent-1', 'claude_code');
    });

    it('should persist agent state', async () => {
      manager.updateStatus('agent-1', 'running');
      manager.setTitle('agent-1', 'My Session');

      await manager.persist('agent-1');

      const saved = await persistence.load('agent-1');
      expect(saved).not.toBeNull();
      expect(saved?.statusInfo.status).toBe('running');
      expect(saved?.title.value).toBe('My Session');
    });

    it('should restore agent state', async () => {
      // Setup initial state
      manager.updateStatus('agent-1', 'completed');
      manager.setTitle('agent-1', 'Saved Session');
      await manager.persist('agent-1');

      // Create new manager instance
      const newManager = new CodingAgentStatusManager(titleComputer, summaryComputer, persistence);

      await newManager.restore('agent-1');

      const state = newManager.getState('agent-1');
      expect(state?.statusInfo.status).toBe('completed');
      expect(state?.title.value).toBe('Saved Session');
    });

    it('should restore all agent states', async () => {
      manager.registerAgent('agent-2', 'cursor');

      manager.updateStatus('agent-1', 'running');
      manager.updateStatus('agent-2', 'thinking');

      await manager.persist('agent-1');
      await manager.persist('agent-2');

      // Create new manager instance
      const newManager = new CodingAgentStatusManager(titleComputer, summaryComputer, persistence);

      await newManager.restoreAll();

      expect(newManager.getAllStates()).toHaveLength(2);
      expect(newManager.getStatus('agent-1')?.status).toBe('running');
      expect(newManager.getStatus('agent-2')?.status).toBe('thinking');
    });

    it('should handle persist for unregistered agent', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await manager.persist('non-existent');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot persist unregistered agent')
      );
      consoleSpy.mockRestore();
    });

    it('should handle restore for non-existent agent gracefully', async () => {
      await manager.restore('non-existent');
      expect(manager.getState('non-existent')).toBeNull();
    });
  });

  // ===========================================================================
  // UpdatedAt Tracking
  // ===========================================================================

  describe('UpdatedAt Tracking', () => {
    it('should update updatedAt on status change', () => {
      manager.registerAgent('agent-1', 'claude_code');
      const initialUpdatedAt = manager.getState('agent-1')?.updatedAt;

      // Wait a tiny bit to ensure timestamp changes
      const start = Date.now();
      while (Date.now() === start) {
        // spin
      }

      manager.updateStatus('agent-1', 'running');

      const newUpdatedAt = manager.getState('agent-1')?.updatedAt;
      expect(newUpdatedAt).toBeGreaterThan(initialUpdatedAt!);
    });

    it('should update updatedAt on title change', () => {
      manager.registerAgent('agent-1', 'claude_code');
      const initialUpdatedAt = manager.getState('agent-1')?.updatedAt;

      const start = Date.now();
      while (Date.now() === start) {
        // spin
      }

      manager.setTitle('agent-1', 'New Title');

      const newUpdatedAt = manager.getState('agent-1')?.updatedAt;
      expect(newUpdatedAt).toBeGreaterThan(initialUpdatedAt!);
    });
  });
});

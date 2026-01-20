/**
 * Tests for TerminalActionDetectorManager
 *
 * Tests the manager that coordinates multiple terminal detectors
 * and integrates with the agent event bridge.
 */

import type { AgentActionResponse } from '@agent-orchestrator/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getTerminalActionDetectorManager,
  TerminalActionDetectorManager,
} from '../TerminalActionDetectorManager';

// Mock the agent-event-bridge module
vi.mock('../../coding-agent/agent-event-bridge', () => ({
  emitAgentEvent: vi.fn(),
  awaitAgentActionResponse: vi.fn(),
}));

import { awaitAgentActionResponse, emitAgentEvent } from '../../coding-agent/agent-event-bridge';

const mockEmitAgentEvent = vi.mocked(emitAgentEvent);
const mockAwaitResponse = vi.mocked(awaitAgentActionResponse);

describe('TerminalActionDetectorManager', () => {
  let manager: TerminalActionDetectorManager;

  beforeEach(() => {
    vi.resetAllMocks();
    manager = new TerminalActionDetectorManager();
  });

  describe('attach', () => {
    it('should create a detector for a terminal', () => {
      const ptyWriter = vi.fn();
      manager.attach('terminal-1', 'claude_code', ptyWriter);

      // Manager should now track this terminal
      expect(() => manager.detach('terminal-1')).not.toThrow();
    });

    it('should allow attaching multiple terminals', () => {
      const ptyWriter1 = vi.fn();
      const ptyWriter2 = vi.fn();

      manager.attach('terminal-1', 'claude_code', ptyWriter1);
      manager.attach('terminal-2', 'claude_code', ptyWriter2);

      // Both should be tracked
      expect(() => {
        manager.detach('terminal-1');
        manager.detach('terminal-2');
      }).not.toThrow();
    });

    it('should replace existing detector if terminal already attached', () => {
      const ptyWriter1 = vi.fn();
      const ptyWriter2 = vi.fn();

      manager.attach('terminal-1', 'claude_code', ptyWriter1);
      manager.attach('terminal-1', 'claude_code', ptyWriter2);

      // Should not throw, just replace
      expect(() => manager.detach('terminal-1')).not.toThrow();
    });
  });

  describe('processOutput', () => {
    it('should do nothing for unattached terminal', async () => {
      await expect(manager.processOutput('unknown', 'some data')).resolves.not.toThrow();
      expect(mockEmitAgentEvent).not.toHaveBeenCalled();
    });

    it('should not emit event for non-permission output', async () => {
      const ptyWriter = vi.fn();
      manager.attach('terminal-1', 'claude_code', ptyWriter);

      await manager.processOutput('terminal-1', '$ ls -la\nfile1.txt');

      expect(mockEmitAgentEvent).not.toHaveBeenCalled();
    });

    it('should emit event when permission prompt detected', async () => {
      const ptyWriter = vi.fn();
      manager.attach('terminal-1', 'claude_code', ptyWriter);

      // Mock the response to avoid hanging
      mockAwaitResponse.mockResolvedValueOnce({
        actionId: 'test-id',
        type: 'tool_approval',
        decision: 'allow',
      });

      const prompt = 'Claude wants to run: Bash\nCommand: ls\nAllow? (y)es / (n)o';
      await manager.processOutput('terminal-1', prompt);

      expect(mockEmitAgentEvent).toHaveBeenCalledTimes(1);
      expect(mockEmitAgentEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'permission:request',
          agent: 'claude_code',
          payload: expect.objectContaining({
            toolName: 'Bash',
          }),
        })
      );
    });

    it('should set terminalId on detected action', async () => {
      const ptyWriter = vi.fn();
      manager.attach('my-terminal', 'claude_code', ptyWriter);

      mockAwaitResponse.mockResolvedValueOnce({
        actionId: 'test-id',
        type: 'tool_approval',
        decision: 'allow',
      });

      const prompt = 'Claude wants to run: Bash\nCommand: ls\nAllow? (y)es / (n)o';
      await manager.processOutput('my-terminal', prompt);

      expect(mockEmitAgentEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          raw: expect.objectContaining({
            terminalId: 'my-terminal',
          }),
        })
      );
    });

    it('should await response after emitting event', async () => {
      const ptyWriter = vi.fn();
      manager.attach('terminal-1', 'claude_code', ptyWriter);

      mockAwaitResponse.mockResolvedValueOnce({
        actionId: 'test-id',
        type: 'tool_approval',
        decision: 'allow',
      });

      const prompt = 'Claude wants to run: Bash\nCommand: ls\nAllow? (y)es / (n)o';
      await manager.processOutput('terminal-1', prompt);

      expect(mockAwaitResponse).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleResponse', () => {
    it('should write "y" to PTY for allow decision', async () => {
      const ptyWriter = vi.fn();
      manager.attach('terminal-1', 'claude_code', ptyWriter);

      const allowResponse: AgentActionResponse = {
        actionId: 'action-123',
        type: 'tool_approval',
        decision: 'allow',
      };

      mockAwaitResponse.mockResolvedValueOnce(allowResponse);

      const prompt = 'Claude wants to run: Bash\nCommand: ls\nAllow? (y)es / (n)o';
      await manager.processOutput('terminal-1', prompt);

      expect(ptyWriter).toHaveBeenCalledWith('y');
    });

    it('should write "n" to PTY for deny decision', async () => {
      const ptyWriter = vi.fn();
      manager.attach('terminal-1', 'claude_code', ptyWriter);

      const denyResponse: AgentActionResponse = {
        actionId: 'action-123',
        type: 'tool_approval',
        decision: 'deny',
      };

      mockAwaitResponse.mockResolvedValueOnce(denyResponse);

      const prompt = 'Claude wants to run: Bash\nCommand: ls\nAllow? (y)es / (n)o';
      await manager.processOutput('terminal-1', prompt);

      expect(ptyWriter).toHaveBeenCalledWith('n');
    });

    it('should handle response errors gracefully', async () => {
      const ptyWriter = vi.fn();
      manager.attach('terminal-1', 'claude_code', ptyWriter);

      mockAwaitResponse.mockRejectedValueOnce(new Error('Response timeout'));

      const prompt = 'Claude wants to run: Bash\nCommand: ls\nAllow? (y)es / (n)o';

      // Should not throw
      await expect(manager.processOutput('terminal-1', prompt)).resolves.not.toThrow();

      // Should not write to PTY on error
      expect(ptyWriter).not.toHaveBeenCalled();
    });
  });

  describe('detach', () => {
    it('should remove detector for terminal', () => {
      const ptyWriter = vi.fn();
      manager.attach('terminal-1', 'claude_code', ptyWriter);
      manager.detach('terminal-1');

      // Should do nothing for detached terminal
      mockAwaitResponse.mockResolvedValueOnce({
        actionId: 'test',
        type: 'tool_approval',
        decision: 'allow',
      });

      const prompt = 'Claude wants to run: Bash\nCommand: ls\nAllow? (y)es / (n)o';
      manager.processOutput('terminal-1', prompt);

      expect(mockEmitAgentEvent).not.toHaveBeenCalled();
    });

    it('should not throw for non-existent terminal', () => {
      expect(() => manager.detach('non-existent')).not.toThrow();
    });

    it('should cancel pending actions for terminal', async () => {
      const ptyWriter = vi.fn();
      manager.attach('terminal-1', 'claude_code', ptyWriter);

      // Create a pending action by not resolving the response
      let resolveResponse: ((value: AgentActionResponse) => void) | undefined;
      mockAwaitResponse.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveResponse = resolve;
        })
      );

      const prompt = 'Claude wants to run: Bash\nCommand: ls\nAllow? (y)es / (n)o';
      const processPromise = manager.processOutput('terminal-1', prompt);

      // Detach while response is pending
      manager.detach('terminal-1');

      // Resolve the response after detach
      resolveResponse?.({
        actionId: 'test',
        type: 'tool_approval',
        decision: 'allow',
      });

      await processPromise;

      // Should not write to PTY since terminal was detached
      expect(ptyWriter).not.toHaveBeenCalled();
    });
  });

  describe('isolation between terminals', () => {
    it('should process terminals independently', async () => {
      const ptyWriter1 = vi.fn();
      const ptyWriter2 = vi.fn();

      manager.attach('terminal-1', 'claude_code', ptyWriter1);
      manager.attach('terminal-2', 'claude_code', ptyWriter2);

      // Terminal 1 gets allow, Terminal 2 gets deny
      mockAwaitResponse
        .mockResolvedValueOnce({
          actionId: 'action-1',
          type: 'tool_approval',
          decision: 'allow',
        })
        .mockResolvedValueOnce({
          actionId: 'action-2',
          type: 'tool_approval',
          decision: 'deny',
        });

      // Use different prompts to avoid any interference
      const prompt1 = 'Claude wants to run: Bash\nCommand: ls\nAllow? (y)es / (n)o';
      const prompt2 = 'Claude wants to run: Bash\nCommand: pwd\nAllow? (y)es / (n)o';

      // Process both terminals - they have independent detectors
      await manager.processOutput('terminal-1', prompt1);
      await manager.processOutput('terminal-2', prompt2);

      expect(ptyWriter1).toHaveBeenCalledWith('y');
      expect(ptyWriter2).toHaveBeenCalledWith('n');
    });

    it('should not affect other terminals when one is detached', async () => {
      const ptyWriter1 = vi.fn();
      const ptyWriter2 = vi.fn();

      manager.attach('terminal-1', 'claude_code', ptyWriter1);
      manager.attach('terminal-2', 'claude_code', ptyWriter2);

      manager.detach('terminal-1');

      mockAwaitResponse.mockResolvedValueOnce({
        actionId: 'action-2',
        type: 'tool_approval',
        decision: 'allow',
      });

      const prompt = 'Claude wants to run: Bash\nCommand: ls\nAllow? (y)es / (n)o';
      await manager.processOutput('terminal-2', prompt);

      expect(ptyWriter2).toHaveBeenCalledWith('y');
    });
  });
});

describe('getTerminalActionDetectorManager', () => {
  it('should return singleton instance', () => {
    const manager1 = getTerminalActionDetectorManager();
    const manager2 = getTerminalActionDetectorManager();

    expect(manager1).toBe(manager2);
  });
});

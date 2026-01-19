/**
 * Tests for NotificationSoundService
 */

import type { ToolApprovalAction } from '@agent-orchestrator/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { AgentActionStore } from '../../stores/AgentActionStore';
import type { IAudioPlayer } from '../audio';
import { NotificationSoundService } from '../NotificationSoundService';

// =============================================================================
// Mock Implementations
// =============================================================================

class MockAudioPlayer implements IAudioPlayer {
  playCount = 0;
  lastPlayedFile: string | null = null;
  volume = 1.0;

  async play(soundFile: string): Promise<void> {
    this.playCount++;
    this.lastPlayedFile = soundFile;
  }

  setVolume(level: number): void {
    this.volume = level;
  }

  reset(): void {
    this.playCount = 0;
    this.lastPlayedFile = null;
  }
}

// =============================================================================
// Test Helpers
// =============================================================================

function createToolApprovalAction(id: string, agentId = 'agent-1'): ToolApprovalAction {
  return {
    id,
    type: 'tool_approval',
    agentId,
    toolName: 'Bash',
    command: 'npm test',
    createdAt: new Date().toISOString(),
  };
}

// =============================================================================
// Test Suite
// =============================================================================

describe('NotificationSoundService', () => {
  let service: NotificationSoundService;
  let audioPlayer: MockAudioPlayer;
  let actionStore: AgentActionStore;

  beforeEach(() => {
    audioPlayer = new MockAudioPlayer();
    actionStore = new AgentActionStore();
    service = new NotificationSoundService(audioPlayer, actionStore);
  });

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  describe('Lifecycle', () => {
    it('should initialize without errors', () => {
      expect(() => service.initialize()).not.toThrow();
    });

    it('should be idempotent on multiple initialize calls', () => {
      service.initialize();
      service.initialize();
      // Should not throw or create multiple subscriptions
    });

    it('should dispose without errors', () => {
      service.initialize();
      expect(() => service.dispose()).not.toThrow();
    });

    it('should handle dispose before initialize', () => {
      expect(() => service.dispose()).not.toThrow();
    });
  });

  // ===========================================================================
  // Sound Playback
  // ===========================================================================

  describe('Sound Playback', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should play sound when new action is added', () => {
      const action = createToolApprovalAction('action-1');
      actionStore.addAction(action);

      expect(audioPlayer.playCount).toBe(1);
    });

    it('should not replay sound for same action', () => {
      const action = createToolApprovalAction('action-1');

      // Add same action twice (store deduplicates, but we also track)
      actionStore.addAction(action);
      actionStore.addAction(action);

      expect(audioPlayer.playCount).toBe(1);
    });

    it('should play sound for each new action', () => {
      actionStore.addAction(createToolApprovalAction('action-1'));
      actionStore.addAction(createToolApprovalAction('action-2'));
      actionStore.addAction(createToolApprovalAction('action-3'));

      expect(audioPlayer.playCount).toBe(3);
    });

    it('should not play sound after action is removed and re-added', () => {
      const action = createToolApprovalAction('action-1');

      actionStore.addAction(action);
      expect(audioPlayer.playCount).toBe(1);

      actionStore.removeAction('action-1');
      actionStore.addAction(action);

      // Should still be 1 because we've seen this ID before
      expect(audioPlayer.playCount).toBe(1);
    });
  });

  // ===========================================================================
  // Enable/Disable
  // ===========================================================================

  describe('Enable/Disable', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should not play sound when disabled', () => {
      service.setEnabled(false);

      actionStore.addAction(createToolApprovalAction('action-1'));

      expect(audioPlayer.playCount).toBe(0);
    });

    it('should play sound after re-enabling', () => {
      service.setEnabled(false);
      actionStore.addAction(createToolApprovalAction('action-1'));

      service.setEnabled(true);
      actionStore.addAction(createToolApprovalAction('action-2'));

      expect(audioPlayer.playCount).toBe(1);
    });
  });

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  describe('Cleanup', () => {
    it('should not play sound after dispose', () => {
      service.initialize();
      service.dispose();

      actionStore.addAction(createToolApprovalAction('action-1'));

      expect(audioPlayer.playCount).toBe(0);
    });

    it('should clear seen IDs on dispose', () => {
      service.initialize();
      actionStore.addAction(createToolApprovalAction('action-1'));
      expect(audioPlayer.playCount).toBe(1);

      service.dispose();
      audioPlayer.reset();

      // Create fresh store (simulates app restart) and new service
      const freshStore = new AgentActionStore();
      const freshService = new NotificationSoundService(audioPlayer, freshStore);
      freshService.initialize();
      freshStore.addAction(createToolApprovalAction('action-1'));

      // Should play again since seen IDs were cleared with dispose
      expect(audioPlayer.playCount).toBe(1);
      freshService.dispose();
    });
  });
});

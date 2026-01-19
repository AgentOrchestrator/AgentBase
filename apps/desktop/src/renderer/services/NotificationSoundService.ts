/**
 * Notification Sound Service
 *
 * Plays a notification sound when new permission requests arrive.
 * Subscribes to AgentActionStore and detects new actions.
 */

import type { AgentAction } from '@agent-orchestrator/shared';
import type { AgentActionStore } from '../stores';
import type { IAudioPlayer } from './audio';

// Sound file path (relative to renderer assets)
const NOTIFICATION_SOUND = new URL('../assets/sounds/notification.mp3', import.meta.url).href;

export interface INotificationSoundService {
  initialize(): void;
  dispose(): void;
  setEnabled(enabled: boolean): void;
}

export class NotificationSoundService implements INotificationSoundService {
  private unsubscribe: (() => void) | null = null;
  private enabled = true;
  private seenActionIds = new Set<string>();

  constructor(
    private readonly audioPlayer: IAudioPlayer,
    private readonly actionStore: AgentActionStore
  ) {}

  initialize(): void {
    if (this.unsubscribe) {
      return; // Already initialized
    }

    // Subscribe to all action changes
    this.unsubscribe = this.actionStore.subscribeAll((actions) => {
      this.handleActionsChange(actions);
    });

    console.log('[NotificationSoundService] Initialized');
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.seenActionIds.clear();
    console.log('[NotificationSoundService] Disposed');
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Handle actions change from the store.
   * Detects NEW actions and plays notification sound.
   */
  private handleActionsChange(actions: AgentAction[]): void {
    console.log(
      '[NotificationSoundService] Actions changed:',
      actions.length,
      'actions, enabled:',
      this.enabled
    );

    if (!this.enabled) {
      return;
    }

    let hasNewAction = false;

    for (const action of actions) {
      if (!this.seenActionIds.has(action.id)) {
        console.log('[NotificationSoundService] New action detected:', action.id, action.type);
        this.seenActionIds.add(action.id);
        hasNewAction = true;
      }
    }

    if (hasNewAction) {
      console.log('[NotificationSoundService] Playing notification sound');
      this.playNotification();
    }
  }

  private playNotification(): void {
    this.audioPlayer.play(NOTIFICATION_SOUND).catch((error) => {
      console.warn('[NotificationSoundService] Failed to play sound:', error);
    });
  }
}

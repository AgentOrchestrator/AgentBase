/**
 * Permission Mode Store Tests
 *
 * Tests for permission mode state management, cycling, and persistence.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PermissionMode } from '@agent-orchestrator/shared';
import { PermissionModeStore } from '../PermissionModeStore';

// =============================================================================
// Mock localStorage
// =============================================================================

const createMockLocalStorage = () => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    // Test helper to inspect raw store
    _getStore: () => store,
    _setStore: (newStore: Record<string, string>) => {
      store = newStore;
    },
  };
};

// =============================================================================
// Test Suite
// =============================================================================

describe('PermissionModeStore', () => {
  let mockLocalStorage: ReturnType<typeof createMockLocalStorage>;
  let store: PermissionModeStore;

  beforeEach(() => {
    mockLocalStorage = createMockLocalStorage();
    // @ts-expect-error - Mocking global localStorage
    global.localStorage = mockLocalStorage;

    store = new PermissionModeStore();
  });

  // ===========================================================================
  // Initial State
  // ===========================================================================

  describe('Initial State', () => {
    it('should default to ask mode', () => {
      expect(store.getGlobalMode()).toBe('ask');
    });

    it('should have no agent overrides initially', () => {
      expect(store.getEffectiveMode('agent-1')).toBe('ask');
      expect(store.getEffectiveMode('agent-2')).toBe('ask');
    });

    it('should attempt to load from localStorage on construction', () => {
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('permission-mode-state');
    });
  });

  // ===========================================================================
  // Global Mode Management
  // ===========================================================================

  describe('Global Mode Management', () => {
    it('should get global mode', () => {
      expect(store.getGlobalMode()).toBe('ask');
    });

    it('should set global mode', () => {
      store.setGlobalMode('plan');
      expect(store.getGlobalMode()).toBe('plan');

      store.setGlobalMode('auto-accept');
      expect(store.getGlobalMode()).toBe('auto-accept');

      store.setGlobalMode('ask');
      expect(store.getGlobalMode()).toBe('ask');
    });

    it('should persist global mode to localStorage', () => {
      store.setGlobalMode('plan');

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      const savedState = JSON.parse(mockLocalStorage._getStore()['permission-mode-state']);
      expect(savedState.globalMode).toBe('plan');
    });

    it('should not persist if mode is unchanged', () => {
      store.setGlobalMode('ask'); // Already 'ask' by default
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Agent Override Management
  // ===========================================================================

  describe('Agent Override Management', () => {
    it('should set agent-specific mode override', () => {
      store.setAgentMode('agent-1', 'plan');

      expect(store.getEffectiveMode('agent-1')).toBe('plan');
      expect(store.getGlobalMode()).toBe('ask'); // Global unchanged
    });

    it('should handle multiple agent overrides', () => {
      store.setAgentMode('agent-1', 'plan');
      store.setAgentMode('agent-2', 'auto-accept');
      store.setAgentMode('agent-3', 'ask');

      expect(store.getEffectiveMode('agent-1')).toBe('plan');
      expect(store.getEffectiveMode('agent-2')).toBe('auto-accept');
      expect(store.getEffectiveMode('agent-3')).toBe('ask');
    });

    it('should clear agent override', () => {
      store.setAgentMode('agent-1', 'plan');
      expect(store.getEffectiveMode('agent-1')).toBe('plan');

      store.clearAgentMode('agent-1');
      expect(store.getEffectiveMode('agent-1')).toBe('ask'); // Falls back to global
    });

    it('should not persist if agent mode is unchanged', () => {
      store.setAgentMode('agent-1', 'plan');
      mockLocalStorage.setItem.mockClear();

      store.setAgentMode('agent-1', 'plan'); // Same mode
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it('should handle clearing non-existent agent override', () => {
      expect(() => store.clearAgentMode('non-existent')).not.toThrow();
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it('should persist agent overrides to localStorage', () => {
      store.setAgentMode('agent-1', 'plan');
      store.setAgentMode('agent-2', 'auto-accept');

      const savedState = JSON.parse(mockLocalStorage._getStore()['permission-mode-state']);
      expect(savedState.agentOverrides).toEqual({
        'agent-1': 'plan',
        'agent-2': 'auto-accept',
      });
    });
  });

  // ===========================================================================
  // Effective Mode Resolution
  // ===========================================================================

  describe('Effective Mode Resolution', () => {
    it('should return global mode when no agent override exists', () => {
      store.setGlobalMode('plan');
      expect(store.getEffectiveMode('agent-without-override')).toBe('plan');
    });

    it('should return agent override when it exists', () => {
      store.setGlobalMode('plan');
      store.setAgentMode('agent-1', 'auto-accept');

      expect(store.getEffectiveMode('agent-1')).toBe('auto-accept');
    });

    it('should return global mode when agentId is undefined', () => {
      store.setGlobalMode('plan');
      expect(store.getEffectiveMode(undefined)).toBe('plan');
    });

    it('should return global mode when agentId is empty string', () => {
      store.setGlobalMode('auto-accept');
      expect(store.getEffectiveMode('')).toBe('auto-accept');
    });
  });

  // ===========================================================================
  // Mode Cycling
  // ===========================================================================

  describe('Mode Cycling', () => {
    describe('cycleGlobalMode', () => {
      it('should cycle plan -> auto-accept', () => {
        store.setGlobalMode('plan');
        const nextMode = store.cycleGlobalMode();

        expect(nextMode).toBe('auto-accept');
        expect(store.getGlobalMode()).toBe('auto-accept');
      });

      it('should cycle auto-accept -> ask', () => {
        store.setGlobalMode('auto-accept');
        const nextMode = store.cycleGlobalMode();

        expect(nextMode).toBe('ask');
        expect(store.getGlobalMode()).toBe('ask');
      });

      it('should cycle ask -> plan', () => {
        store.setGlobalMode('ask');
        const nextMode = store.cycleGlobalMode();

        expect(nextMode).toBe('plan');
        expect(store.getGlobalMode()).toBe('plan');
      });

      it('should complete full cycle', () => {
        store.setGlobalMode('plan');

        expect(store.cycleGlobalMode()).toBe('auto-accept');
        expect(store.cycleGlobalMode()).toBe('ask');
        expect(store.cycleGlobalMode()).toBe('plan');
        expect(store.cycleGlobalMode()).toBe('auto-accept');
      });
    });

    describe('cycleAgentMode', () => {
      it('should start cycling from global mode if no override', () => {
        store.setGlobalMode('plan');
        const nextMode = store.cycleAgentMode('agent-1');

        expect(nextMode).toBe('auto-accept');
        expect(store.getEffectiveMode('agent-1')).toBe('auto-accept');
      });

      it('should cycle agent mode when override exists', () => {
        store.setAgentMode('agent-1', 'ask');
        const nextMode = store.cycleAgentMode('agent-1');

        expect(nextMode).toBe('plan');
        expect(store.getEffectiveMode('agent-1')).toBe('plan');
      });

      it('should complete full cycle for agent', () => {
        store.setAgentMode('agent-1', 'plan');

        expect(store.cycleAgentMode('agent-1')).toBe('auto-accept');
        expect(store.cycleAgentMode('agent-1')).toBe('ask');
        expect(store.cycleAgentMode('agent-1')).toBe('plan');
      });

      it('should not affect global mode when cycling agent mode', () => {
        store.setGlobalMode('ask');
        store.cycleAgentMode('agent-1');

        expect(store.getGlobalMode()).toBe('ask'); // Unchanged
      });

      it('should not affect other agents when cycling one agent', () => {
        store.setAgentMode('agent-1', 'plan');
        store.setAgentMode('agent-2', 'ask');

        store.cycleAgentMode('agent-1');

        expect(store.getEffectiveMode('agent-1')).toBe('auto-accept');
        expect(store.getEffectiveMode('agent-2')).toBe('ask'); // Unchanged
      });
    });
  });

  // ===========================================================================
  // Subscriptions
  // ===========================================================================

  describe('Subscriptions', () => {
    describe('Agent-specific subscriptions', () => {
      it('should notify listener when agent mode changes', () => {
        const listener = vi.fn();
        store.subscribe('agent-1', listener);

        store.setAgentMode('agent-1', 'plan');

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith('plan');
      });

      it('should notify listener when agent override is cleared', () => {
        store.setAgentMode('agent-1', 'plan');

        const listener = vi.fn();
        store.subscribe('agent-1', listener);

        store.clearAgentMode('agent-1');

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith('ask'); // Falls back to global
      });

      it('should support multiple listeners for same agent', () => {
        const listener1 = vi.fn();
        const listener2 = vi.fn();

        store.subscribe('agent-1', listener1);
        store.subscribe('agent-1', listener2);

        store.setAgentMode('agent-1', 'plan');

        expect(listener1).toHaveBeenCalledTimes(1);
        expect(listener2).toHaveBeenCalledTimes(1);
      });

      it('should not notify listeners for other agents', () => {
        const listener1 = vi.fn();
        const listener2 = vi.fn();

        store.subscribe('agent-1', listener1);
        store.subscribe('agent-2', listener2);

        store.setAgentMode('agent-1', 'plan');

        expect(listener1).toHaveBeenCalledTimes(1);
        expect(listener2).not.toHaveBeenCalled();
      });

      it('should unsubscribe listener', () => {
        const listener = vi.fn();
        const unsubscribe = store.subscribe('agent-1', listener);

        store.setAgentMode('agent-1', 'plan');
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();

        store.setAgentMode('agent-1', 'auto-accept');
        expect(listener).toHaveBeenCalledTimes(1); // Not called again
      });

      it('should cleanup empty listener sets', () => {
        const listener = vi.fn();
        const unsubscribe = store.subscribe('agent-1', listener);

        unsubscribe();

        // Should not throw when setting mode after all listeners removed
        expect(() => store.setAgentMode('agent-1', 'plan')).not.toThrow();
      });
    });

    describe('Global subscriptions', () => {
      it('should notify global listener on global mode change', () => {
        const listener = vi.fn();
        store.subscribeGlobal(listener);

        store.setGlobalMode('plan');

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith('plan');
      });

      it('should notify global listener on agent mode change', () => {
        const listener = vi.fn();
        store.subscribeGlobal(listener);

        store.setAgentMode('agent-1', 'plan');

        // Global listeners are notified because effective mode may have changed
        expect(listener).toHaveBeenCalled();
      });

      it('should support multiple global listeners', () => {
        const listener1 = vi.fn();
        const listener2 = vi.fn();

        store.subscribeGlobal(listener1);
        store.subscribeGlobal(listener2);

        store.setGlobalMode('plan');

        expect(listener1).toHaveBeenCalledTimes(1);
        expect(listener2).toHaveBeenCalledTimes(1);
      });

      it('should unsubscribe global listener', () => {
        const listener = vi.fn();
        const unsubscribe = store.subscribeGlobal(listener);

        store.setGlobalMode('plan');
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();

        store.setGlobalMode('auto-accept');
        expect(listener).toHaveBeenCalledTimes(1); // Not called again
      });
    });
  });

  // ===========================================================================
  // Persistence
  // ===========================================================================

  describe('Persistence', () => {
    describe('Loading from storage', () => {
      it('should restore global mode from localStorage', () => {
        mockLocalStorage._setStore({
          'permission-mode-state': JSON.stringify({
            globalMode: 'plan',
            agentOverrides: {},
          }),
        });

        const newStore = new PermissionModeStore();
        expect(newStore.getGlobalMode()).toBe('plan');
      });

      it('should restore agent overrides from localStorage', () => {
        mockLocalStorage._setStore({
          'permission-mode-state': JSON.stringify({
            globalMode: 'ask',
            agentOverrides: {
              'agent-1': 'plan',
              'agent-2': 'auto-accept',
            },
          }),
        });

        const newStore = new PermissionModeStore();
        expect(newStore.getEffectiveMode('agent-1')).toBe('plan');
        expect(newStore.getEffectiveMode('agent-2')).toBe('auto-accept');
      });

      it('should handle missing localStorage data gracefully', () => {
        mockLocalStorage.getItem.mockReturnValue(null);

        const newStore = new PermissionModeStore();
        expect(newStore.getGlobalMode()).toBe('ask'); // Default
      });

      it('should handle invalid JSON in localStorage gracefully', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockLocalStorage._setStore({
          'permission-mode-state': 'not valid json',
        });

        const newStore = new PermissionModeStore();
        expect(newStore.getGlobalMode()).toBe('ask'); // Default

        consoleSpy.mockRestore();
      });

      it('should ignore invalid mode values from localStorage', () => {
        mockLocalStorage._setStore({
          'permission-mode-state': JSON.stringify({
            globalMode: 'invalid-mode',
            agentOverrides: {
              'agent-1': 'also-invalid',
            },
          }),
        });

        const newStore = new PermissionModeStore();
        expect(newStore.getGlobalMode()).toBe('ask'); // Default, invalid ignored
        expect(newStore.getEffectiveMode('agent-1')).toBe('ask'); // Falls back to global
      });

      it('should only load valid mode values', () => {
        mockLocalStorage._setStore({
          'permission-mode-state': JSON.stringify({
            globalMode: 'plan',
            agentOverrides: {
              'agent-1': 'auto-accept',
              'agent-2': 'invalid-mode', // Should be ignored
              'agent-3': 'ask',
            },
          }),
        });

        const newStore = new PermissionModeStore();
        expect(newStore.getGlobalMode()).toBe('plan');
        expect(newStore.getEffectiveMode('agent-1')).toBe('auto-accept');
        expect(newStore.getEffectiveMode('agent-2')).toBe('plan'); // Falls back to global
        expect(newStore.getEffectiveMode('agent-3')).toBe('ask');
      });
    });

    describe('Saving to storage', () => {
      it('should persist state on global mode change', () => {
        store.setGlobalMode('plan');

        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'permission-mode-state',
          expect.any(String)
        );

        const savedState = JSON.parse(mockLocalStorage._getStore()['permission-mode-state']);
        expect(savedState.globalMode).toBe('plan');
      });

      it('should persist state on agent mode change', () => {
        store.setAgentMode('agent-1', 'auto-accept');

        const savedState = JSON.parse(mockLocalStorage._getStore()['permission-mode-state']);
        expect(savedState.agentOverrides['agent-1']).toBe('auto-accept');
      });

      it('should persist state on agent mode clear', () => {
        store.setAgentMode('agent-1', 'plan');
        mockLocalStorage.setItem.mockClear();

        store.clearAgentMode('agent-1');

        expect(mockLocalStorage.setItem).toHaveBeenCalled();
        const savedState = JSON.parse(mockLocalStorage._getStore()['permission-mode-state']);
        expect(savedState.agentOverrides['agent-1']).toBeUndefined();
      });

      it('should handle localStorage write errors gracefully', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockLocalStorage.setItem.mockImplementation(() => {
          throw new Error('Storage quota exceeded');
        });

        // Should not throw
        expect(() => store.setGlobalMode('plan')).not.toThrow();

        consoleSpy.mockRestore();
      });
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('Edge Cases', () => {
    it('should handle rapid mode cycling', () => {
      for (let i = 0; i < 100; i++) {
        store.cycleGlobalMode();
      }

      // After 100 cycles (100 % 3 = 1), should be at second position
      // Starting from 'ask' (index 2): cycle 1 -> 'plan', so after 100 cycles...
      // 100 % 3 = 1, so one step from 'ask' -> 'plan'
      expect(store.getGlobalMode()).toBe('plan');
    });

    it('should handle many agent overrides', () => {
      for (let i = 0; i < 100; i++) {
        const modes: PermissionMode[] = ['plan', 'auto-accept', 'ask'];
        store.setAgentMode(`agent-${i}`, modes[i % 3]);
      }

      expect(store.getEffectiveMode('agent-0')).toBe('plan');
      expect(store.getEffectiveMode('agent-1')).toBe('auto-accept');
      expect(store.getEffectiveMode('agent-2')).toBe('ask');
      expect(store.getEffectiveMode('agent-99')).toBe('plan'); // 99 % 3 = 0
    });

    it('should handle concurrent subscriptions and unsubscriptions', () => {
      const listeners: (() => void)[] = [];

      // Add many listeners
      for (let i = 0; i < 10; i++) {
        const unsubscribe = store.subscribe('agent-1', vi.fn());
        listeners.push(unsubscribe);
      }

      // Remove half
      for (let i = 0; i < 5; i++) {
        listeners[i]();
      }

      // Should not throw when changing mode
      expect(() => store.setAgentMode('agent-1', 'plan')).not.toThrow();
    });
  });
});

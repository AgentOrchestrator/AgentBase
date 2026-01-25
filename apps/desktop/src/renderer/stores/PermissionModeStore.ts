/**
 * Permission Mode Store
 *
 * Manages permission mode cycling for agents (Plan → Auto-Accept → Ask).
 * Supports global default and per-agent overrides with localStorage persistence.
 */

import type { PermissionMode } from '@agent-orchestrator/shared';

const STORAGE_KEY = 'permission-mode-state';
const DEFAULT_MODE: PermissionMode = 'ask';

/**
 * Cycle order for permission modes
 * Plan (restrictive) → Auto-Accept (permissive) → Ask (interactive)
 */
const MODE_CYCLE: PermissionMode[] = ['plan', 'auto-accept', 'ask'];

export type PermissionModeListener = (mode: PermissionMode) => void;
export type AllModeChangeListener = (globalMode: PermissionMode) => void;

interface PersistedState {
  globalMode: PermissionMode;
  agentOverrides: Record<string, PermissionMode>;
}

export class PermissionModeStore {
  private globalMode: PermissionMode = DEFAULT_MODE;
  private agentOverrides = new Map<string, PermissionMode>();
  private listenersByAgent = new Map<string, Set<PermissionModeListener>>();
  private globalListeners = new Set<AllModeChangeListener>();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Get the effective permission mode for an agent
   * Returns agent-specific override if set, otherwise returns global mode
   */
  getEffectiveMode(agentId?: string): PermissionMode {
    if (agentId && this.agentOverrides.has(agentId)) {
      return this.agentOverrides.get(agentId)!;
    }
    return this.globalMode;
  }

  /**
   * Get the global permission mode
   */
  getGlobalMode(): PermissionMode {
    return this.globalMode;
  }

  /**
   * Set the global permission mode
   */
  setGlobalMode(mode: PermissionMode): void {
    if (this.globalMode === mode) return;
    this.globalMode = mode;
    this.persistToStorage();
    this.notifyGlobalListeners();
  }

  /**
   * Set permission mode for a specific agent (override)
   */
  setAgentMode(agentId: string, mode: PermissionMode): void {
    const current = this.agentOverrides.get(agentId);
    if (current === mode) return;

    this.agentOverrides.set(agentId, mode);
    this.persistToStorage();
    this.notifyAgentListeners(agentId);
  }

  /**
   * Remove agent-specific override (agent will use global mode)
   */
  clearAgentMode(agentId: string): void {
    if (!this.agentOverrides.has(agentId)) return;

    this.agentOverrides.delete(agentId);
    this.persistToStorage();
    this.notifyAgentListeners(agentId);
  }

  /**
   * Cycle the global permission mode to the next value
   */
  cycleGlobalMode(): PermissionMode {
    const currentIndex = MODE_CYCLE.indexOf(this.globalMode);
    const nextIndex = (currentIndex + 1) % MODE_CYCLE.length;
    const nextMode = MODE_CYCLE[nextIndex];
    this.setGlobalMode(nextMode);
    return nextMode;
  }

  /**
   * Cycle permission mode for a specific agent
   * If agent has no override, cycles from current effective mode (global)
   */
  cycleAgentMode(agentId: string): PermissionMode {
    const currentMode = this.getEffectiveMode(agentId);
    const currentIndex = MODE_CYCLE.indexOf(currentMode);
    const nextIndex = (currentIndex + 1) % MODE_CYCLE.length;
    const nextMode = MODE_CYCLE[nextIndex];
    this.setAgentMode(agentId, nextMode);
    return nextMode;
  }

  /**
   * Subscribe to mode changes for a specific agent
   */
  subscribe(agentId: string, listener: PermissionModeListener): () => void {
    if (!this.listenersByAgent.has(agentId)) {
      this.listenersByAgent.set(agentId, new Set());
    }
    this.listenersByAgent.get(agentId)!.add(listener);

    return () => {
      const listeners = this.listenersByAgent.get(agentId);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.listenersByAgent.delete(agentId);
        }
      }
    };
  }

  /**
   * Subscribe to global mode changes
   */
  subscribeGlobal(listener: AllModeChangeListener): () => void {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  private notifyAgentListeners(agentId: string): void {
    const mode = this.getEffectiveMode(agentId);
    const listeners = this.listenersByAgent.get(agentId);
    if (listeners) {
      listeners.forEach((listener) => listener(mode));
    }
    // Also notify global listeners since effective mode may have changed
    this.notifyGlobalListeners();
  }

  private notifyGlobalListeners(): void {
    this.globalListeners.forEach((listener) => listener(this.globalMode));
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const state: PersistedState = JSON.parse(stored);
        if (state.globalMode && MODE_CYCLE.includes(state.globalMode)) {
          this.globalMode = state.globalMode;
        }
        if (state.agentOverrides) {
          for (const [agentId, mode] of Object.entries(state.agentOverrides)) {
            if (MODE_CYCLE.includes(mode)) {
              this.agentOverrides.set(agentId, mode);
            }
          }
        }
      }
    } catch (error) {
      console.warn('[PermissionModeStore] Failed to load from storage:', error);
    }
  }

  private persistToStorage(): void {
    try {
      const state: PersistedState = {
        globalMode: this.globalMode,
        agentOverrides: Object.fromEntries(this.agentOverrides),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('[PermissionModeStore] Failed to persist to storage:', error);
    }
  }
}

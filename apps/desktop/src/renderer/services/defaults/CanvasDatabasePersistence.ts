/**
 * CanvasDatabasePersistence
 *
 * Persists agent status to the canvas database via IPC.
 * Uses the existing canvasAPI bridge pattern.
 */

import type { CodingAgentState, IStatusPersistence } from '../../../../types/coding-agent-status';

/**
 * Interface for the agent status API exposed via preload.
 * This will be added to the window.agentStatusAPI.
 */
export interface AgentStatusAPI {
  saveAgentStatus(agentId: string, state: CodingAgentState): Promise<void>;
  loadAgentStatus(agentId: string): Promise<CodingAgentState | null>;
  deleteAgentStatus(agentId: string): Promise<void>;
  loadAllAgentStatuses(): Promise<CodingAgentState[]>;
}

/**
 * Persists agent status to the canvas database.
 * Requires agentStatusAPI to be exposed via preload.ts.
 */
export class CanvasDatabasePersistence implements IStatusPersistence {
  constructor(private readonly api: AgentStatusAPI) {}

  async save(state: CodingAgentState): Promise<void> {
    try {
      await this.api.saveAgentStatus(state.agentId, state);
    } catch (error) {
      console.error(`[CanvasDatabasePersistence] Failed to save agent status:`, error);
      throw error;
    }
  }

  async load(agentId: string): Promise<CodingAgentState | null> {
    try {
      return await this.api.loadAgentStatus(agentId);
    } catch (error) {
      console.error(`[CanvasDatabasePersistence] Failed to load agent status:`, error);
      return null;
    }
  }

  async delete(agentId: string): Promise<void> {
    try {
      await this.api.deleteAgentStatus(agentId);
    } catch (error) {
      console.error(`[CanvasDatabasePersistence] Failed to delete agent status:`, error);
      throw error;
    }
  }

  async loadAll(): Promise<CodingAgentState[]> {
    try {
      return await this.api.loadAllAgentStatuses();
    } catch (error) {
      console.error(`[CanvasDatabasePersistence] Failed to load all agent statuses:`, error);
      return [];
    }
  }
}

/**
 * In-memory persistence for testing or when database is unavailable.
 */
export class InMemoryPersistence implements IStatusPersistence {
  private storage: Map<string, CodingAgentState> = new Map();

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
    return Array.from(this.storage.values()).map((state) => ({ ...state }));
  }
}

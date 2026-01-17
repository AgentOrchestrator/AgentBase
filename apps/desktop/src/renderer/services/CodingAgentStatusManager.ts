/**
 * CodingAgentStatusManager
 *
 * Manages status, title, and summary for coding agents.
 * All dependencies are injected via constructor for modularity and testability.
 */

import type {
  AgentType,
  CodingAgentState,
  CodingAgentStatus,
  CodingAgentStatusInfo,
  ICodingAgentStatusManager,
  IStatusPersistence,
  ISummaryComputer,
  ITitleComputer,
  StatusChangeListener,
  TitleConfig,
} from '../../../types/coding-agent-status';

/**
 * Default title configuration for new agents.
 */
function createDefaultTitle(): TitleConfig {
  return {
    value: 'Untitled Session',
    isManuallySet: false,
    computedFrom: undefined,
  };
}

/**
 * Default status info for new agents.
 */
function createDefaultStatusInfo(): CodingAgentStatusInfo {
  return {
    status: 'idle',
    startedAt: Date.now(),
  };
}

/**
 * Implementation of ICodingAgentStatusManager.
 *
 * Features:
 * - In-memory state storage with Map
 * - Event emitter pattern for status changes
 * - Dependency injection for title/summary computation and persistence
 */
export class CodingAgentStatusManager implements ICodingAgentStatusManager {
  private states: Map<string, CodingAgentState> = new Map();
  private listeners: Set<StatusChangeListener> = new Set();

  constructor(
    private readonly titleComputer: ITitleComputer,
    private readonly summaryComputer: ISummaryComputer,
    private readonly persistence: IStatusPersistence
  ) {}

  // ===========================================================================
  // Status Management
  // ===========================================================================

  getStatus(agentId: string): CodingAgentStatusInfo | null {
    const state = this.states.get(agentId);
    return state?.statusInfo ?? null;
  }

  updateStatus(
    agentId: string,
    status: CodingAgentStatus,
    context?: Partial<Omit<CodingAgentStatusInfo, 'status' | 'startedAt'>>
  ): void {
    const state = this.states.get(agentId);
    if (!state) {
      console.warn(
        `[CodingAgentStatusManager] Cannot update status for unregistered agent: ${agentId}`
      );
      return;
    }

    const oldStatus = { ...state.statusInfo };
    const newStatus: CodingAgentStatusInfo = {
      status,
      startedAt: Date.now(),
      ...context,
    };

    state.statusInfo = newStatus;
    state.updatedAt = Date.now();

    // Notify listeners
    this.notifyListeners(agentId, oldStatus, newStatus);
  }

  // ===========================================================================
  // Title Management
  // ===========================================================================

  getTitle(agentId: string): TitleConfig | null {
    const state = this.states.get(agentId);
    return state?.title ?? null;
  }

  setTitle(agentId: string, title: string): void {
    const state = this.states.get(agentId);
    if (!state) {
      console.warn(
        `[CodingAgentStatusManager] Cannot set title for unregistered agent: ${agentId}`
      );
      return;
    }

    state.title = {
      value: title,
      isManuallySet: true,
      computedFrom: undefined,
    };
    state.updatedAt = Date.now();
  }

  async computeTitle(agentId: string, userMessages: string[]): Promise<void> {
    const state = this.states.get(agentId);
    if (!state) {
      console.warn(
        `[CodingAgentStatusManager] Cannot compute title for unregistered agent: ${agentId}`
      );
      return;
    }

    // Don't overwrite manually set titles
    if (state.title.isManuallySet) {
      return;
    }

    const computedTitle = await this.titleComputer.computeTitle(userMessages);
    state.title = {
      value: computedTitle,
      isManuallySet: false,
      computedFrom: userMessages.slice(0, 3), // Store first 3 messages
    };
    state.updatedAt = Date.now();
  }

  // ===========================================================================
  // Summary Management
  // ===========================================================================

  getSummary(agentId: string): string | null {
    const state = this.states.get(agentId);
    return state?.summary ?? null;
  }

  async computeSummary(agentId: string, messages: string[]): Promise<void> {
    const state = this.states.get(agentId);
    if (!state) {
      console.warn(
        `[CodingAgentStatusManager] Cannot compute summary for unregistered agent: ${agentId}`
      );
      return;
    }

    const computedSummary = await this.summaryComputer.computeSummary(messages);
    state.summary = computedSummary;
    state.updatedAt = Date.now();
  }

  // ===========================================================================
  // Full State Access
  // ===========================================================================

  getState(agentId: string): CodingAgentState | null {
    const state = this.states.get(agentId);
    return state ? { ...state } : null;
  }

  getAllStates(): CodingAgentState[] {
    return Array.from(this.states.values()).map((state) => ({ ...state }));
  }

  // ===========================================================================
  // Agent Lifecycle
  // ===========================================================================

  registerAgent(agentId: string, agentType: AgentType): void {
    if (this.states.has(agentId)) {
      console.warn(`[CodingAgentStatusManager] Agent already registered: ${agentId}`);
      return;
    }

    const now = Date.now();
    const newState: CodingAgentState = {
      agentId,
      agentType,
      statusInfo: createDefaultStatusInfo(),
      title: createDefaultTitle(),
      summary: null,
      createdAt: now,
      updatedAt: now,
    };

    this.states.set(agentId, newState);
  }

  unregisterAgent(agentId: string): void {
    this.states.delete(agentId);
  }

  // ===========================================================================
  // Event Subscription
  // ===========================================================================

  onStatusChange(listener: StatusChangeListener): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(
    agentId: string,
    oldStatus: CodingAgentStatusInfo,
    newStatus: CodingAgentStatusInfo
  ): void {
    for (const listener of this.listeners) {
      try {
        listener(agentId, oldStatus, newStatus);
      } catch (error) {
        console.error(`[CodingAgentStatusManager] Error in status change listener:`, error);
      }
    }
  }

  // ===========================================================================
  // Persistence
  // ===========================================================================

  async persist(agentId: string): Promise<void> {
    const state = this.states.get(agentId);
    if (!state) {
      console.warn(`[CodingAgentStatusManager] Cannot persist unregistered agent: ${agentId}`);
      return;
    }

    await this.persistence.save(state);
  }

  async restore(agentId: string): Promise<void> {
    const state = await this.persistence.load(agentId);
    if (state) {
      this.states.set(agentId, state);
    }
  }

  async restoreAll(): Promise<void> {
    const states = await this.persistence.loadAll();
    for (const state of states) {
      this.states.set(state.agentId, state);
    }
  }
}

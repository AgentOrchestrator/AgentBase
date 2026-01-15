/**
 * Agent Action Store
 *
 * Tracks hook-driven actions (permissions/questions) per agent.
 * Views can subscribe to agent-scoped or global action updates.
 */

import type { AgentAction } from '@agent-orchestrator/shared';

export type AgentActionListener = (actions: AgentAction[]) => void;
export type AllAgentActionsListener = (actions: AgentAction[]) => void;

const UNKNOWN_AGENT_KEY = '__unknown__';

export class AgentActionStore {
  private actionsByAgent = new Map<string, AgentAction[]>();
  private listenersByAgent = new Map<string, Set<AgentActionListener>>();
  private allListeners = new Set<AllAgentActionsListener>();

  getActions(agentId?: string | null): AgentAction[] {
    if (!agentId) {
      return this.getAllActions();
    }
    return [...(this.actionsByAgent.get(agentId) ?? [])];
  }

  getAllActions(): AgentAction[] {
    const all: AgentAction[] = [];
    for (const actions of this.actionsByAgent.values()) {
      all.push(...actions);
    }
    return all;
  }

  addAction(action: AgentAction): void {
    const agentKey = this.resolveAgentKey(action.agentId);
    const existing = this.actionsByAgent.get(agentKey) ?? [];

    if (existing.some((entry) => entry.id === action.id)) {
      return;
    }

    this.actionsByAgent.set(agentKey, [...existing, action]);
    this.notify(agentKey);
  }

  removeAction(actionId: string, agentId?: string | null): void {
    if (agentId) {
      this.removeFromAgent(agentId, actionId);
      return;
    }

    for (const agentKey of this.actionsByAgent.keys()) {
      if (this.removeFromAgent(agentKey, actionId)) {
        break;
      }
    }
  }

  clearAgent(agentId: string): void {
    if (!this.actionsByAgent.has(agentId)) {
      return;
    }

    this.actionsByAgent.delete(agentId);
    this.notify(agentId);
  }

  subscribe(agentId: string, listener: AgentActionListener): () => void {
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

  subscribeAll(listener: AllAgentActionsListener): () => void {
    this.allListeners.add(listener);
    return () => {
      this.allListeners.delete(listener);
    };
  }

  private removeFromAgent(agentId: string, actionId: string): boolean {
    const actions = this.actionsByAgent.get(agentId);
    if (!actions) {
      return false;
    }

    const next = actions.filter((action) => action.id !== actionId);
    if (next.length === actions.length) {
      return false;
    }

    if (next.length === 0) {
      this.actionsByAgent.delete(agentId);
    } else {
      this.actionsByAgent.set(agentId, next);
    }

    this.notify(agentId);
    return true;
  }

  private resolveAgentKey(agentId?: string | null): string {
    return agentId || UNKNOWN_AGENT_KEY;
  }

  private notify(agentId: string): void {
    const agentActions = this.getActions(agentId);
    const agentListeners = this.listenersByAgent.get(agentId);
    if (agentListeners) {
      agentListeners.forEach((listener) => listener(agentActions));
    }

    const allActions = this.getAllActions();
    this.allListeners.forEach((listener) => listener(allActions));
  }
}

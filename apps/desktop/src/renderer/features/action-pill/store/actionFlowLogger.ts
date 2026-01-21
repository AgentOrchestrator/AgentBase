/**
 * ActionFlowLogger Store
 *
 * Tracks the complete flow of actions from node creation to highlighting.
 * Provides a log of all agentId-related events for debugging.
 */

import { create } from 'zustand';

export type LogLevel = 'info' | 'warning' | 'error' | 'success';

export interface ActionFlowLogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  step: string;
  message: string;
  agentId?: string;
  nodeId?: string;
  actionId?: string;
  details?: Record<string, unknown>;
}

interface ActionFlowLoggerState {
  logs: ActionFlowLogEntry[];
  maxLogs: number;
  addLog: (
    step: string,
    message: string,
    level?: LogLevel,
    data?: {
      agentId?: string;
      nodeId?: string;
      actionId?: string;
      details?: Record<string, unknown>;
    }
  ) => void;
  clearLogs: () => void;
}

export const useActionFlowLogger = create<ActionFlowLoggerState>((set, get) => ({
  logs: [],
  maxLogs: 200,

  addLog: (step, message, level = 'info', data = {}) => {
    const entry: ActionFlowLogEntry = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      level,
      step,
      message,
      agentId: data.agentId,
      nodeId: data.nodeId,
      actionId: data.actionId,
      details: data.details,
    };

    set((state) => {
      const newLogs = [...state.logs, entry];
      // Keep only the last maxLogs entries
      const trimmedLogs =
        newLogs.length > state.maxLogs ? newLogs.slice(-state.maxLogs) : newLogs;
      return { logs: trimmedLogs };
    });
  },

  clearLogs: () => {
    set({ logs: [] });
  },
}));

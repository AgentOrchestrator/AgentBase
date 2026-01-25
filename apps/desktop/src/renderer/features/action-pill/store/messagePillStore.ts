/**
 * MessagePill Zustand Store
 *
 * Centralized state management for the MessagePill feature.
 */

import { create } from 'zustand';
import type { MessagePillState, SentMessage } from './messagePillTypes';

const MAX_HISTORY_SIZE = 50;

export const useMessagePillStore = create<MessagePillState>((set) => ({
  // Initial state
  inputValue: '',
  isSending: false,
  targetAgentId: null,
  sentHistory: [],

  // Actions - Input
  setInputValue: (value: string) => {
    set({ inputValue: value });
  },

  clearInput: () => {
    set({ inputValue: '' });
  },

  // Actions - Sending
  setSending: (isSending: boolean) => {
    set({ isSending });
  },

  addToHistory: (message: SentMessage) => {
    set((state) => {
      const newHistory = [message, ...state.sentHistory].slice(0, MAX_HISTORY_SIZE);
      return { sentHistory: newHistory };
    });
  },

  // Actions - Target
  setTargetAgent: (agentId: string | null) => {
    set({ targetAgentId: agentId });
  },
}));

/**
 * Selectors for common derived values
 */
export const selectHasInput = (state: MessagePillState): boolean => {
  return state.inputValue.trim().length > 0;
};

export const selectCanSend = (state: MessagePillState): boolean => {
  return state.inputValue.trim().length > 0 && !state.isSending;
};

export const selectRecentHistory = (state: MessagePillState, count = 10): SentMessage[] => {
  return state.sentHistory.slice(0, count);
};

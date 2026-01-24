/**
 * Orchestrator Pill Zustand Store
 *
 * State management for the meta-orchestrator chat UI.
 */

import { create } from 'zustand';
import type { OrchestratorMessage, OrchestratorPillState } from './orchestratorPillTypes';

export const useOrchestratorPillStore = create<OrchestratorPillState>((set, get) => ({
  // Initial state
  conversationId: null,
  messages: [],
  inputValue: '',
  isSending: false,
  streamingContent: '',
  health: null,

  // Initialize: check health and restore conversation
  initialize: async () => {
    const api = window.orchestratorAPI;
    if (!api) {
      console.error('[OrchestratorPillStore] orchestratorAPI not available');
      return;
    }

    const health = await api.getHealth();
    const recent = await api.getMostRecentConversation();

    if (recent) {
      const messages = await api.getMessages(recent.id);
      set({ conversationId: recent.id, messages, health });
    } else {
      set({ health });
    }
  },

  // Send a message
  sendMessage: async () => {
    const { conversationId, inputValue } = get();
    if (!inputValue.trim()) return;

    const api = window.orchestratorAPI;
    if (!api) {
      console.error('[OrchestratorPillStore] orchestratorAPI not available');
      return;
    }

    set({ isSending: true, streamingContent: '' });

    let convId = conversationId;
    if (!convId) {
      const conv = await api.createConversation();
      convId = conv.id;
      set({ conversationId: convId });
    }

    // Add user message optimistically
    const userMsg: OrchestratorMessage = {
      id: crypto.randomUUID(),
      conversationId: convId,
      role: 'user',
      content: inputValue,
      timestamp: Date.now(),
    };
    set((state) => ({
      messages: [...state.messages, userMsg],
      inputValue: '',
    }));

    // Stream response
    const response = await api.sendMessage(convId, inputValue, (chunk) => {
      set((state) => ({
        streamingContent: state.streamingContent + chunk,
      }));
    });

    // Add assistant message
    const assistantMsg: OrchestratorMessage = {
      id: crypto.randomUUID(),
      conversationId: convId,
      role: 'assistant',
      content: response.content,
      timestamp: Date.now(),
      toolCalls: response.toolCalls,
    };

    set((state) => ({
      messages: [...state.messages, assistantMsg],
      isSending: false,
      streamingContent: '',
    }));
  },

  // Set input value
  setInputValue: (value: string) => {
    set({ inputValue: value });
  },

  // Reset all state
  reset: () => {
    set({
      conversationId: null,
      messages: [],
      inputValue: '',
      streamingContent: '',
    });
  },
}));

/**
 * Selector: Can send a message?
 */
export const selectCanSend = (state: OrchestratorPillState): boolean => {
  return (
    state.inputValue.trim().length > 0 && !state.isSending && state.health?.cliAvailable === true
  );
};

/**
 * Selector: Has input?
 */
export const selectHasInput = (state: OrchestratorPillState): boolean => {
  return state.inputValue.trim().length > 0;
};

/**
 * Selector: Is CLI available?
 */
export const selectCliAvailable = (state: OrchestratorPillState): boolean => {
  return state.health?.cliAvailable === true;
};

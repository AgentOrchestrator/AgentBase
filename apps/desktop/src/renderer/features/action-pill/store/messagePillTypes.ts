/**
 * MessagePill Store Types
 *
 * Defines the shape of the MessagePill Zustand store.
 */

/**
 * Sent message record for history
 */
export interface SentMessage {
  id: string;
  content: string;
  targetAgentId: string | null;
  timestamp: number;
}

/**
 * MessagePill store state and actions
 */
export interface MessagePillState {
  // Core state
  inputValue: string;
  isSending: boolean;
  targetAgentId: string | null;

  // History (last N messages sent)
  sentHistory: SentMessage[];

  // Actions - Input
  setInputValue: (value: string) => void;
  clearInput: () => void;

  // Actions - Sending
  setSending: (isSending: boolean) => void;
  addToHistory: (message: SentMessage) => void;

  // Actions - Target
  setTargetAgent: (agentId: string | null) => void;
}

/**
 * MessagePill Store Tests
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  selectCanSend,
  selectHasInput,
  selectRecentHistory,
  useMessagePillStore,
} from '../store/messagePillStore';
import type { SentMessage } from '../store/messagePillTypes';

// Mock message data
function createMockSentMessage(id: string, content: string, agentId: string | null): SentMessage {
  return {
    id,
    content,
    targetAgentId: agentId,
    timestamp: Date.now(),
  };
}

describe('MessagePillStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useMessagePillStore.setState({
      inputValue: '',
      isSending: false,
      targetAgentId: null,
      sentHistory: [],
    });
  });

  describe('input actions', () => {
    it('should set input value', () => {
      useMessagePillStore.getState().setInputValue('Hello agent');

      expect(useMessagePillStore.getState().inputValue).toBe('Hello agent');
    });

    it('should clear input', () => {
      useMessagePillStore.getState().setInputValue('Hello agent');
      useMessagePillStore.getState().clearInput();

      expect(useMessagePillStore.getState().inputValue).toBe('');
    });
  });

  describe('sending state', () => {
    it('should set sending state to true', () => {
      useMessagePillStore.getState().setSending(true);

      expect(useMessagePillStore.getState().isSending).toBe(true);
    });

    it('should set sending state to false', () => {
      useMessagePillStore.getState().setSending(true);
      useMessagePillStore.getState().setSending(false);

      expect(useMessagePillStore.getState().isSending).toBe(false);
    });
  });

  describe('target agent', () => {
    it('should set target agent', () => {
      useMessagePillStore.getState().setTargetAgent('agent-123');

      expect(useMessagePillStore.getState().targetAgentId).toBe('agent-123');
    });

    it('should clear target agent', () => {
      useMessagePillStore.getState().setTargetAgent('agent-123');
      useMessagePillStore.getState().setTargetAgent(null);

      expect(useMessagePillStore.getState().targetAgentId).toBeNull();
    });
  });

  describe('history', () => {
    it('should add message to history', () => {
      const message = createMockSentMessage('msg-1', 'Hello', 'agent-1');
      useMessagePillStore.getState().addToHistory(message);

      const state = useMessagePillStore.getState();
      expect(state.sentHistory).toHaveLength(1);
      expect(state.sentHistory[0].content).toBe('Hello');
    });

    it('should add messages to front of history (most recent first)', () => {
      const message1 = createMockSentMessage('msg-1', 'First', 'agent-1');
      const message2 = createMockSentMessage('msg-2', 'Second', 'agent-1');

      useMessagePillStore.getState().addToHistory(message1);
      useMessagePillStore.getState().addToHistory(message2);

      const state = useMessagePillStore.getState();
      expect(state.sentHistory[0].content).toBe('Second');
      expect(state.sentHistory[1].content).toBe('First');
    });

    it('should limit history to MAX_HISTORY_SIZE (50)', () => {
      // Add 60 messages
      for (let i = 0; i < 60; i++) {
        useMessagePillStore
          .getState()
          .addToHistory(createMockSentMessage(`msg-${i}`, `Message ${i}`, 'agent-1'));
      }

      const state = useMessagePillStore.getState();
      expect(state.sentHistory).toHaveLength(50);
      // Most recent should be first
      expect(state.sentHistory[0].content).toBe('Message 59');
    });
  });

  describe('selectors', () => {
    describe('selectHasInput', () => {
      it('should return true when input has content', () => {
        useMessagePillStore.getState().setInputValue('Hello');

        expect(selectHasInput(useMessagePillStore.getState())).toBe(true);
      });

      it('should return false when input is empty', () => {
        useMessagePillStore.getState().setInputValue('');

        expect(selectHasInput(useMessagePillStore.getState())).toBe(false);
      });

      it('should return false when input is only whitespace', () => {
        useMessagePillStore.getState().setInputValue('   ');

        expect(selectHasInput(useMessagePillStore.getState())).toBe(false);
      });
    });

    describe('selectCanSend', () => {
      it('should return true when has input and not sending', () => {
        useMessagePillStore.getState().setInputValue('Hello');
        useMessagePillStore.getState().setSending(false);

        expect(selectCanSend(useMessagePillStore.getState())).toBe(true);
      });

      it('should return false when sending', () => {
        useMessagePillStore.getState().setInputValue('Hello');
        useMessagePillStore.getState().setSending(true);

        expect(selectCanSend(useMessagePillStore.getState())).toBe(false);
      });

      it('should return false when input is empty', () => {
        useMessagePillStore.getState().setInputValue('');
        useMessagePillStore.getState().setSending(false);

        expect(selectCanSend(useMessagePillStore.getState())).toBe(false);
      });
    });

    describe('selectRecentHistory', () => {
      it('should return recent messages up to count', () => {
        for (let i = 0; i < 20; i++) {
          useMessagePillStore
            .getState()
            .addToHistory(createMockSentMessage(`msg-${i}`, `Message ${i}`, 'agent-1'));
        }

        const recent = selectRecentHistory(useMessagePillStore.getState(), 5);
        expect(recent).toHaveLength(5);
        expect(recent[0].content).toBe('Message 19'); // Most recent
      });

      it('should return all if count exceeds history length', () => {
        useMessagePillStore
          .getState()
          .addToHistory(createMockSentMessage('msg-1', 'Message 1', 'agent-1'));
        useMessagePillStore
          .getState()
          .addToHistory(createMockSentMessage('msg-2', 'Message 2', 'agent-1'));

        const recent = selectRecentHistory(useMessagePillStore.getState(), 10);
        expect(recent).toHaveLength(2);
      });

      it('should default to 10 messages', () => {
        for (let i = 0; i < 20; i++) {
          useMessagePillStore
            .getState()
            .addToHistory(createMockSentMessage(`msg-${i}`, `Message ${i}`, 'agent-1'));
        }

        const recent = selectRecentHistory(useMessagePillStore.getState());
        expect(recent).toHaveLength(10);
      });
    });
  });
});

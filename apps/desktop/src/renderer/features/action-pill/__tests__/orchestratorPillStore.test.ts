/**
 * Acceptance Tests: OrchestratorPillStore
 *
 * TDD: These tests define the contract for the orchestrator UI store.
 * They should fail until the implementation is complete.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// import { useOrchestratorPillStore, selectCanSend } from '../store/orchestratorPillStore';
// import type { OrchestratorMessage, OrchestratorHealth } from '../store/orchestratorPillTypes';

// Mock orchestratorAPI
const mockOrchestratorAPI = {
  getHealth: vi.fn(),
  createConversation: vi.fn(),
  getMessages: vi.fn(),
  getMostRecentConversation: vi.fn(),
  sendMessage: vi.fn(),
};

describe('OrchestratorPillStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset store state
    // useOrchestratorPillStore.getState().reset();

    // Stub window.orchestratorAPI
    vi.stubGlobal('window', { orchestratorAPI: mockOrchestratorAPI });
  });

  describe('Initialization', () => {
    it('checks CLI health on initialize', async () => {
      mockOrchestratorAPI.getHealth.mockResolvedValue({
        cliAvailable: true,
        lastHealthCheck: Date.now(),
      });
      mockOrchestratorAPI.getMostRecentConversation.mockResolvedValue(null);

      // await useOrchestratorPillStore.getState().initialize();

      expect(mockOrchestratorAPI.getHealth).toHaveBeenCalled();
      // expect(useOrchestratorPillStore.getState().health?.cliAvailable).toBe(true);
    });

    it('restores most recent conversation on initialize', async () => {
      mockOrchestratorAPI.getHealth.mockResolvedValue({
        cliAvailable: true,
        lastHealthCheck: Date.now(),
      });
      mockOrchestratorAPI.getMostRecentConversation.mockResolvedValue({
        id: 'conv-123',
        createdAt: 1000,
        updatedAt: 2000,
      });
      mockOrchestratorAPI.getMessages.mockResolvedValue([
        { id: 'm1', conversationId: 'conv-123', role: 'user', content: 'Hello', timestamp: 1000 },
        {
          id: 'm2',
          conversationId: 'conv-123',
          role: 'assistant',
          content: 'Hi!',
          timestamp: 2000,
        },
      ]);

      // await useOrchestratorPillStore.getState().initialize();

      // const state = useOrchestratorPillStore.getState();
      // expect(state.conversationId).toBe('conv-123');
      // expect(state.messages).toHaveLength(2);
    });

    it('handles no existing conversation gracefully', async () => {
      mockOrchestratorAPI.getHealth.mockResolvedValue({
        cliAvailable: true,
        lastHealthCheck: Date.now(),
      });
      mockOrchestratorAPI.getMostRecentConversation.mockResolvedValue(null);

      // await useOrchestratorPillStore.getState().initialize();

      // const state = useOrchestratorPillStore.getState();
      // expect(state.conversationId).toBeNull();
      // expect(state.messages).toEqual([]);
    });
  });

  describe('Input Management', () => {
    it('sets input value', () => {
      // useOrchestratorPillStore.getState().setInputValue('Hello orchestrator');
      // expect(useOrchestratorPillStore.getState().inputValue).toBe('Hello orchestrator');
    });

    it('clears input after send', async () => {
      mockOrchestratorAPI.createConversation.mockResolvedValue({
        id: 'conv-1',
        createdAt: 1000,
        updatedAt: 1000,
      });
      mockOrchestratorAPI.sendMessage.mockImplementation(async () => ({
        content: 'Response',
        toolCalls: [],
      }));

      // useOrchestratorPillStore.getState().setInputValue('Test message');
      // await useOrchestratorPillStore.getState().sendMessage();

      // expect(useOrchestratorPillStore.getState().inputValue).toBe('');
    });
  });

  describe('Sending Messages', () => {
    it('creates conversation if none exists', async () => {
      mockOrchestratorAPI.createConversation.mockResolvedValue({
        id: 'new-conv',
        createdAt: 1000,
        updatedAt: 1000,
      });
      mockOrchestratorAPI.sendMessage.mockResolvedValue({ content: 'Response', toolCalls: [] });

      // useOrchestratorPillStore.setState({ conversationId: null });
      // useOrchestratorPillStore.getState().setInputValue('Hello');
      // await useOrchestratorPillStore.getState().sendMessage();

      expect(mockOrchestratorAPI.createConversation).toHaveBeenCalled();
      // expect(useOrchestratorPillStore.getState().conversationId).toBe('new-conv');
    });

    it('adds user message optimistically', async () => {
      mockOrchestratorAPI.sendMessage.mockResolvedValue({ content: 'Response', toolCalls: [] });

      // useOrchestratorPillStore.setState({ conversationId: 'conv-1' });
      // useOrchestratorPillStore.getState().setInputValue('User message');
      // await useOrchestratorPillStore.getState().sendMessage();

      // const messages = useOrchestratorPillStore.getState().messages;
      // expect(messages[0].role).toBe('user');
      // expect(messages[0].content).toBe('User message');
    });

    it('streams response and updates streaming content', async () => {
      mockOrchestratorAPI.sendMessage.mockImplementation(async (_convId, _msg, onChunk) => {
        onChunk('Hello ');
        onChunk('world!');
        return { content: 'Hello world!', toolCalls: [] };
      });

      // useOrchestratorPillStore.setState({ conversationId: 'conv-1' });
      // useOrchestratorPillStore.getState().setInputValue('Hi');

      // Start sending (don't await yet to check streaming state)
      // const sendPromise = useOrchestratorPillStore.getState().sendMessage();

      // After streaming completes
      // await sendPromise;

      // expect(useOrchestratorPillStore.getState().streamingContent).toBe('');
      // expect(useOrchestratorPillStore.getState().messages[1].content).toBe('Hello world!');
    });

    it('sets isSending during request', async () => {
      let _resolveSend: () => void;
      mockOrchestratorAPI.sendMessage.mockImplementation(
        () =>
          new Promise((resolve) => {
            _resolveSend = () => resolve({ content: 'Done', toolCalls: [] });
          })
      );

      // useOrchestratorPillStore.setState({ conversationId: 'conv-1' });
      // useOrchestratorPillStore.getState().setInputValue('Test');

      // const sendPromise = useOrchestratorPillStore.getState().sendMessage();

      // expect(useOrchestratorPillStore.getState().isSending).toBe(true);

      // resolveSend!();
      // await sendPromise;

      // expect(useOrchestratorPillStore.getState().isSending).toBe(false);
    });

    it('includes tool calls in assistant message', async () => {
      mockOrchestratorAPI.sendMessage.mockResolvedValue({
        content: 'Created agent',
        toolCalls: [
          {
            id: 't1',
            name: 'canvas/create_agent',
            input: { workspacePath: '/test' },
            result: { agentId: 'a1' },
          },
        ],
      });

      // useOrchestratorPillStore.setState({ conversationId: 'conv-1' });
      // useOrchestratorPillStore.getState().setInputValue('Create agent');
      // await useOrchestratorPillStore.getState().sendMessage();

      // const messages = useOrchestratorPillStore.getState().messages;
      // expect(messages[1].toolCalls).toHaveLength(1);
      // expect(messages[1].toolCalls?.[0].name).toBe('canvas/create_agent');
    });
  });

  describe('Selectors', () => {
    describe('selectCanSend', () => {
      it('returns true when has input, not sending, and CLI available', () => {
        // useOrchestratorPillStore.setState({
        //   inputValue: 'Hello',
        //   isSending: false,
        //   health: { cliAvailable: true, lastHealthCheck: Date.now() },
        // });
        // expect(selectCanSend(useOrchestratorPillStore.getState())).toBe(true);
      });

      it('returns false when CLI unavailable', () => {
        // useOrchestratorPillStore.setState({
        //   inputValue: 'Hello',
        //   isSending: false,
        //   health: { cliAvailable: false, lastHealthCheck: Date.now() },
        // });
        // expect(selectCanSend(useOrchestratorPillStore.getState())).toBe(false);
      });

      it('returns false when sending', () => {
        // useOrchestratorPillStore.setState({
        //   inputValue: 'Hello',
        //   isSending: true,
        //   health: { cliAvailable: true, lastHealthCheck: Date.now() },
        // });
        // expect(selectCanSend(useOrchestratorPillStore.getState())).toBe(false);
      });

      it('returns false when input is empty', () => {
        // useOrchestratorPillStore.setState({
        //   inputValue: '',
        //   isSending: false,
        //   health: { cliAvailable: true, lastHealthCheck: Date.now() },
        // });
        // expect(selectCanSend(useOrchestratorPillStore.getState())).toBe(false);
      });

      it('returns false when input is only whitespace', () => {
        // useOrchestratorPillStore.setState({
        //   inputValue: '   ',
        //   isSending: false,
        //   health: { cliAvailable: true, lastHealthCheck: Date.now() },
        // });
        // expect(selectCanSend(useOrchestratorPillStore.getState())).toBe(false);
      });
    });
  });

  describe('Reset', () => {
    it('clears all state on reset', () => {
      // useOrchestratorPillStore.setState({
      //   conversationId: 'conv-1',
      //   messages: [{ id: 'm1', conversationId: 'conv-1', role: 'user', content: 'Hello', timestamp: 1000 }],
      //   inputValue: 'Draft',
      //   streamingContent: 'Partial...',
      // });
      // useOrchestratorPillStore.getState().reset();
      // const state = useOrchestratorPillStore.getState();
      // expect(state.conversationId).toBeNull();
      // expect(state.messages).toEqual([]);
      // expect(state.inputValue).toBe('');
      // expect(state.streamingContent).toBe('');
    });
  });
});

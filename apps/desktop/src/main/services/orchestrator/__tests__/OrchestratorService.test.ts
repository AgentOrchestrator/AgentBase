/**
 * Acceptance Tests: OrchestratorService
 *
 * TDD: These tests define the contract for the orchestrator service.
 * They should fail until the implementation is complete.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ICanvasStateProvider, IOrchestratorService } from '../interfaces';

// Mocks
const mockCanvasProvider: ICanvasStateProvider = {
  listAgents: vi.fn(),
  createAgent: vi.fn(),
  deleteAgent: vi.fn(),
};

let service: IOrchestratorService;

describe('OrchestratorService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // TODO: Initialize service with mock dependencies
    // const mockDb = createMockDatabase();
    // service = new OrchestratorService(mockDb, mockCanvasProvider);
    // await service.initialize();
  });

  afterEach(() => {
    // service?.dispose();
  });

  describe('Health Check', () => {
    it('reports CLI available when claude command exists', async () => {
      // Mock: claude --version succeeds
      const health = await service.getHealth();

      expect(health.cliAvailable).toBe(true);
      expect(health.lastHealthCheck).toBeTypeOf('number');
    });

    it('reports CLI unavailable when claude command not found', async () => {
      // Mock: claude --version fails with "command not found"
      const health = await service.getHealth();

      expect(health.cliAvailable).toBe(false);
    });
  });

  describe('Conversation Management', () => {
    it('creates new conversation with UUID', async () => {
      const conv = await service.createConversation();

      expect(conv.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(conv.createdAt).toBeTypeOf('number');
    });

    it('retrieves existing conversation', async () => {
      const created = await service.createConversation();
      const retrieved = await service.getConversation(created.id);

      expect(retrieved?.id).toBe(created.id);
    });

    it('returns most recent conversation', async () => {
      const _conv1 = await service.createConversation();
      await new Promise((resolve) => setTimeout(resolve, 10));
      const conv2 = await service.createConversation();

      const recent = await service.getMostRecentConversation();

      expect(recent?.id).toBe(conv2.id);
    });
  });

  describe('Message Sending', () => {
    it('saves user message before sending', async () => {
      const conv = await service.createConversation();

      // Mock CLI to return simple response
      await service.sendMessage(conv.id, 'Hello orchestrator');

      const messages = await service.getMessages(conv.id);

      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('Hello orchestrator');
    });

    it('saves assistant response after receiving', async () => {
      const conv = await service.createConversation();

      // Mock CLI response
      await service.sendMessage(conv.id, 'Hello');

      const messages = await service.getMessages(conv.id);

      expect(messages).toHaveLength(2);
      expect(messages[1].role).toBe('assistant');
    });

    it('streams response chunks via callback', async () => {
      const conv = await service.createConversation();
      const chunks: string[] = [];

      // Mock CLI to emit chunks
      await service.sendMessage(conv.id, 'Hello', (chunk) => {
        chunks.push(chunk);
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('includes tool calls in response when MCP tools used', async () => {
      const conv = await service.createConversation();

      // Mock CLI to use canvas/list_agents tool
      (mockCanvasProvider.listAgents as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'agent-1', title: 'Test Agent', workspacePath: '/test' },
      ]);

      const response = await service.sendMessage(conv.id, 'List all agents');

      expect(response.toolCalls).toBeDefined();
      expect(response.toolCalls?.some((tc) => tc.name === 'canvas/list_agents')).toBe(true);
    });
  });

  describe('MCP Tool Execution', () => {
    it('calls canvas provider when list_agents tool used', async () => {
      const conv = await service.createConversation();

      (mockCanvasProvider.listAgents as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await service.sendMessage(conv.id, 'Show me all agents on the canvas');

      expect(mockCanvasProvider.listAgents).toHaveBeenCalled();
    });

    it('calls canvas provider when create_agent tool used', async () => {
      const conv = await service.createConversation();

      (mockCanvasProvider.createAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        agentId: 'new-agent-1',
      });

      await service.sendMessage(conv.id, 'Create a new agent for /path/to/project');

      expect(mockCanvasProvider.createAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspacePath: expect.any(String),
        })
      );
    });

    it('calls canvas provider when delete_agent tool used', async () => {
      const conv = await service.createConversation();

      (mockCanvasProvider.deleteAgent as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await service.sendMessage(conv.id, 'Delete agent agent-123');

      expect(mockCanvasProvider.deleteAgent).toHaveBeenCalledWith('agent-123');
    });
  });

  describe('Context Management', () => {
    it('includes conversation history in CLI context', async () => {
      const conv = await service.createConversation();

      await service.sendMessage(conv.id, 'My name is Alice');
      await service.sendMessage(conv.id, 'What is my name?');

      const messages = await service.getMessages(conv.id);

      // Response should reflect context awareness
      expect(messages).toHaveLength(4); // 2 user + 2 assistant
    });
  });

  describe('Error Handling', () => {
    it('handles CLI timeout gracefully', async () => {
      const conv = await service.createConversation();

      // Mock CLI to timeout
      await expect(service.sendMessage(conv.id, 'Long running task')).rejects.toThrow(/timeout/i);
    });

    it('handles CLI crash gracefully', async () => {
      const conv = await service.createConversation();

      // Mock CLI to crash
      await expect(service.sendMessage(conv.id, 'Crash trigger')).rejects.toThrow();

      // Service should still be usable
      const health = await service.getHealth();
      expect(health).toBeDefined();
    });
  });
});

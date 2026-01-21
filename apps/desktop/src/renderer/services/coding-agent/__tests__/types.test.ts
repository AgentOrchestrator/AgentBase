/**
 * Tests for types.ts
 * Verifies all request/response and session types are exported correctly.
 */

import { describe, expect, it } from 'vitest';
import type {
  CodingAgentMessage,
  CodingAgentSessionContent,
  ContinueOptions,
  ForkOptions,
  GenerateRequest,
  GenerateResponse,
  MessageFilterOptions,
  SessionFilterOptions,
  SessionIdentifier,
  SessionInfo,
  SessionSummary,
  StreamCallback,
  StructuredStreamCallback,
} from '../types';

describe('types module', () => {
  describe('GenerateRequest', () => {
    it('should have required fields', () => {
      const request: GenerateRequest = {
        prompt: 'Hello',
        workingDirectory: '/project',
        sessionId: 'session-123',
      };

      expect(request.prompt).toBe('Hello');
      expect(request.workingDirectory).toBe('/project');
      expect(request.sessionId).toBe('session-123');
    });

    it('should support optional fields', () => {
      const request: GenerateRequest = {
        prompt: 'Hello',
        workingDirectory: '/project',
        sessionId: 'session-123',
        systemPrompt: 'You are a helpful assistant',
        agentId: 'agent-456',
      };

      expect(request.systemPrompt).toBe('You are a helpful assistant');
      expect(request.agentId).toBe('agent-456');
    });
  });

  describe('GenerateResponse', () => {
    it('should have required fields', () => {
      const response: GenerateResponse = {
        content: 'Response text',
        sessionId: 'session-123',
      };

      expect(response.content).toBe('Response text');
      expect(response.sessionId).toBe('session-123');
    });

    it('should support optional tokenUsage', () => {
      const response: GenerateResponse = {
        content: 'Response text',
        sessionId: 'session-123',
        tokenUsage: {
          inputTokens: 100,
          outputTokens: 50,
        },
      };

      expect(response.tokenUsage?.inputTokens).toBe(100);
      expect(response.tokenUsage?.outputTokens).toBe(50);
    });
  });

  describe('SessionIdentifier', () => {
    it('should support id type', () => {
      const identifier: SessionIdentifier = { type: 'id', value: 'session-123' };
      expect(identifier.type).toBe('id');
    });

    it('should support name type', () => {
      const identifier: SessionIdentifier = { type: 'name', value: 'My Session' };
      expect(identifier.type).toBe('name');
    });

    it('should support latest type', () => {
      const identifier: SessionIdentifier = { type: 'latest' };
      expect(identifier.type).toBe('latest');
    });
  });

  describe('SessionInfo', () => {
    it('should have required fields', () => {
      const info: SessionInfo = {
        id: 'session-123',
        agentType: 'claude_code',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(info.id).toBe('session-123');
      expect(info.agentType).toBe('claude_code');
    });

    it('should support optional fields', () => {
      const info: SessionInfo = {
        id: 'session-123',
        agentType: 'claude_code',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        name: 'My Session',
        messageCount: 10,
        parentSessionId: 'parent-123',
      };

      expect(info.name).toBe('My Session');
      expect(info.parentSessionId).toBe('parent-123');
    });
  });

  describe('SessionSummary', () => {
    it('should have all fields', () => {
      const summary: SessionSummary = {
        id: 'session-123',
        agentType: 'claude_code',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T01:00:00Z',
        timestamp: '2024-01-01T01:00:00Z',
        messageCount: 5,
        projectPath: '/project',
        projectName: 'my-project',
        firstUserMessage: 'Hello',
        lastAssistantMessage: 'Hi there!',
        toolCallCount: 3,
        hasThinking: true,
      };

      expect(summary.projectPath).toBe('/project');
      expect(summary.hasThinking).toBe(true);
    });
  });

  describe('CodingAgentSessionContent', () => {
    it('should have messages array', () => {
      const content: CodingAgentSessionContent = {
        id: 'session-123',
        agentType: 'claude_code',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        messageCount: 1,
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00Z',
          },
        ],
      };

      expect(content.messages).toHaveLength(1);
      expect(content.messages[0].role).toBe('user');
    });
  });

  describe('CodingAgentMessage', () => {
    it('should support all roles', () => {
      const userMsg: CodingAgentMessage = {
        id: '1',
        role: 'user',
        content: 'Hello',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const assistantMsg: CodingAgentMessage = {
        id: '2',
        role: 'assistant',
        content: 'Hi',
        timestamp: '2024-01-01T00:00:01Z',
        thinking: 'Analyzing request...',
      };

      const systemMsg: CodingAgentMessage = {
        id: '3',
        role: 'system',
        content: 'System message',
        timestamp: '2024-01-01T00:00:02Z',
      };

      expect(userMsg.role).toBe('user');
      expect(assistantMsg.thinking).toBe('Analyzing request...');
      expect(systemMsg.role).toBe('system');
    });
  });

  describe('FilterOptions', () => {
    it('should support MessageFilterOptions', () => {
      const filter: MessageFilterOptions = {
        limit: 10,
        offset: 0,
      };

      expect(filter.limit).toBe(10);
    });

    it('should support SessionFilterOptions', () => {
      const filter: SessionFilterOptions = {
        projectPath: '/project',
        sinceTimestamp: Date.now(),
        lookbackDays: 7,
        hasThinking: true,
        minToolCallCount: 5,
      };

      expect(filter.projectPath).toBe('/project');
      expect(filter.lookbackDays).toBe(7);
    });
  });

  describe('ContinueOptions', () => {
    it('should be optional', () => {
      const options: ContinueOptions = {};
      expect(options.workingDirectory).toBeUndefined();
    });

    it('should support all fields', () => {
      const options: ContinueOptions = {
        workingDirectory: '/project',
        agentId: 'agent-123',
      };

      expect(options.workingDirectory).toBe('/project');
      expect(options.agentId).toBe('agent-123');
    });
  });

  describe('ForkOptions', () => {
    it('should have required sessionId', () => {
      const options: ForkOptions = {
        sessionId: 'session-123',
      };

      expect(options.sessionId).toBe('session-123');
    });

    it('should support all optional fields', () => {
      const options: ForkOptions = {
        sessionId: 'session-123',
        newSessionName: 'Forked Session',
        workspacePath: '/new/path',
        filterOptions: { targetMessageId: 'msg-5' },
        createWorktree: true,
      };

      expect(options.createWorktree).toBe(true);
      expect(options.filterOptions?.targetMessageId).toBe('msg-5');
    });
  });

  describe('Callback types', () => {
    it('should accept StreamCallback', () => {
      const callback: StreamCallback = (chunk: string) => {
        expect(typeof chunk).toBe('string');
      };

      callback('test chunk');
    });

    it('should accept StructuredStreamCallback', () => {
      // StructuredStreamCallback takes StreamingChunk
      const callback: StructuredStreamCallback = (chunk) => {
        expect(chunk).toBeDefined();
      };

      // Mock a streaming chunk
      callback({ type: 'text', content: 'hello' } as Parameters<StructuredStreamCallback>[0]);
    });
  });
});

/**
 * Tests for ICodingAgentAdapter.ts
 * Verifies the interface can be implemented correctly.
 */

import { describe, expect, it, vi } from 'vitest';
import type { AgentAdapterEventType, AgentEventHandler } from '../events';
import type { ICodingAgentAdapter } from '../ICodingAgentAdapter';
import { ok } from '../result';
import type {
  ContinueOptions,
  ForkOptions,
  GenerateRequest,
  MessageFilterOptions,
  SessionFilterOptions,
  SessionIdentifier,
  StreamCallback,
  StructuredStreamCallback,
} from '../types';

/**
 * Mock implementation of ICodingAgentAdapter for testing
 */
class MockAdapter implements ICodingAgentAdapter {
  readonly agentType = 'claude_code' as const;

  async initialize() {
    return ok(undefined);
  }

  async isAvailable() {
    return true;
  }

  async dispose() {}

  async cancelAll() {}

  async generate(request: GenerateRequest) {
    return ok({
      content: `Response to: ${request.prompt}`,
      sessionId: request.sessionId,
    });
  }

  async generateStreaming(request: GenerateRequest, onChunk: StreamCallback) {
    onChunk('chunk1');
    onChunk('chunk2');
    return ok({
      content: 'chunk1chunk2',
      sessionId: request.sessionId,
    });
  }

  async generateStreamingStructured(request: GenerateRequest, onChunk: StructuredStreamCallback) {
    onChunk({ type: 'text', content: 'hello' } as Parameters<StructuredStreamCallback>[0]);
    return ok({
      content: 'hello',
      sessionId: request.sessionId,
    });
  }

  async continueSession(identifier: SessionIdentifier, prompt: string, _options?: ContinueOptions) {
    const sessionId = identifier.type === 'id' ? identifier.value : 'session-latest';
    return ok({
      content: `Continued: ${prompt}`,
      sessionId,
    });
  }

  async continueSessionStreaming(
    identifier: SessionIdentifier,
    prompt: string,
    onChunk: StreamCallback,
    _options?: ContinueOptions
  ) {
    onChunk('continued');
    const sessionId = identifier.type === 'id' ? identifier.value : 'session-latest';
    return ok({
      content: `Continued: ${prompt}`,
      sessionId,
    });
  }

  async getSession(sessionId: string, _filter?: MessageFilterOptions) {
    return ok({
      id: sessionId,
      agentType: 'claude_code' as const,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      messageCount: 0,
      messages: [],
    });
  }

  async sessionFileExists(_sessionId: string, _workspacePath: string) {
    return true;
  }

  async forkSession(options: ForkOptions) {
    return ok({
      id: 'forked-session',
      agentType: 'claude_code' as const,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      parentSessionId: options.sessionId,
    });
  }

  async listSessionSummaries(_filter?: SessionFilterOptions) {
    return ok([]);
  }

  async getLatestSession(_workspacePath: string) {
    return ok(null);
  }

  buildStartSessionCommand(workspacePath: string, sessionId: string) {
    return `cd "${workspacePath}" && claude --session-id ${sessionId}\n`;
  }

  buildResumeSessionCommand(workspacePath: string, sessionId: string) {
    return `cd "${workspacePath}" && claude --resume ${sessionId}\n`;
  }

  getExitCommand() {
    return '/exit\n';
  }

  onEvent<T extends AgentAdapterEventType>(_type: T, _handler: AgentEventHandler<T>) {
    return () => {}; // Unsubscribe function
  }
}

describe('ICodingAgentAdapter interface', () => {
  it('should allow implementation of all required methods', () => {
    const adapter: ICodingAgentAdapter = new MockAdapter();
    expect(adapter).toBeDefined();
    expect(adapter.agentType).toBe('claude_code');
  });

  describe('Lifecycle methods', () => {
    it('should initialize successfully', async () => {
      const adapter = new MockAdapter();
      const result = await adapter.initialize();

      expect(result.success).toBe(true);
    });

    it('should check availability', async () => {
      const adapter = new MockAdapter();
      const available = await adapter.isAvailable();

      expect(available).toBe(true);
    });

    it('should dispose without error', async () => {
      const adapter = new MockAdapter();
      await expect(adapter.dispose()).resolves.toBeUndefined();
    });

    it('should cancel all without error', async () => {
      const adapter = new MockAdapter();
      await expect(adapter.cancelAll()).resolves.toBeUndefined();
    });
  });

  describe('Generation methods', () => {
    it('should generate response', async () => {
      const adapter = new MockAdapter();
      const result = await adapter.generate({
        prompt: 'Hello',
        workingDirectory: '/project',
        sessionId: 'session-123',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toContain('Hello');
        expect(result.data.sessionId).toBe('session-123');
      }
    });

    it('should generate streaming response', async () => {
      const adapter = new MockAdapter();
      const chunks: string[] = [];
      const result = await adapter.generateStreaming(
        {
          prompt: 'Hello',
          workingDirectory: '/project',
          sessionId: 'session-123',
        },
        (chunk) => chunks.push(chunk)
      );

      expect(result.success).toBe(true);
      expect(chunks).toEqual(['chunk1', 'chunk2']);
    });

    it('should generate structured streaming response', async () => {
      const adapter = new MockAdapter();
      const chunks: unknown[] = [];
      const result = await adapter.generateStreamingStructured?.(
        {
          prompt: 'Hello',
          workingDirectory: '/project',
          sessionId: 'session-123',
        },
        (chunk) => chunks.push(chunk)
      );

      expect(result?.success).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Session continuation methods', () => {
    it('should continue session by id', async () => {
      const adapter = new MockAdapter();
      const result = await adapter.continueSession(
        { type: 'id', value: 'session-123' },
        'Continue prompt'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sessionId).toBe('session-123');
      }
    });

    it('should continue session by latest', async () => {
      const adapter = new MockAdapter();
      const result = await adapter.continueSession({ type: 'latest' }, 'Continue prompt');

      expect(result.success).toBe(true);
    });

    it('should continue session with streaming', async () => {
      const adapter = new MockAdapter();
      const chunks: string[] = [];
      const result = await adapter.continueSessionStreaming(
        { type: 'id', value: 'session-123' },
        'Continue prompt',
        (chunk) => chunks.push(chunk)
      );

      expect(result.success).toBe(true);
      expect(chunks).toContain('continued');
    });
  });

  describe('Session management methods', () => {
    it('should get session content', async () => {
      const adapter = new MockAdapter();
      const result = await adapter.getSession('session-123');

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.id).toBe('session-123');
        expect(result.data.messages).toBeDefined();
      }
    });

    it('should check session file exists', async () => {
      const adapter = new MockAdapter();
      const exists = await adapter.sessionFileExists('session-123', '/project');

      expect(exists).toBe(true);
    });
  });

  describe('Optional capabilities', () => {
    it('should fork session', async () => {
      const adapter = new MockAdapter();
      const result = await adapter.forkSession?.({
        sessionId: 'original-session',
        newSessionName: 'Forked Session',
      });

      expect(result?.success).toBe(true);
      if (result?.success) {
        expect(result.data.parentSessionId).toBe('original-session');
      }
    });

    it('should list session summaries', async () => {
      const adapter = new MockAdapter();
      const result = await adapter.listSessionSummaries?.();

      expect(result?.success).toBe(true);
    });

    it('should get latest session', async () => {
      const adapter = new MockAdapter();
      const result = await adapter.getLatestSession?.('/project');

      expect(result?.success).toBe(true);
    });
  });

  describe('CLI REPL commands', () => {
    it('should build start session command', () => {
      const adapter = new MockAdapter();
      const command = adapter.buildStartSessionCommand?.('/project', 'session-123');

      expect(command).toContain('/project');
      expect(command).toContain('session-123');
    });

    it('should build resume session command', () => {
      const adapter = new MockAdapter();
      const command = adapter.buildResumeSessionCommand?.('/project', 'session-123');

      expect(command).toContain('/project');
      expect(command).toContain('--resume');
      expect(command).toContain('session-123');
    });

    it('should get exit command', () => {
      const adapter = new MockAdapter();
      const command = adapter.getExitCommand();

      expect(command).toBe('/exit\n');
    });
  });

  describe('Event subscription', () => {
    it('should subscribe to events and return unsubscribe function', () => {
      const adapter = new MockAdapter();
      const handler = vi.fn();
      const unsubscribe = adapter.onEvent('permission:request', handler);

      expect(typeof unsubscribe).toBe('function');
    });
  });
});

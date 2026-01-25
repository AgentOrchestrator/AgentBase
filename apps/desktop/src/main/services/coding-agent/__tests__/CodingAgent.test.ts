import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * CodingAgent Interface Specification Tests
 *
 * These tests define the contract for the simplified CodingAgent interface.
 * They serve as:
 * 1. Executable documentation of the API
 * 2. Specification for what the implementation must satisfy
 * 3. Guard against accidental API breakage
 *
 * The tests are organized by capability:
 * - Factory Function: Creating agents
 * - Lifecycle: Initialize, dispose, availability
 * - Capabilities: What the agent can do
 * - Generation: One-off and streaming generation
 * - Session Continuation: Resuming sessions
 * - Session Forking: Creating branches from sessions
 * - Chat History: Listing and retrieving sessions
 * - Session Validation: Checking session existence
 * - Events: Event registry access
 * - Error Handling: Structured errors
 *
 * Note: We use a MockQueryExecutor to test ClaudeCodeAgent without SDK dependency.
 * This ensures tests verify the contract without depending on SDK internals.
 */

import { ClaudeCodeAgent } from '../ClaudeCodeAgent';
// Import from the main index (tests the public API)
import type {
  AgentError,
  CodingAgent,
  CodingAgentType,
  ContinueOptions,
  ForkOptions,
  GenerateRequest,
  MessageFilterOptions,
  Result,
  SessionFilterOptions,
  SessionIdentifier,
  StreamCallback,
  StructuredStreamCallback,
} from '../index';
import { type AgentErrorCode, getCodingAgent } from '../index';
import type {
  QueryExecutor,
  QueryMessageUnion,
  QueryOptions,
  QueryResultMessage,
} from '../query-executor';

/**
 * MockQueryExecutor - Test implementation of QueryExecutor
 *
 * Yields predefined messages for controlled testing of ClaudeCodeAgent.
 * This isolates our tests from the SDK, making them fast and deterministic.
 */
class MockQueryExecutor implements QueryExecutor {
  private responses: QueryMessageUnion[];

  constructor(responses?: QueryMessageUnion[]) {
    this.responses = responses ?? MockQueryExecutor.defaultResponses();
  }

  async *execute(_prompt: string, _options: QueryOptions): AsyncIterable<QueryMessageUnion> {
    for (const msg of this.responses) {
      yield msg;
    }
  }

  /**
   * Default mock responses that simulate a successful query
   */
  static defaultResponses(): QueryMessageUnion[] {
    return [
      {
        type: 'assistant',
        data: { content: 'Mock response' },
      },
      {
        type: 'result',
        data: {
          isError: false,
          subtype: 'success',
          content: 'Mock response',
          sessionId: 'mock-session-id',
          uuid: 'mock-message-id',
          usage: { inputTokens: 10, outputTokens: 20 },
        },
      } as QueryResultMessage,
    ];
  }

  /**
   * Create responses for streaming tests
   */
  static streamingResponses(): QueryMessageUnion[] {
    return [
      {
        type: 'stream_event',
        data: { textChunk: 'Mock ', structuredChunk: undefined },
      },
      {
        type: 'stream_event',
        data: { textChunk: 'streaming ', structuredChunk: undefined },
      },
      {
        type: 'stream_event',
        data: { textChunk: 'response', structuredChunk: undefined },
      },
      {
        type: 'assistant',
        data: { content: 'Mock streaming response' },
      },
      {
        type: 'result',
        data: {
          isError: false,
          subtype: 'success',
          content: 'Mock streaming response',
          sessionId: 'mock-session-id',
          uuid: 'mock-message-id',
          usage: { inputTokens: 10, outputTokens: 20 },
        },
      } as QueryResultMessage,
    ];
  }
}

/**
 * Create a ClaudeCodeAgent with MockQueryExecutor for testing
 */
function createTestAgent(responses?: QueryMessageUnion[]): CodingAgent {
  return new ClaudeCodeAgent({
    type: 'claude_code',
    queryExecutor: new MockQueryExecutor(responses),
  });
}

describe('CodingAgent Interface', () => {
  /**
   * ==========================================
   * 1. Factory Function Tests
   * ==========================================
   * The factory function is the primary way to create agents.
   * It returns a Result type for explicit error handling.
   */
  describe('Factory Function', () => {
    it('getCodingAgent returns a Result with CodingAgent on success', async () => {
      const result = await getCodingAgent('claude_code');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');

      if (result.success) {
        expect(result.data).toBeDefined();
        expect(result.data.agentType).toBe('claude_code');
      }
    });

    it('getCodingAgent returns an error for unsupported agent types', async () => {
      const result = await getCodingAgent('unsupported_agent' as CodingAgentType);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('message');
      }
    });

    it('getCodingAgent accepts optional config', async () => {
      const result = await getCodingAgent('claude_code', {
        config: { timeout: 60000 },
      });

      expect(result).toHaveProperty('success');
    });

    it('getCodingAgent accepts skipCliVerification option', async () => {
      const result = await getCodingAgent('claude_code', {
        skipCliVerification: true,
      });

      expect(result).toHaveProperty('success');
    });
  });

  /**
   * ==========================================
   * 2. Lifecycle Tests
   * ==========================================
   * Agents have a lifecycle: initialize, use, dispose.
   */
  describe('Lifecycle', () => {
    let agent: CodingAgent;

    beforeAll(async () => {
      const result = await getCodingAgent('claude_code', { skipCliVerification: true });
      if (result.success) {
        agent = result.data;
      }
    });

    afterAll(async () => {
      if (agent) {
        await agent.dispose();
      }
    });

    it('initialize() returns Result<void, AgentError>', async () => {
      const result = await agent.initialize();

      expect(result).toHaveProperty('success');
      if (result.success) {
        expect(result.data).toBeUndefined();
      }
    });

    it('isAvailable() returns a boolean promise', async () => {
      const available = await agent.isAvailable();

      expect(typeof available).toBe('boolean');
    });

    it('cancelAll() returns void promise', async () => {
      const result = agent.cancelAll();

      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toBeUndefined();
    });

    it('dispose() returns void promise', async () => {
      // Create a new agent to dispose without affecting other tests
      const tempResult = await getCodingAgent('claude_code', { skipCliVerification: true });
      if (tempResult.success) {
        const result = tempResult.data.dispose();
        expect(result).toBeInstanceOf(Promise);
        await expect(result).resolves.toBeUndefined();
      }
    });
  });

  /**
   * ==========================================
   * 3. Capabilities Tests
   * ==========================================
   * Agents expose their capabilities for runtime checking.
   */
  describe('Capabilities', () => {
    let agent: CodingAgent;

    beforeAll(async () => {
      const result = await getCodingAgent('claude_code', { skipCliVerification: true });
      if (result.success) {
        agent = result.data;
      }
    });

    afterAll(async () => {
      if (agent) {
        await agent.dispose();
      }
    });

    it('agentType is readonly and returns CodingAgentType', () => {
      expect(agent.agentType).toBe('claude_code');
      expect(typeof agent.agentType).toBe('string');
    });

    it('getCapabilities() returns AgentCapabilities', () => {
      const capabilities = agent.getCapabilities();

      expect(capabilities).toHaveProperty('canGenerate');
      expect(capabilities).toHaveProperty('canResumeSession');
      expect(capabilities).toHaveProperty('canForkSession');
      expect(capabilities).toHaveProperty('canListSessions');
      expect(capabilities).toHaveProperty('supportsStreaming');

      // All capability values should be booleans
      expect(typeof capabilities.canGenerate).toBe('boolean');
      expect(typeof capabilities.canResumeSession).toBe('boolean');
      expect(typeof capabilities.canForkSession).toBe('boolean');
      expect(typeof capabilities.canListSessions).toBe('boolean');
      expect(typeof capabilities.supportsStreaming).toBe('boolean');
    });
  });

  /**
   * ==========================================
   * 4. Generation Tests
   * ==========================================
   * Core functionality: generating responses from prompts.
   */
  describe('Generation', () => {
    let agent: CodingAgent;

    beforeAll(async () => {
      const result = await getCodingAgent('claude_code', { skipCliVerification: true });
      if (result.success) {
        agent = result.data;
        await agent.initialize();
      }
    });

    afterAll(async () => {
      if (agent) {
        await agent.dispose();
      }
    });

    it(
      'generate() accepts GenerateRequest and returns Result<GenerateResponse, AgentError>',
      { timeout: 10000 },
      async () => {
        const request: GenerateRequest = {
          prompt: 'Hello, world!',
          workingDirectory: process.cwd(),
          agentId: 'test-agent-id',
          sessionId: 'test-session-id',
        };

        // This will fail if SDK not available, which is expected in tests
        const result = await agent.generate(request);

        expect(result).toHaveProperty('success');
        if (result.success) {
          expect(result.data).toHaveProperty('content');
          expect(result.data).toHaveProperty('sessionId');
          expect(result.data).toHaveProperty('messageId');
          expect(result.data).toHaveProperty('timestamp');
        } else {
          expect(result.error).toHaveProperty('code');
          expect(result.error).toHaveProperty('message');
        }
      }
    );

    it(
      'generateStreaming() accepts GenerateRequest and StreamCallback',
      { timeout: 10000 },
      async () => {
        const request: GenerateRequest = {
          prompt: 'Hello, world!',
          workingDirectory: process.cwd(),
          agentId: 'test-agent-id',
          sessionId: 'test-session-id',
        };
        const chunks: string[] = [];
        const onChunk: StreamCallback = (chunk) => chunks.push(chunk);

        const result = await agent.generateStreaming(request, onChunk);

        expect(result).toHaveProperty('success');
      }
    );

    it(
      'generateStreamingStructured() accepts GenerateRequest and StructuredStreamCallback',
      { timeout: 10000 },
      async () => {
        const request: GenerateRequest = {
          prompt: 'Hello, world!',
          workingDirectory: process.cwd(),
          agentId: 'test-agent-id',
          sessionId: 'test-session-id',
        };
        const chunks: unknown[] = [];
        const onChunk: StructuredStreamCallback = (chunk) => chunks.push(chunk);

        const result = await agent.generateStreamingStructured(request, onChunk);

        expect(result).toHaveProperty('success');
      }
    );
  });

  /**
   * ==========================================
   * 5. Session Continuation Tests
   * ==========================================
   * Resuming/continuing previous sessions.
   */
  describe('Session Continuation', () => {
    let agent: CodingAgent;

    beforeAll(async () => {
      const result = await getCodingAgent('claude_code', { skipCliVerification: true });
      if (result.success) {
        agent = result.data;
        await agent.initialize();
      }
    });

    afterAll(async () => {
      if (agent) {
        await agent.dispose();
      }
    });

    it(
      'continueSession() accepts SessionIdentifier and returns Result<GenerateResponse, AgentError>',
      { timeout: 10000 },
      async () => {
        const identifier: SessionIdentifier = { type: 'id', value: 'test-session-id' };
        const prompt = 'Continue from here';
        const options: ContinueOptions = {
          workingDirectory: process.cwd(),
          agentId: 'test-agent-id',
        };

        const result = await agent.continueSession(identifier, prompt, options);

        expect(result).toHaveProperty('success');
      }
    );

    it(
      'continueSessionStreaming() accepts SessionIdentifier with StreamCallback',
      { timeout: 10000 },
      async () => {
        const identifier: SessionIdentifier = { type: 'id', value: 'test-session-id' };
        const prompt = 'Continue from here';
        const chunks: string[] = [];
        const onChunk: StreamCallback = (chunk) => chunks.push(chunk);
        const options: ContinueOptions = {
          workingDirectory: process.cwd(),
          agentId: 'test-agent-id',
        };

        const result = await agent.continueSessionStreaming(identifier, prompt, onChunk, options);

        expect(result).toHaveProperty('success');
      }
    );

    it('supports multiple SessionIdentifier types', async () => {
      const byId: SessionIdentifier = { type: 'id', value: 'abc123' };
      const byName: SessionIdentifier = { type: 'name', value: 'my-session' };
      const latest: SessionIdentifier = { type: 'latest' };

      // Just verify types are accepted
      expect(byId.type).toBe('id');
      expect(byName.type).toBe('name');
      expect(latest.type).toBe('latest');
    });
  });

  /**
   * ==========================================
   * 6. Session Forking Tests
   * ==========================================
   * Creating new sessions that branch from existing ones.
   */
  describe('Session Forking', () => {
    let agent: CodingAgent;

    beforeAll(async () => {
      const result = await getCodingAgent('claude_code', { skipCliVerification: true });
      if (result.success) {
        agent = result.data;
        await agent.initialize();
      }
    });

    afterAll(async () => {
      if (agent) {
        await agent.dispose();
      }
    });

    it('forkSession() accepts ForkOptions and returns Result<SessionInfo, AgentError>', async () => {
      const options: ForkOptions = {
        sessionId: 'parent-session-id',
        workspacePath: '/tmp/forked-project',
      };

      const result = await agent.forkSession(options);

      expect(result).toHaveProperty('success');
      if (result.success) {
        expect(result.data).toHaveProperty('id');
        expect(result.data).toHaveProperty('agentType');
        expect(result.data).toHaveProperty('createdAt');
        expect(result.data).toHaveProperty('updatedAt');
        expect(result.data).toHaveProperty('messageCount');
      }
    });
  });

  /**
   * ==========================================
   * 7. Chat History Tests
   * ==========================================
   * Listing and retrieving session history.
   */
  describe('Chat History', () => {
    let agent: CodingAgent;

    beforeAll(async () => {
      const result = await getCodingAgent('claude_code', { skipCliVerification: true });
      if (result.success) {
        agent = result.data;
      }
    });

    afterAll(async () => {
      if (agent) {
        await agent.dispose();
      }
    });

    it(
      'listSessionSummaries() returns Result<SessionSummary[], AgentError>',
      { timeout: 15000 },
      async () => {
        const filter: SessionFilterOptions = { lookbackDays: 7 };

        const result = await agent.listSessionSummaries(filter);

        expect(result).toHaveProperty('success');
        if (result.success) {
          expect(Array.isArray(result.data)).toBe(true);
          // Each summary should have required fields
          for (const summary of result.data) {
            expect(summary).toHaveProperty('id');
            expect(summary).toHaveProperty('agentType');
            expect(summary).toHaveProperty('messageCount');
            expect(summary).toHaveProperty('timestamp');
          }
        }
      }
    );

    it('getSession() returns Result<CodingAgentSessionContent | null, AgentError>', async () => {
      const sessionId = 'test-session-id';
      const filter: MessageFilterOptions = { roles: ['user', 'assistant'] };

      const result = await agent.getSession(sessionId, filter);

      expect(result).toHaveProperty('success');
      if (result.success) {
        // Can be null if session doesn't exist
        if (result.data !== null) {
          expect(result.data).toHaveProperty('id');
          expect(result.data).toHaveProperty('messages');
          expect(Array.isArray(result.data.messages)).toBe(true);
        }
      }
    });

    it('getSessionModificationTimes() returns Result<Map<string, number>, AgentError>', async () => {
      const filter: SessionFilterOptions = { sinceTimestamp: Date.now() - 86400000 };

      const result = await agent.getSessionModificationTimes(filter);

      expect(result).toHaveProperty('success');
      if (result.success) {
        expect(result.data).toBeInstanceOf(Map);
      }
    });

    it('getDataPaths() returns string[]', () => {
      const paths = agent.getDataPaths();

      expect(Array.isArray(paths)).toBe(true);
      expect(paths.length).toBeGreaterThan(0);
      for (const p of paths) {
        expect(typeof p).toBe('string');
      }
    });
  });

  /**
   * ==========================================
   * 8. Session Validation Tests
   * ==========================================
   * Checking if sessions exist.
   */
  describe('Session Validation', () => {
    let agent: CodingAgent;

    beforeAll(async () => {
      const result = await getCodingAgent('claude_code', { skipCliVerification: true });
      if (result.success) {
        agent = result.data;
      }
    });

    afterAll(async () => {
      if (agent) {
        await agent.dispose();
      }
    });

    it('sessionFileExists() returns boolean', async () => {
      const sessionId = 'test-session-id';
      const workspacePath = '/tmp/test-project';

      const result = await agent.sessionFileExists(sessionId, workspacePath);

      expect(typeof result).toBe('boolean');
    });
  });

  /**
   * ==========================================
   * 9. Events Tests
   * ==========================================
   * Event registry for hooks and callbacks.
   */
  describe('Events', () => {
    let agent: CodingAgent;

    beforeAll(async () => {
      const result = await getCodingAgent('claude_code', { skipCliVerification: true });
      if (result.success) {
        agent = result.data;
      }
    });

    afterAll(async () => {
      if (agent) {
        await agent.dispose();
      }
    });

    it('getEventRegistry() returns EventRegistry', () => {
      const registry = agent.getEventRegistry();

      expect(registry).toBeDefined();
      // EventRegistry should have emit and on methods
      expect(typeof registry.emit).toBe('function');
      expect(typeof registry.on).toBe('function');
    });

    it('agent extends EventEmitter', () => {
      // Agent should be an EventEmitter for compatibility
      expect(typeof agent.on).toBe('function');
      expect(typeof agent.emit).toBe('function');
      expect(typeof agent.removeAllListeners).toBe('function');
    });
  });

  /**
   * ==========================================
   * 10. Error Handling Tests
   * ==========================================
   * Structured errors with error codes.
   */
  describe('Error Handling', () => {
    it('AgentError has code, message, and optional details', () => {
      // This is a type test - we just verify the structure exists
      const error: AgentError = {
        code: 'AGENT_NOT_AVAILABLE' as AgentErrorCode,
        message: 'Agent not available',
        details: { reason: 'CLI not installed' },
      };

      expect(error.code).toBe('AGENT_NOT_AVAILABLE');
      expect(error.message).toBe('Agent not available');
      expect(error.details).toHaveProperty('reason');
    });

    it('Result type is properly discriminated', () => {
      const successResult: Result<string, AgentError> = {
        success: true,
        data: 'hello',
      };

      const errorResult: Result<string, AgentError> = {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR' as AgentErrorCode,
          message: 'Unknown error',
        },
      };

      expect(successResult.success).toBe(true);
      if (successResult.success) {
        expect(successResult.data).toBe('hello');
      }

      expect(errorResult.success).toBe(false);
      if (!errorResult.success) {
        expect(errorResult.error.code).toBe('UNKNOWN_ERROR');
      }
    });
  });

  /**
   * ==========================================
   * Type Compatibility Tests
   * ==========================================
   * Ensure the interface is properly typed.
   */
  describe('Type Compatibility', () => {
    it('CodingAgent interface has all required methods', async () => {
      const result = await getCodingAgent('claude_code', { skipCliVerification: true });
      if (!result.success) return;

      const agent = result.data;

      // Verify all methods exist
      expect(typeof agent.initialize).toBe('function');
      expect(typeof agent.dispose).toBe('function');
      expect(typeof agent.isAvailable).toBe('function');
      expect(typeof agent.cancelAll).toBe('function');
      expect(typeof agent.getCapabilities).toBe('function');
      expect(typeof agent.generate).toBe('function');
      expect(typeof agent.generateStreaming).toBe('function');
      expect(typeof agent.generateStreamingStructured).toBe('function');
      expect(typeof agent.continueSession).toBe('function');
      expect(typeof agent.continueSessionStreaming).toBe('function');
      expect(typeof agent.forkSession).toBe('function');
      expect(typeof agent.listSessionSummaries).toBe('function');
      expect(typeof agent.getSession).toBe('function');
      expect(typeof agent.getSessionModificationTimes).toBe('function');
      expect(typeof agent.getDataPaths).toBe('function');
      expect(typeof agent.sessionFileExists).toBe('function');
      expect(typeof agent.getEventRegistry).toBe('function');

      await agent.dispose();
    });
  });
});

/**
 * ==========================================
 * ClaudeCodeAgent with MockQueryExecutor Tests
 * ==========================================
 * These tests verify that ClaudeCodeAgent works correctly
 * with an injected QueryExecutor, enabling SDK-agnostic testing.
 */
describe('ClaudeCodeAgent with MockQueryExecutor', () => {
  describe('Generation with mock executor', () => {
    it('generate() returns response from mock executor', async () => {
      const agent = createTestAgent();
      await agent.initialize();

      const result = await agent.generate({
        prompt: 'Hello, world!',
        workingDirectory: process.cwd(),
        agentId: 'test-agent-id',
        sessionId: 'test-session-id',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe('Mock response');
        expect(result.data.sessionId).toBe('mock-session-id');
        expect(result.data.messageId).toBe('mock-message-id');
      }

      await agent.dispose();
    });

    it('generateStreaming() calls onChunk with mock chunks', async () => {
      const agent = createTestAgent(MockQueryExecutor.streamingResponses());
      await agent.initialize();

      const chunks: string[] = [];
      const result = await agent.generateStreaming(
        {
          prompt: 'Hello, world!',
          workingDirectory: process.cwd(),
          agentId: 'test-agent-id',
          sessionId: 'test-session-id',
        },
        (chunk) => chunks.push(chunk)
      );

      expect(result.success).toBe(true);
      expect(chunks).toEqual(['Mock ', 'streaming ', 'response']);

      await agent.dispose();
    });

    it('handles error responses from mock executor', async () => {
      const errorResponses: QueryMessageUnion[] = [
        {
          type: 'result',
          data: {
            isError: true,
            subtype: 'error_during_execution',
            errors: ['Something went wrong'],
            sessionId: 'error-session-id',
            uuid: 'error-uuid',
          },
        } as QueryResultMessage,
      ];

      const agent = createTestAgent(errorResponses);
      await agent.initialize();

      const result = await agent.generate({
        prompt: 'Hello',
        workingDirectory: process.cwd(),
        agentId: 'test-agent-id',
        sessionId: 'test-session-id',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Something went wrong');
      }

      await agent.dispose();
    });
  });

  describe('Session continuation with mock executor', () => {
    it('continueSession() works with mock executor', async () => {
      const agent = createTestAgent();
      await agent.initialize();

      const result = await agent.continueSession(
        { type: 'id', value: 'test-session-id' },
        'Continue from here',
        {
          workingDirectory: process.cwd(),
          agentId: 'test-agent-id',
        }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe('Mock response');
      }

      await agent.dispose();
    });

    it('continueSession with name identifier works', async () => {
      const agent = createTestAgent();
      await agent.initialize();

      const result = await agent.continueSession(
        { type: 'name', value: 'my-session' },
        'Continue from named session',
        {
          workingDirectory: process.cwd(),
          agentId: 'test-agent-id',
        }
      );

      expect(result.success).toBe(true);

      await agent.dispose();
    });
  });

  describe('Lifecycle with mock executor', () => {
    it('initialize() succeeds', async () => {
      const agent = createTestAgent();

      const result = await agent.initialize();

      expect(result.success).toBe(true);

      await agent.dispose();
    });

    it('dispose() cleans up resources', async () => {
      const agent = createTestAgent();
      await agent.initialize();

      await expect(agent.dispose()).resolves.not.toThrow();
    });

    it('cancelAll() does not throw', async () => {
      const agent = createTestAgent();
      await agent.initialize();

      await expect(agent.cancelAll()).resolves.not.toThrow();

      await agent.dispose();
    });
  });

  describe('Capabilities with mock executor', () => {
    it('getCapabilities() returns correct capabilities', () => {
      const agent = createTestAgent();

      const capabilities = agent.getCapabilities();

      expect(capabilities.canGenerate).toBe(true);
      expect(capabilities.canResumeSession).toBe(true);
      expect(capabilities.canForkSession).toBe(true);
      expect(capabilities.supportsStreaming).toBe(true);
    });

    it('agentType is claude_code', () => {
      const agent = createTestAgent();

      expect(agent.agentType).toBe('claude_code');
    });
  });
});

/**
 * Tests for AdapterFactory.ts
 * Verifies factory creates correct adapters.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdapterFactoryError,
  ClaudeCodeAdapter,
  createCodingAgentAdapter,
  getSupportedAdapterTypes,
  isAdapterSupported,
} from '../adapters';

describe('AdapterFactory', () => {
  // Mock window.codingAgentAPI
  const originalWindow = global.window;

  beforeEach(() => {
    // Setup mock window with codingAgentAPI
    global.window = {
      ...originalWindow,
      codingAgentAPI: {
        isAgentAvailable: vi.fn().mockResolvedValue(true),
        generate: vi.fn(),
        generateStreaming: vi.fn(),
        generateStreamingStructured: vi.fn(),
        continueSession: vi.fn(),
        continueSessionStreaming: vi.fn(),
        getSession: vi.fn(),
        sessionFileExists: vi.fn(),
        forkSession: vi.fn(),
        listSessionSummaries: vi.fn(),
        getLatestSession: vi.fn(),
        onAgentEvent: vi.fn().mockReturnValue(() => {}),
      },
    } as unknown as typeof window;
  });

  afterEach(() => {
    global.window = originalWindow;
  });

  describe('createCodingAgentAdapter', () => {
    it('should create ClaudeCodeAdapter for claude_code type', () => {
      const adapter = createCodingAgentAdapter('claude_code');

      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(ClaudeCodeAdapter);
      expect(adapter.agentType).toBe('claude_code');
    });

    it('should throw AdapterFactoryError for unsupported agent type', () => {
      expect(() => {
        createCodingAgentAdapter('unsupported_agent' as 'claude_code');
      }).toThrow(AdapterFactoryError);
    });

    it('should throw AdapterFactoryError when codingAgentAPI is not available', () => {
      // Remove codingAgentAPI
      (global.window as Record<string, unknown>).codingAgentAPI = undefined;

      expect(() => {
        createCodingAgentAdapter('claude_code');
      }).toThrow(AdapterFactoryError);
    });

    it('should include agent type in error', () => {
      (global.window as Record<string, unknown>).codingAgentAPI = undefined;

      try {
        createCodingAgentAdapter('claude_code');
      } catch (e) {
        expect(e).toBeInstanceOf(AdapterFactoryError);
        expect((e as AdapterFactoryError).agentType).toBe('claude_code');
      }
    });
  });

  describe('isAdapterSupported', () => {
    it('should return true for claude_code', () => {
      expect(isAdapterSupported('claude_code')).toBe(true);
    });

    it('should return false for unsupported types', () => {
      expect(isAdapterSupported('unsupported' as 'claude_code')).toBe(false);
    });
  });

  describe('getSupportedAdapterTypes', () => {
    it('should return array containing claude_code', () => {
      const types = getSupportedAdapterTypes();

      expect(types).toContain('claude_code');
    });

    it('should return non-empty array', () => {
      const types = getSupportedAdapterTypes();

      expect(types.length).toBeGreaterThan(0);
    });
  });

  describe('AdapterFactoryError', () => {
    it('should have correct name', () => {
      const error = new AdapterFactoryError('Test error', 'claude_code');

      expect(error.name).toBe('AdapterFactoryError');
    });

    it('should store agent type', () => {
      const error = new AdapterFactoryError('Test error', 'claude_code');

      expect(error.agentType).toBe('claude_code');
    });

    it('should store cause when provided', () => {
      const cause = new Error('Original error');
      const error = new AdapterFactoryError('Test error', 'claude_code', cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('Created adapter implements ICodingAgentAdapter', () => {
    it('should have all required methods', () => {
      const adapter = createCodingAgentAdapter('claude_code');

      // Lifecycle
      expect(typeof adapter.initialize).toBe('function');
      expect(typeof adapter.isAvailable).toBe('function');
      expect(typeof adapter.dispose).toBe('function');
      expect(typeof adapter.cancelAll).toBe('function');

      // Generation
      expect(typeof adapter.generate).toBe('function');
      expect(typeof adapter.generateStreaming).toBe('function');

      // Session continuation
      expect(typeof adapter.continueSession).toBe('function');
      expect(typeof adapter.continueSessionStreaming).toBe('function');

      // Session management
      expect(typeof adapter.getSession).toBe('function');
      expect(typeof adapter.sessionFileExists).toBe('function');

      // CLI
      expect(typeof adapter.getExitCommand).toBe('function');

      // Events
      expect(typeof adapter.onEvent).toBe('function');
    });

    it('should have optional capabilities', () => {
      const adapter = createCodingAgentAdapter('claude_code');

      // These are optional but should be present for ClaudeCodeAdapter
      expect(typeof adapter.forkSession).toBe('function');
      expect(typeof adapter.listSessionSummaries).toBe('function');
      expect(typeof adapter.getLatestSession).toBe('function');
      expect(typeof adapter.buildStartSessionCommand).toBe('function');
      expect(typeof adapter.buildResumeSessionCommand).toBe('function');
      expect(typeof adapter.generateStreamingStructured).toBe('function');
    });
  });
});

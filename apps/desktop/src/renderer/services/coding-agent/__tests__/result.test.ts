/**
 * Tests for result.ts
 * Verifies ok(), err(), agentError() helpers work correctly.
 */

import { describe, expect, it } from 'vitest';
import { type AgentError, AgentErrorCode, agentError, err, ok, type Result } from '../result';

describe('result module', () => {
  describe('ok()', () => {
    it('should create a success result with data', () => {
      const result = ok('test-data');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('test-data');
      }
    });

    it('should work with complex objects', () => {
      const data = { id: '123', items: [1, 2, 3] };
      const result = ok(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(data);
      }
    });

    it('should work with undefined', () => {
      const result = ok(undefined);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeUndefined();
      }
    });
  });

  describe('err()', () => {
    it('should create an error result', () => {
      const error: AgentError = {
        code: AgentErrorCode.UNKNOWN_ERROR,
        message: 'Something went wrong',
      };
      const result = err(error);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual(error);
      }
    });

    it('should work with any error type', () => {
      const result = err({ custom: 'error' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual({ custom: 'error' });
      }
    });
  });

  describe('agentError()', () => {
    it('should create an AgentError with code and message', () => {
      const error = agentError(AgentErrorCode.AGENT_NOT_AVAILABLE, 'Agent not available');

      expect(error.code).toBe(AgentErrorCode.AGENT_NOT_AVAILABLE);
      expect(error.message).toBe('Agent not available');
      expect(error.cause).toBeUndefined();
    });

    it('should include cause when provided', () => {
      const originalError = new Error('Original');
      const error = agentError(AgentErrorCode.NETWORK_ERROR, 'Network failed', originalError);

      expect(error.code).toBe(AgentErrorCode.NETWORK_ERROR);
      expect(error.message).toBe('Network failed');
      expect(error.cause).toBe(originalError);
    });
  });

  describe('AgentErrorCode enum', () => {
    it('should have all expected error codes', () => {
      expect(AgentErrorCode.AGENT_NOT_INITIALIZED).toBeDefined();
      expect(AgentErrorCode.AGENT_NOT_AVAILABLE).toBeDefined();
      expect(AgentErrorCode.SESSION_NOT_FOUND).toBeDefined();
      expect(AgentErrorCode.SESSION_INVALID).toBeDefined();
      expect(AgentErrorCode.GENERATION_FAILED).toBeDefined();
      expect(AgentErrorCode.NETWORK_ERROR).toBeDefined();
      expect(AgentErrorCode.CAPABILITY_NOT_SUPPORTED).toBeDefined();
      expect(AgentErrorCode.UNKNOWN_ERROR).toBeDefined();
    });
  });

  describe('Result type narrowing', () => {
    it('should allow type narrowing based on success', () => {
      const successResult: Result<string, AgentError> = ok('data');
      const errorResult: Result<string, AgentError> = err(
        agentError(AgentErrorCode.UNKNOWN_ERROR, 'error')
      );

      // Success narrowing
      if (successResult.success) {
        const data: string = successResult.data;
        expect(data).toBe('data');
      }

      // Error narrowing
      if (!errorResult.success) {
        const error: AgentError = errorResult.error;
        expect(error.code).toBe(AgentErrorCode.UNKNOWN_ERROR);
      }
    });
  });
});

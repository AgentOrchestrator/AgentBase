/**
 * Tests for index.ts (barrel exports)
 * Verifies all public exports are available from the main entry point.
 */

import { describe, expect, it } from 'vitest';

// Import everything from the main entry point
import * as CodingAgent from '../index';

describe('coding-agent module exports', () => {
  describe('Result exports', () => {
    it('should export ok helper', () => {
      expect(CodingAgent.ok).toBeDefined();
      expect(typeof CodingAgent.ok).toBe('function');
    });

    it('should export err helper', () => {
      expect(CodingAgent.err).toBeDefined();
      expect(typeof CodingAgent.err).toBe('function');
    });

    it('should export agentError helper', () => {
      expect(CodingAgent.agentError).toBeDefined();
      expect(typeof CodingAgent.agentError).toBe('function');
    });

    it('should export AgentErrorCode enum', () => {
      expect(CodingAgent.AgentErrorCode).toBeDefined();
      expect(CodingAgent.AgentErrorCode.UNKNOWN_ERROR).toBeDefined();
    });
  });

  describe('Adapter exports', () => {
    it('should export createCodingAgentAdapter factory', () => {
      expect(CodingAgent.createCodingAgentAdapter).toBeDefined();
      expect(typeof CodingAgent.createCodingAgentAdapter).toBe('function');
    });

    it('should export ClaudeCodeAdapter class', () => {
      expect(CodingAgent.ClaudeCodeAdapter).toBeDefined();
    });

    it('should export isAdapterSupported helper', () => {
      expect(CodingAgent.isAdapterSupported).toBeDefined();
      expect(typeof CodingAgent.isAdapterSupported).toBe('function');
    });

    it('should export getSupportedAdapterTypes helper', () => {
      expect(CodingAgent.getSupportedAdapterTypes).toBeDefined();
      expect(typeof CodingAgent.getSupportedAdapterTypes).toBe('function');
    });

    it('should export AdapterFactoryError class', () => {
      expect(CodingAgent.AdapterFactoryError).toBeDefined();
    });
  });

  describe('Status exports', () => {
    it('should export CodingAgentStatusManager class', () => {
      expect(CodingAgent.CodingAgentStatusManager).toBeDefined();
    });
  });

  describe('Event exports', () => {
    it('should export sharedEventDispatcher singleton', () => {
      expect(CodingAgent.sharedEventDispatcher).toBeDefined();
      expect(typeof CodingAgent.sharedEventDispatcher.initialize).toBe('function');
      expect(typeof CodingAgent.sharedEventDispatcher.subscribe).toBe('function');
      expect(typeof CodingAgent.sharedEventDispatcher.dispose).toBe('function');
    });
  });

  describe('Type exports (compile-time check)', () => {
    it('should allow importing type aliases', () => {
      // These are compile-time checks - if they compile, the types are exported
      type _Result = CodingAgent.Result<string, Error>;
      type _AgentError = CodingAgent.AgentError;
      type _GenerateRequest = CodingAgent.GenerateRequest;
      type _GenerateResponse = CodingAgent.GenerateResponse;
      type _SessionIdentifier = CodingAgent.SessionIdentifier;
      type _SessionInfo = CodingAgent.SessionInfo;
      type _SessionSummary = CodingAgent.SessionSummary;
      type _CodingAgentSessionContent = CodingAgent.CodingAgentSessionContent;
      type _CodingAgentMessage = CodingAgent.CodingAgentMessage;
      type _MessageFilterOptions = CodingAgent.MessageFilterOptions;
      type _SessionFilterOptions = CodingAgent.SessionFilterOptions;
      type _ContinueOptions = CodingAgent.ContinueOptions;
      type _ForkOptions = CodingAgent.ForkOptions;
      type _StreamCallback = CodingAgent.StreamCallback;
      type _StructuredStreamCallback = CodingAgent.StructuredStreamCallback;
      type _AgentAdapterEventType = CodingAgent.AgentAdapterEventType;
      type _AgentAdapterEvent = CodingAgent.AgentAdapterEvent;
      type _AgentEventHandler = CodingAgent.AgentEventHandler<'permission:request'>;
      type _PermissionRequestPayload = CodingAgent.PermissionRequestPayload;
      type _PermissionResponsePayload = CodingAgent.PermissionResponsePayload;
      type _SessionPayload = CodingAgent.SessionPayload;
      type _StatusPayload = CodingAgent.StatusPayload;
      type _ICodingAgentAdapter = CodingAgent.ICodingAgentAdapter;

      // If we get here, all types compile successfully
      expect(true).toBe(true);
    });
  });

  describe('Re-exported streaming types', () => {
    it('should re-export StreamingChunk type', () => {
      // Compile-time check
      type _StreamingChunk = CodingAgent.StreamingChunk;
      expect(true).toBe(true);
    });

    it('should re-export StreamingBlockType type', () => {
      // Compile-time check
      type _StreamingBlockType = CodingAgent.StreamingBlockType;
      expect(true).toBe(true);
    });

    it('should re-export StreamingContentBlock type', () => {
      // Compile-time check
      type _StreamingContentBlock = CodingAgent.StreamingContentBlock;
      expect(true).toBe(true);
    });
  });
});

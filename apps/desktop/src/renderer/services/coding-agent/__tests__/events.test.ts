/**
 * Tests for events.ts
 * Verifies event type discrimination and payload structures.
 */

import { describe, expect, it } from 'vitest';
import type {
  AgentAdapterEvent,
  AgentAdapterEventType,
  AgentEventHandler,
  PermissionRequestPayload,
  PermissionResponsePayload,
  SessionPayload,
  StatusPayload,
} from '../events';

describe('events module', () => {
  describe('AgentAdapterEventType', () => {
    it('should include all expected event types', () => {
      const types: AgentAdapterEventType[] = [
        'permission:request',
        'permission:response',
        'session:start',
        'session:end',
        'status:change',
      ];

      expect(types).toHaveLength(5);
    });
  });

  describe('PermissionRequestPayload', () => {
    it('should have required toolName field', () => {
      const payload: PermissionRequestPayload = {
        toolName: 'Bash',
        command: 'npm test',
        workingDirectory: '/project',
      };

      expect(payload.toolName).toBe('Bash');
      expect(payload.command).toBe('npm test');
    });

    it('should allow optional fields', () => {
      const payload: PermissionRequestPayload = {
        toolName: 'Write',
        filePath: '/path/to/file.ts',
        reason: 'Creating new file',
        toolInput: { content: 'test' },
        toolUseId: 'tool-123',
      };

      expect(payload.filePath).toBe('/path/to/file.ts');
      expect(payload.toolUseId).toBe('tool-123');
    });
  });

  describe('PermissionResponsePayload', () => {
    it('should support allow action', () => {
      const payload: PermissionResponsePayload = {
        action: 'allow',
      };

      expect(payload.action).toBe('allow');
    });

    it('should support deny action with message', () => {
      const payload: PermissionResponsePayload = {
        action: 'deny',
        message: 'User denied permission',
      };

      expect(payload.action).toBe('deny');
      expect(payload.message).toBe('User denied permission');
    });

    it('should support modify action with payload', () => {
      const payload: PermissionResponsePayload = {
        action: 'modify',
        modifiedPayload: { command: 'npm test --safe' },
      };

      expect(payload.action).toBe('modify');
      expect(payload.modifiedPayload?.command).toBe('npm test --safe');
    });
  });

  describe('SessionPayload', () => {
    it('should have required sessionId', () => {
      const payload: SessionPayload = {
        sessionId: 'session-123',
      };

      expect(payload.sessionId).toBe('session-123');
    });

    it('should allow optional workspacePath', () => {
      const payload: SessionPayload = {
        sessionId: 'session-123',
        workspacePath: '/project',
      };

      expect(payload.workspacePath).toBe('/project');
    });
  });

  describe('StatusPayload', () => {
    it('should support idle status', () => {
      const payload: StatusPayload = {
        status: 'idle',
      };

      expect(payload.status).toBe('idle');
    });

    it('should support error status with message', () => {
      const payload: StatusPayload = {
        status: 'error',
        errorMessage: 'Something went wrong',
      };

      expect(payload.status).toBe('error');
      expect(payload.errorMessage).toBe('Something went wrong');
    });
  });

  describe('AgentAdapterEvent discriminated union', () => {
    it('should discriminate permission:request events', () => {
      const event: AgentAdapterEvent = {
        type: 'permission:request',
        payload: { toolName: 'Bash', command: 'npm test' },
        agentId: 'agent-1',
        sessionId: 'session-1',
      };

      if (event.type === 'permission:request') {
        expect(event.payload.toolName).toBe('Bash');
        expect(event.payload.command).toBe('npm test');
      }
    });

    it('should discriminate session:start events', () => {
      const event: AgentAdapterEvent = {
        type: 'session:start',
        payload: { sessionId: 'session-123', workspacePath: '/project' },
        agentId: 'agent-1',
      };

      if (event.type === 'session:start') {
        expect(event.payload.sessionId).toBe('session-123');
      }
    });

    it('should discriminate status:change events', () => {
      const event: AgentAdapterEvent = {
        type: 'status:change',
        payload: { status: 'running' },
        agentId: 'agent-1',
        sessionId: 'session-1',
      };

      if (event.type === 'status:change') {
        expect(event.payload.status).toBe('running');
      }
    });
  });

  describe('AgentEventHandler type', () => {
    it('should correctly type handlers for specific events', () => {
      const handler: AgentEventHandler<'permission:request'> = (event) => {
        // TypeScript should know this is a permission:request event
        expect(event.type).toBe('permission:request');
        expect(event.payload.toolName).toBeDefined();
      };

      const mockEvent: Extract<AgentAdapterEvent, { type: 'permission:request' }> = {
        type: 'permission:request',
        payload: { toolName: 'Bash' },
        agentId: 'agent-1',
      };

      handler(mockEvent);
    });
  });
});

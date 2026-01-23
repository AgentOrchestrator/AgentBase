import { describe, expect, it } from 'vitest';
import { mapEventType, validateHookRequest } from '../validation.js';

describe('validateHookRequest', () => {
  const validRequest = {
    terminalId: 'terminal-123',
    workspacePath: '/Users/test/project',
    gitBranch: 'main',
    sessionId: 'session-456',
    agentId: 'agent-789',
    eventType: 'UserPromptSubmit',
  };

  it('returns valid event when all fields present', () => {
    const result = validateHookRequest(validRequest);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.event.terminalId).toBe('terminal-123');
      expect(result.event.workspacePath).toBe('/Users/test/project');
      expect(result.event.gitBranch).toBe('main');
      expect(result.event.sessionId).toBe('session-456');
      expect(result.event.agentId).toBe('agent-789');
      expect(result.event.type).toBe('Start');
      expect(result.event.timestamp).toBeDefined();
    }
  });

  it('rejects request missing terminalId', () => {
    const { terminalId: _, ...request } = validRequest;
    const result = validateHookRequest(request);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.missingFields).toContain('terminalId');
    }
  });

  it('rejects request missing workspacePath', () => {
    const { workspacePath: _, ...request } = validRequest;
    const result = validateHookRequest(request);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      // Implementation accepts either workspacePath or cwd (Claude alias)
      expect(result.missingFields).toContain('workspacePath (or cwd)');
    }
  });

  it('rejects request missing gitBranch', () => {
    const { gitBranch: _, ...request } = validRequest;
    const result = validateHookRequest(request);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.missingFields).toContain('gitBranch');
    }
  });

  it('rejects request missing sessionId', () => {
    const { sessionId: _, ...request } = validRequest;
    const result = validateHookRequest(request);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      // Implementation accepts either sessionId or session_id (Claude alias)
      expect(result.missingFields).toContain('sessionId (or session_id)');
    }
  });

  it('rejects request missing agentId', () => {
    const { agentId: _, ...request } = validRequest;
    const result = validateHookRequest(request);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.missingFields).toContain('agentId');
    }
  });

  it('rejects request with invalid eventType', () => {
    const request = { ...validRequest, eventType: 'InvalidType' };
    const result = validateHookRequest(request);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain('Invalid eventType');
    }
  });

  it('lists ALL missing fields in error', () => {
    const result = validateHookRequest({});
    expect(result.valid).toBe(false);
    if (!result.valid) {
      // Implementation accepts alternate field names from Claude (snake_case aliases)
      expect(result.missingFields).toEqual(
        expect.arrayContaining([
          'terminalId',
          'workspacePath (or cwd)',
          'gitBranch',
          'sessionId (or session_id)',
          'agentId',
          'eventType',
        ])
      );
    }
  });
});

describe('mapEventType', () => {
  it('maps UserPromptSubmit to Start', () => {
    expect(mapEventType('UserPromptSubmit')).toBe('Start');
  });

  it('maps Stop to Stop', () => {
    expect(mapEventType('Stop')).toBe('Stop');
  });

  it('maps SessionEnd to Stop', () => {
    expect(mapEventType('SessionEnd')).toBe('Stop');
  });

  it('maps PermissionRequest to PermissionRequest', () => {
    expect(mapEventType('PermissionRequest')).toBe('PermissionRequest');
  });

  it('returns null for unknown types', () => {
    expect(mapEventType('UnknownType')).toBeNull();
    expect(mapEventType(undefined)).toBeNull();
    expect(mapEventType('')).toBeNull();
  });
});

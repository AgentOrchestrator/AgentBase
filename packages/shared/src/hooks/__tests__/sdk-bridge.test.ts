/**
 * SDK Hook Bridge Tests
 *
 * Verifies that all vendor-agnostic hooks are correctly triggered
 * when SDK hook events are received.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createEventRegistry, createSDKHookBridge, SDK_HOOK_EVENTS } from '../index.js';
import type { EventRegistry, SDKHookBridge, AgentEvent, EventResult } from '../index.js';

// Mock SDK hook input base
const createMockInput = (hookEventName: string, overrides = {}) => ({
  hook_event_name: hookEventName,
  session_id: 'test-session-123',
  cwd: '/test/workspace',
  ...overrides,
});

describe('SDK Hook Bridge', () => {
  let registry: EventRegistry;
  let bridge: SDKHookBridge;

  beforeEach(() => {
    registry = createEventRegistry();
    bridge = createSDKHookBridge(registry, { debug: false });
  });

  describe('Hook Event Mapping', () => {
    it('should map all 12 SDK hook events', () => {
      expect(SDK_HOOK_EVENTS).toHaveLength(12);
      expect(SDK_HOOK_EVENTS).toContain('PreToolUse');
      expect(SDK_HOOK_EVENTS).toContain('PostToolUse');
      expect(SDK_HOOK_EVENTS).toContain('PostToolUseFailure');
      expect(SDK_HOOK_EVENTS).toContain('UserPromptSubmit');
      expect(SDK_HOOK_EVENTS).toContain('SessionStart');
      expect(SDK_HOOK_EVENTS).toContain('SessionEnd');
      expect(SDK_HOOK_EVENTS).toContain('Stop');
      expect(SDK_HOOK_EVENTS).toContain('SubagentStart');
      expect(SDK_HOOK_EVENTS).toContain('SubagentStop');
      expect(SDK_HOOK_EVENTS).toContain('PreCompact');
      expect(SDK_HOOK_EVENTS).toContain('PermissionRequest');
      expect(SDK_HOOK_EVENTS).toContain('Notification');
    });

    it('should create hooks for all SDK events', () => {
      // All SDK hooks should be present in the bridge
      expect(bridge.hooks.PreToolUse).toBeDefined();
      expect(bridge.hooks.PostToolUse).toBeDefined();
      expect(bridge.hooks.PostToolUseFailure).toBeDefined();
      expect(bridge.hooks.UserPromptSubmit).toBeDefined();
      expect(bridge.hooks.SessionStart).toBeDefined();
      expect(bridge.hooks.SessionEnd).toBeDefined();
      expect(bridge.hooks.Stop).toBeDefined();
      expect(bridge.hooks.SubagentStart).toBeDefined();
      expect(bridge.hooks.SubagentStop).toBeDefined();
      expect(bridge.hooks.PreCompact).toBeDefined();
      expect(bridge.hooks.PermissionRequest).toBeDefined();
      expect(bridge.hooks.Notification).toBeDefined();
    });
  });

  describe('Event Emission', () => {
    it('should emit tool:begin when PreToolUse hook fires', async () => {
      const handler = vi.fn().mockResolvedValue({ action: 'continue' });
      registry.on('tool:begin', handler);

      const hookCallback = bridge.hooks.PreToolUse?.[0]?.hooks?.[0];
      expect(hookCallback).toBeDefined();

      const input = createMockInput('PreToolUse', {
        tool_name: 'Bash',
        tool_input: { command: 'ls -la' },
      });

      await hookCallback!(input, 'tool-use-123', {});

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as AgentEvent;
      expect(event.type).toBe('tool:begin');
      expect(event.agent).toBe('claude_code');
      expect(event.payload).toMatchObject({
        toolName: 'Bash',
        toolCategory: 'shell',
        status: 'pending',
      });
    });

    it('should emit tool:complete when PostToolUse hook fires', async () => {
      const handler = vi.fn().mockResolvedValue({ action: 'continue' });
      registry.on('tool:complete', handler);

      const hookCallback = bridge.hooks.PostToolUse?.[0]?.hooks?.[0];
      const input = createMockInput('PostToolUse', {
        tool_name: 'Read',
        tool_input: { file_path: '/test/file.ts' },
        tool_response: 'file contents...',
      });

      await hookCallback!(input, 'tool-use-456', {});

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as AgentEvent;
      expect(event.type).toBe('tool:complete');
      expect(event.payload).toMatchObject({
        toolName: 'Read',
        toolCategory: 'file_read',
        status: 'success',
      });
    });

    it('should emit tool:error when PostToolUseFailure hook fires', async () => {
      const handler = vi.fn().mockResolvedValue({ action: 'continue' });
      registry.on('tool:error', handler);

      const hookCallback = bridge.hooks.PostToolUseFailure?.[0]?.hooks?.[0];
      const input = createMockInput('PostToolUseFailure', {
        tool_name: 'Bash',
        tool_input: { command: 'invalid-command' },
        error: 'Command not found',
      });

      await hookCallback!(input, 'tool-use-789', {});

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as AgentEvent;
      expect(event.type).toBe('tool:error');
      expect(event.payload).toMatchObject({
        toolName: 'Bash',
        status: 'error',
        error: 'Command not found',
      });
    });

    it('should emit session:start when SessionStart hook fires', async () => {
      const handler = vi.fn().mockResolvedValue({ action: 'continue' });
      registry.on('session:start', handler);

      const hookCallback = bridge.hooks.SessionStart?.[0]?.hooks?.[0];
      const input = createMockInput('SessionStart', {
        source: 'cli',
      });

      await hookCallback!(input, undefined, {});

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as AgentEvent;
      expect(event.type).toBe('session:start');
      expect(event.sessionId).toBe('test-session-123');
    });

    it('should emit session:end when SessionEnd hook fires', async () => {
      const handler = vi.fn().mockResolvedValue({ action: 'continue' });
      registry.on('session:end', handler);

      const hookCallback = bridge.hooks.SessionEnd?.[0]?.hooks?.[0];
      const input = createMockInput('SessionEnd', {
        reason: 'completed',
      });

      await hookCallback!(input, undefined, {});

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as AgentEvent;
      expect(event.type).toBe('session:end');
      expect(event.payload).toMatchObject({
        reason: 'completed',
      });
    });

    it('should emit user_input:complete when UserPromptSubmit hook fires', async () => {
      const handler = vi.fn().mockResolvedValue({ action: 'continue' });
      registry.on('user_input:complete', handler);

      const hookCallback = bridge.hooks.UserPromptSubmit?.[0]?.hooks?.[0];
      const input = createMockInput('UserPromptSubmit', {
        prompt: 'Hello, can you help me?',
      });

      await hookCallback!(input, undefined, {});

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as AgentEvent;
      expect(event.type).toBe('user_input:complete');
      expect(event.payload).toMatchObject({
        content: 'Hello, can you help me?',
      });
    });

    it('should emit permission:request when PermissionRequest hook fires', async () => {
      const handler = vi.fn().mockResolvedValue({ action: 'continue' });
      registry.on('permission:request', handler);

      const hookCallback = bridge.hooks.PermissionRequest?.[0]?.hooks?.[0];
      const input = createMockInput('PermissionRequest', {
        tool_name: 'Bash',
        tool_input: { command: 'rm -rf temp/' },
      });

      await hookCallback!(input, 'tool-use-perm', {});

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as AgentEvent;
      expect(event.type).toBe('permission:request');
      expect(event.payload).toMatchObject({
        toolName: 'Bash',
        command: 'rm -rf temp/',
      });
    });

    it('should emit delegation:start when SubagentStart hook fires', async () => {
      const handler = vi.fn().mockResolvedValue({ action: 'continue' });
      registry.on('delegation:start', handler);

      const hookCallback = bridge.hooks.SubagentStart?.[0]?.hooks?.[0];
      const input = createMockInput('SubagentStart', {
        agent_id: 'subagent-001',
        agent_type: 'Explore',
      });

      await hookCallback!(input, undefined, {});

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as AgentEvent;
      expect(event.type).toBe('delegation:start');
      expect(event.payload).toMatchObject({
        subagentId: 'subagent-001',
        subagentType: 'Explore',
      });
    });

    it('should emit system:info when Notification hook fires', async () => {
      const handler = vi.fn().mockResolvedValue({ action: 'continue' });
      registry.on('system:info', handler);

      const hookCallback = bridge.hooks.Notification?.[0]?.hooks?.[0];
      const input = createMockInput('Notification', {
        title: 'Info',
        message: 'Operation completed successfully',
      });

      await hookCallback!(input, undefined, {});

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as AgentEvent;
      expect(event.type).toBe('system:info');
      expect(event.payload).toMatchObject({
        level: 'info',
        message: 'Operation completed successfully',
      });
    });
  });

  describe('Handler Results', () => {
    it('should return deny hookSpecificOutput when handler denies PreToolUse', async () => {
      const handler = vi.fn().mockResolvedValue({
        action: 'deny',
        message: 'Dangerous command blocked',
      });
      registry.on('tool:begin', handler);

      const hookCallback = bridge.hooks.PreToolUse?.[0]?.hooks?.[0];
      const input = createMockInput('PreToolUse', {
        tool_name: 'Bash',
        tool_input: { command: 'rm -rf /' },
      });

      const result = await hookCallback!(input, 'tool-use-danger', {});

      expect(result).toMatchObject({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'Dangerous command blocked',
        },
      });
    });

    it('should return continue:false when handler denies non-PreToolUse hooks', async () => {
      const handler = vi.fn().mockResolvedValue({
        action: 'deny',
        message: 'Session blocked',
      });
      registry.on('session:start', handler);

      const hookCallback = bridge.hooks.SessionStart?.[0]?.hooks?.[0];
      const input = createMockInput('SessionStart');

      const result = await hookCallback!(input, undefined, {});

      expect(result).toMatchObject({
        continue: false,
        stopReason: 'Session blocked',
      });
    });

    it('should return empty object when handler continues', async () => {
      const handler = vi.fn().mockResolvedValue({ action: 'continue' });
      registry.on('tool:begin', handler);

      const hookCallback = bridge.hooks.PreToolUse?.[0]?.hooks?.[0];
      const input = createMockInput('PreToolUse', {
        tool_name: 'Read',
        tool_input: { file_path: '/safe/file.txt' },
      });

      const result = await hookCallback!(input, 'tool-use-safe', {});

      expect(result).toEqual({});
    });
  });

  describe('Category Handlers', () => {
    it('should trigger category handlers for all tool events', async () => {
      const toolHandler = vi.fn().mockResolvedValue({ action: 'continue' });
      registry.onCategory('tool', toolHandler);

      // Fire tool:begin
      const beginCallback = bridge.hooks.PreToolUse?.[0]?.hooks?.[0];
      await beginCallback!(
        createMockInput('PreToolUse', { tool_name: 'Test' }),
        'id1',
        {}
      );

      // Fire tool:complete
      const completeCallback = bridge.hooks.PostToolUse?.[0]?.hooks?.[0];
      await completeCallback!(
        createMockInput('PostToolUse', { tool_name: 'Test' }),
        'id2',
        {}
      );

      // Fire tool:error
      const errorCallback = bridge.hooks.PostToolUseFailure?.[0]?.hooks?.[0];
      await errorCallback!(
        createMockInput('PostToolUseFailure', { tool_name: 'Test', error: 'fail' }),
        'id3',
        {}
      );

      expect(toolHandler).toHaveBeenCalledTimes(3);
    });
  });

  describe('Global Handlers', () => {
    it('should trigger global handlers for all events', async () => {
      const globalHandler = vi.fn().mockResolvedValue({ action: 'continue' });
      registry.onAll(globalHandler);

      // Fire various events
      await bridge.hooks.PreToolUse?.[0]?.hooks?.[0]!(
        createMockInput('PreToolUse', { tool_name: 'Test' }),
        'id1',
        {}
      );
      await bridge.hooks.SessionStart?.[0]?.hooks?.[0]!(
        createMockInput('SessionStart'),
        undefined,
        {}
      );
      await bridge.hooks.Notification?.[0]?.hooks?.[0]!(
        createMockInput('Notification', { message: 'test' }),
        undefined,
        {}
      );

      expect(globalHandler).toHaveBeenCalledTimes(3);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup without errors', () => {
      expect(() => bridge.cleanup()).not.toThrow();
    });
  });
});

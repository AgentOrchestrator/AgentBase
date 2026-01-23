import { describe, expect, it } from 'vitest';
import { ENV_VARS, TERMINAL_MARKER } from '../constants.js';
import { buildTerminalEnv } from '../terminal-env.js';

describe('buildTerminalEnv', () => {
  it('returns all required environment variables', () => {
    const params = {
      terminalId: 'terminal-123',
      workspacePath: '/Users/test/project',
      gitBranch: 'main',
      agentId: 'agent-456',
      port: 31415,
    };

    const env = buildTerminalEnv(params);

    expect(env[ENV_VARS.TERMINAL_ID]).toBe('terminal-123');
    expect(env[ENV_VARS.WORKSPACE_PATH]).toBe('/Users/test/project');
    expect(env[ENV_VARS.GIT_BRANCH]).toBe('main');
    expect(env[ENV_VARS.AGENT_ID]).toBe('agent-456');
    expect(env[ENV_VARS.PORT]).toBe('31415');
    expect(env[ENV_VARS.MARKER]).toBe(TERMINAL_MARKER);
  });

  it('converts port number to string', () => {
    const params = {
      terminalId: 'terminal-123',
      workspacePath: '/path',
      gitBranch: 'dev',
      agentId: 'agent-1',
      port: 8080,
    };

    const env = buildTerminalEnv(params);

    expect(typeof env[ENV_VARS.PORT]).toBe('string');
    expect(env[ENV_VARS.PORT]).toBe('8080');
  });

  it('preserves workspace path with spaces', () => {
    const params = {
      terminalId: 'terminal-123',
      workspacePath: '/Users/test/My Project',
      gitBranch: 'feature/test',
      agentId: 'agent-1',
      port: 31415,
    };

    const env = buildTerminalEnv(params);

    expect(env[ENV_VARS.WORKSPACE_PATH]).toBe('/Users/test/My Project');
  });

  it('omits gitBranch env var when null (not in a git repo)', () => {
    const params = {
      terminalId: 'terminal-123',
      workspacePath: '/Users/test/project',
      gitBranch: null,
      agentId: 'agent-456',
      port: 31415,
    };

    const env = buildTerminalEnv(params);

    expect(env[ENV_VARS.TERMINAL_ID]).toBe('terminal-123');
    expect(env[ENV_VARS.WORKSPACE_PATH]).toBe('/Users/test/project');
    expect(env[ENV_VARS.GIT_BRANCH]).toBeUndefined();
    expect(env[ENV_VARS.AGENT_ID]).toBe('agent-456');
    expect(env[ENV_VARS.PORT]).toBe('31415');
    expect(env[ENV_VARS.MARKER]).toBe(TERMINAL_MARKER);
  });
});

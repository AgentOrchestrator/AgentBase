import { describe, expect, it } from 'vitest';
import { ENV_VARS, TERMINAL_MARKER } from '../constants.js';
import { generateNotifyScript } from '../notify-script.js';

describe('generateNotifyScript', () => {
  it('generates executable bash script', () => {
    const script = generateNotifyScript({ port: 31415, marker: TERMINAL_MARKER });
    expect(script).toContain('#!/bin/bash');
  });

  it('exits early if not in Agent Orchestrator terminal', () => {
    const script = generateNotifyScript({ port: 31415, marker: TERMINAL_MARKER });
    // Check for the marker environment variable check
    expect(script).toContain(ENV_VARS.MARKER);
    expect(script).toContain('exit 0');
  });

  it('sends ALL required fields in HTTP request', () => {
    const script = generateNotifyScript({ port: 31415, marker: TERMINAL_MARKER });

    // Check all required env vars are used
    expect(script).toContain(ENV_VARS.TERMINAL_ID);
    expect(script).toContain(ENV_VARS.WORKSPACE_PATH);
    expect(script).toContain(ENV_VARS.GIT_BRANCH);
    expect(script).toContain(ENV_VARS.AGENT_ID);
  });

  it('uses correct port in HTTP request', () => {
    const script = generateNotifyScript({ port: 31415, marker: TERMINAL_MARKER });
    expect(script).toContain('localhost:31415');
  });

  it('uses custom port when provided', () => {
    const script = generateNotifyScript({ port: 8080, marker: TERMINAL_MARKER });
    expect(script).toContain('localhost:8080');
  });

  it('uses timeouts to not block agent', () => {
    const script = generateNotifyScript({ port: 31415, marker: TERMINAL_MARKER });
    // curl should have timeout flags
    expect(script).toMatch(/--max-time|--connect-timeout/);
  });

  it('runs curl in background to not block', () => {
    const script = generateNotifyScript({ port: 31415, marker: TERMINAL_MARKER });
    // Should run asynchronously with & or use fire-and-forget pattern
    expect(script).toMatch(/&|--max-time 1/);
  });

  it('accepts hook_event argument', () => {
    const script = generateNotifyScript({ port: 31415, marker: TERMINAL_MARKER });
    // Script should accept $1 as the event type
    expect(script).toContain('$1');
  });
});

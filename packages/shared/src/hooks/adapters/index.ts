/**
 * Adapters Module
 *
 * Exports adapter interfaces and implementations for various coding agents.
 *
 * Two approaches are available for Claude Code:
 * - `ClaudeCodeAdapter` - Terminal output parsing (legacy/fallback)
 * - `createSDKHookBridge` - Native SDK hooks (recommended)
 */

export * from './base.js';
export * from './claude-code.js';
export * from './claude-code-sdk.js';
export * from './codex.js';

import { AdapterRegistry } from './base.js';
import { ClaudeCodeAdapter } from './claude-code.js';
import { CodexAdapter } from './codex.js';

/**
 * Create an adapter registry with all default adapters registered
 */
export function createDefaultAdapterRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry();

  // Register default adapters
  registry.register(new ClaudeCodeAdapter());
  registry.register(new CodexAdapter());

  return registry;
}

/**
 * Default adapter instances
 */
export const defaultAdapters = [new ClaudeCodeAdapter(), new CodexAdapter()];

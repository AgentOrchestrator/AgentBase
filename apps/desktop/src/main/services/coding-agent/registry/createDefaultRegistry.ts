/**
 * Factory for creating a pre-configured ProviderRegistry
 *
 * Creates a registry with all available providers registered.
 *
 * Usage:
 * ```typescript
 * const registry = await createDefaultRegistry();
 * const sessions = await registry.listSessionSummaries({ lookbackDays: 7 });
 * ```
 */

import { ClaudeCodeAgent } from '../ClaudeCodeAgent';
import type { CodingAgentType } from '../types';
import { ProviderRegistry } from './ProviderRegistry';

export interface RegistryOptions {
  /** Only register specific agent types */
  agents?: CodingAgentType[];
  /** Skip initialization errors (register available agents only) */
  skipErrors?: boolean;
}

/**
 * Create a ProviderRegistry with default providers
 *
 * Registers all available coding agent providers.
 * By default, initialization errors are logged but don't prevent
 * other providers from being registered.
 *
 * @param options - Optional configuration
 * @returns Configured ProviderRegistry
 */
export async function createDefaultRegistry(options?: RegistryOptions): Promise<ProviderRegistry> {
  const registry = new ProviderRegistry();
  const skipErrors = options?.skipErrors ?? true;
  const agentFilter = options?.agents;

  // Claude Code
  // Note: We register the provider even if CLI isn't available because
  // IChatHistoryProvider methods only need file system access, not the CLI.
  if (!agentFilter || agentFilter.includes('claude_code')) {
    try {
      const claudeAgent = new ClaudeCodeAgent({ type: 'claude_code' });
      // Initialize to check CLI, but register regardless for history reading
      const initResult = await claudeAgent.initialize();

      if (!initResult.success) {
        console.warn(
          '[createDefaultRegistry] Claude Code CLI not available (history reading still works):',
          initResult.error?.message
        );
      }

      // Always register - chat history reading doesn't require CLI
      registry.register('claude_code', claudeAgent);
    } catch (error) {
      if (!skipErrors) throw error;
      console.warn('[createDefaultRegistry] Claude Code error:', error);
    }
  }

  // Future providers would be added here:
  //
  // if (!agentFilter || agentFilter.includes('cursor')) {
  //   try {
  //     const cursorAgent = new CursorAgent({});
  //     await cursorAgent.initialize();
  //     registry.register('cursor', cursorAgent);
  //   } catch (error) {
  //     if (!skipErrors) throw error;
  //     console.warn('[createDefaultRegistry] Cursor error:', error);
  //   }
  // }
  //
  // if (!agentFilter || agentFilter.includes('codex')) {
  //   try {
  //     const codexAgent = new CodexAgent({});
  //     await codexAgent.initialize();
  //     registry.register('codex', codexAgent);
  //   } catch (error) {
  //     if (!skipErrors) throw error;
  //     console.warn('[createDefaultRegistry] Codex error:', error);
  //   }
  // }

  return registry;
}

/**
 * Create a registry with only Claude Code provider
 * Convenience function for testing or single-provider usage
 */
export async function createClaudeCodeRegistry(): Promise<ProviderRegistry> {
  return createDefaultRegistry({ agents: ['claude_code'] });
}

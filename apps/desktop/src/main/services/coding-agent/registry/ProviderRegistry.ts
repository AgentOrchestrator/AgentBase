/**
 * ProviderRegistry - manages CodingAgent instances
 *
 * Provides centralized access to chat history providers with:
 * - Registration and lookup by agent type
 * - Aggregated queries across all providers
 * - Fan-out pattern for multi-provider operations
 *
 * Usage:
 * ```typescript
 * const registry = new ProviderRegistry();
 * registry.register('claude_code', claudeAgent);
 *
 * // Get all sessions (aggregated)
 * const result = await registry.listSessionSummaries({ lookbackDays: 7 });
 *
 * // Get sessions from specific provider
 * const claudeOnly = await registry.listSessionSummaries({ agent: 'claude_code' });
 * ```
 */

import type { CodingAgent } from '../CodingAgent';
import type {
  AgentError,
  CodingAgentSessionContent,
  CodingAgentType,
  MessageFilterOptions,
  Result,
  SessionFilterOptions,
  SessionSummary,
} from '../types';
import { AgentErrorCode, agentError, err, ok } from '../types';

/**
 * Extended filter options that include agent selection
 */
export interface ProviderFilterOptions extends SessionFilterOptions {
  /** Filter to specific agent type */
  agent?: CodingAgentType;
}

/**
 * Extended message filter options with agent selection
 */
export interface ProviderMessageFilterOptions extends MessageFilterOptions {
  /** Hint for which agent to search (optimization) */
  agent?: CodingAgentType;
}

export class ProviderRegistry {
  private providers = new Map<CodingAgentType, CodingAgent>();

  // ============================================
  // Registration
  // ============================================

  /**
   * Register a provider for an agent type
   * Replaces any existing provider for the same type
   */
  register(agentType: CodingAgentType, provider: CodingAgent): void {
    this.providers.set(agentType, provider);
  }

  /**
   * Unregister a provider by agent type
   * @returns true if a provider was removed
   */
  unregister(agentType: CodingAgentType): boolean {
    return this.providers.delete(agentType);
  }

  // ============================================
  // Direct Access
  // ============================================

  /**
   * Get a specific provider by agent type
   */
  getProvider(agentType: CodingAgentType): CodingAgent | undefined {
    return this.providers.get(agentType);
  }

  /**
   * Get all registered providers
   */
  getAll(): CodingAgent[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get all registered agent types
   */
  getRegisteredTypes(): CodingAgentType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is registered for the given agent type
   */
  has(agentType: CodingAgentType): boolean {
    return this.providers.has(agentType);
  }

  /**
   * Get the count of registered providers
   */
  get size(): number {
    return this.providers.size;
  }

  // ============================================
  // Aggregated Operations
  // ============================================

  /**
   * List session summaries from all providers or a specific one
   *
   * @param filter - Optional filter including agent selection
   * @returns Aggregated and sorted session summaries
   */
  async listSessionSummaries(
    filter?: ProviderFilterOptions
  ): Promise<Result<SessionSummary[], AgentError>> {
    // Single provider query
    if (filter?.agent) {
      const provider = this.providers.get(filter.agent);
      if (!provider) {
        return err(
          agentError(
            AgentErrorCode.AGENT_NOT_AVAILABLE,
            `No provider registered for agent type: ${filter.agent}`
          )
        );
      }
      return provider.listSessionSummaries(filter);
    }

    // Aggregate from all providers
    const allSummaries: SessionSummary[] = [];
    const errors: string[] = [];

    const results = await Promise.allSettled(
      Array.from(this.providers.entries()).map(async ([agentType, provider]) => {
        const result = await provider.listSessionSummaries(filter);
        return { agentType, result };
      })
    );

    for (const settledResult of results) {
      if (settledResult.status === 'fulfilled') {
        const { agentType, result } = settledResult.value;
        if (result.success) {
          allSummaries.push(...result.data);
        } else {
          errors.push(`${agentType}: ${result.error?.message}`);
        }
      } else {
        errors.push(`Provider error: ${settledResult.reason}`);
      }
    }

    // Sort by timestamp descending (most recent first)
    allSummaries.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    });

    // Return success even with partial failures (log errors)
    if (errors.length > 0) {
      console.warn('[ProviderRegistry] Some providers failed:', errors);
    }

    return ok(allSummaries);
  }

  /**
   * Get session content by ID
   *
   * If agent is specified, queries only that provider.
   * Otherwise, searches all providers until found.
   *
   * @param sessionId - Session ID to retrieve
   * @param filter - Optional filter with agent hint
   * @returns Session content or null if not found
   */
  async getSession(
    sessionId: string,
    filter?: ProviderMessageFilterOptions
  ): Promise<Result<CodingAgentSessionContent | null, AgentError>> {
    // Single provider query
    if (filter?.agent) {
      const provider = this.providers.get(filter.agent);
      if (!provider) {
        return err(
          agentError(
            AgentErrorCode.AGENT_NOT_AVAILABLE,
            `No provider registered for agent type: ${filter.agent}`
          )
        );
      }
      return provider.getSession(sessionId, filter);
    }

    // Search all providers
    for (const [agentType, provider] of this.providers) {
      try {
        const result = await provider.getSession(sessionId, filter);
        if (result.success && result.data !== null) {
          return result;
        }
      } catch (error) {
        console.warn(`[ProviderRegistry] Error searching ${agentType}:`, error);
      }
    }

    return ok(null);
  }

  /**
   * Get session modification times from all providers or a specific one
   *
   * @param filter - Optional filter including agent selection
   * @returns Map of session ID to modification timestamp
   */
  async getSessionModificationTimes(
    filter?: ProviderFilterOptions
  ): Promise<Result<Map<string, number>, AgentError>> {
    // Single provider query
    if (filter?.agent) {
      const provider = this.providers.get(filter.agent);
      if (!provider) {
        return err(
          agentError(
            AgentErrorCode.AGENT_NOT_AVAILABLE,
            `No provider registered for agent type: ${filter.agent}`
          )
        );
      }
      return provider.getSessionModificationTimes(filter);
    }

    // Aggregate from all providers
    const allModTimes = new Map<string, number>();

    const results = await Promise.allSettled(
      Array.from(this.providers.values()).map((provider) =>
        provider.getSessionModificationTimes(filter)
      )
    );

    for (const settledResult of results) {
      if (settledResult.status === 'fulfilled' && settledResult.value.success) {
        for (const [sessionId, mtime] of settledResult.value.data) {
          // Keep the most recent modification time if duplicates exist
          const existing = allModTimes.get(sessionId);
          if (!existing || mtime > existing) {
            allModTimes.set(sessionId, mtime);
          }
        }
      }
    }

    return ok(allModTimes);
  }

  // ============================================
  // Utility
  // ============================================

  /**
   * Get data paths for all registered providers
   *
   * @returns Map of agent type to data paths
   */
  getDataPaths(): Map<CodingAgentType, string[]> {
    const paths = new Map<CodingAgentType, string[]>();

    for (const [agentType, provider] of this.providers) {
      paths.set(agentType, provider.getDataPaths());
    }

    return paths;
  }

  /**
   * Get a summary of the registry status
   */
  getStatus(): {
    registered: number;
    providers: Array<{
      agentType: CodingAgentType;
      dataPaths: string[];
    }>;
  } {
    const providers = Array.from(this.providers.entries()).map(([agentType, provider]) => ({
      agentType,
      dataPaths: provider.getDataPaths(),
    }));

    return {
      registered: this.providers.size,
      providers,
    };
  }
}

import { ClaudeCodeForkAdapter } from '../implementations/ClaudeCodeForkAdapter';
import type { IForkAdapter } from '../interfaces/IForkAdapter';

/**
 * Factory for creating fork adapters based on agent type
 *
 * This factory returns the appropriate fork adapter implementation
 * for a given coding agent type (e.g., claude_code, cursor, etc.)
 */
export class ForkAdapterFactory {
  private static adapters: IForkAdapter[] = [
    new ClaudeCodeForkAdapter(),
    // Add more adapters here as needed:
    // new CursorForkAdapter(),
    // new VSCodeForkAdapter(),
  ];

  /**
   * Get a fork adapter for the given agent type
   *
   * @param agentType - The coding agent type (e.g., 'claude_code')
   * @returns Fork adapter instance or null if not supported
   */
  static getAdapter(agentType: string): IForkAdapter | null {
    const adapter = ForkAdapterFactory.adapters.find((a) => a.supportsAgentType(agentType));
    return adapter || null;
  }

  /**
   * Check if forking is supported for the given agent type
   */
  static isSupported(agentType: string): boolean {
    return ForkAdapterFactory.adapters.some((a) => a.supportsAgentType(agentType));
  }

  /**
   * Get all supported agent types
   */
  static getSupportedAgentTypes(): string[] {
    const types = new Set<string>();

    // For each adapter, check common agent type strings
    const commonTypes = ['claude_code', 'cursor', 'vscode', 'factory'];

    for (const type of commonTypes) {
      if (ForkAdapterFactory.isSupported(type)) {
        types.add(type);
      }
    }

    return Array.from(types);
  }
}

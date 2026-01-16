/**
 * Coding Agent Adapters
 *
 * Renderer-side adapters for communicating with coding agents via IPC.
 * These adapters wrap window.codingAgentAPI calls and return Result types
 * for explicit error handling.
 *
 * @example
 * ```typescript
 * import {
 *   createCodingAgentAdapter,
 *   ClaudeCodeAdapter,
 *   type AdapterConfig
 * } from './coding-agent-adapters';
 *
 * // Using the factory (recommended)
 * const adapter = createCodingAgentAdapter('claude_code', {
 *   workingDirectory: '/path/to/project'
 * });
 *
 * // Or direct instantiation
 * const claudeAdapter = new ClaudeCodeAdapter({
 *   agentId: 'my-agent'
 * });
 * ```
 */

// Factory function - main entry point
export {
  createCodingAgentAdapter,
  isAdapterSupported,
  getSupportedAdapterTypes,
  AdapterFactoryError,
} from './AdapterFactory';

// Adapter implementation
export { ClaudeCodeAdapter } from './ClaudeCodeAdapter';

// Types
export type { AdapterConfig } from './types';

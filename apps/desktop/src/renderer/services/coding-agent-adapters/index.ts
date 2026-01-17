/**
 * Coding Agent Adapters
 *
 * Stateless renderer-side adapters for communicating with coding agents via IPC.
 * These adapters wrap window.codingAgentAPI calls and return Result types
 * for explicit error handling.
 *
 * @example
 * ```typescript
 * import { createCodingAgentAdapter, ClaudeCodeAdapter } from './coding-agent-adapters';
 *
 * // Using the factory (recommended)
 * const adapter = createCodingAgentAdapter('claude_code');
 *
 * // Or direct instantiation
 * const claudeAdapter = new ClaudeCodeAdapter();
 *
 * // All parameters are passed per-request
 * const result = await adapter.generate({
 *   prompt: 'Hello',
 *   workingDirectory: '/path/to/project',
 *   sessionId: 'session-123',
 *   agentId: 'agent-123'
 * });
 * ```
 */

// Factory function - main entry point
export {
  AdapterFactoryError,
  createCodingAgentAdapter,
  getSupportedAdapterTypes,
  isAdapterSupported,
} from './AdapterFactory';

// Adapter implementation
export { ClaudeCodeAdapter } from './ClaudeCodeAdapter';

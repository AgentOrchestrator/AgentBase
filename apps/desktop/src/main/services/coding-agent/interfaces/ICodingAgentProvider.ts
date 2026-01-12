import type {
  Result,
  AgentError,
  CodingAgentType,
  AgentCapabilities,
  GenerateRequest,
  GenerateResponse,
  StreamCallback,
} from '../types';

/**
 * Core interface for coding agent providers
 *
 * This is the minimum interface that ALL coding agents must implement.
 * It provides the basic capability to generate responses from prompts.
 *
 * Design rationale:
 * - Kept minimal to ensure all agents can implement it
 * - Streaming is included as a core capability for responsive UX
 * - Returns Result<T,E> for explicit error handling
 * - Includes getCapabilities() for runtime capability checking
 */
export interface ICodingAgentProvider {
  /**
   * The type of coding agent this provider represents
   */
  readonly agentType: CodingAgentType;

  /**
   * Get the agent's capabilities
   * Used for runtime capability checking before using optional interfaces
   */
  getCapabilities(): AgentCapabilities;

  /**
   * Generate a one-off response for a prompt
   *
   * For Claude Code, this uses: `claude -p "prompt"`
   *
   * @param request - The generation request
   * @returns The generated response or an error
   */
  generate(request: GenerateRequest): Promise<Result<GenerateResponse, AgentError>>;

  /**
   * Generate a response with streaming output
   *
   * @param request - The generation request
   * @param onChunk - Callback invoked for each output chunk
   * @returns The final response or an error
   */
  generateStreaming(
    request: GenerateRequest,
    onChunk: StreamCallback
  ): Promise<Result<GenerateResponse, AgentError>>;
}

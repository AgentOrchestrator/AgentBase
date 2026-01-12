import type {
  Result,
  AgentError,
  SessionIdentifier,
  GenerateResponse,
  StreamCallback,
  ContinueOptions,
} from '../types';

/**
 * Interface for resuming/continuing sessions
 *
 * This interface is OPTIONAL - requires both:
 * 1. Session storage support
 * 2. CLI support for resume flags (--resume, --continue)
 *
 * Design rationale:
 * - Separated because resume capability is distinct from session storage
 * - An agent might store sessions but not support continuing them via CLI
 * - Claude Code supports this via --resume <id> and --continue flags
 */
export interface ISessionResumable {
  /**
   * Continue a previous session with a new prompt
   *
   * For Claude Code:
   * - By ID/name: `claude --resume <id> -p "prompt"`
   * - Latest: `claude --continue -p "prompt"`
   *
   * @param identifier - Session to continue (by ID, name, or "latest")
   * @param prompt - The new prompt to send
   * @param options - Additional options
   * @returns The generated response
   */
  continueSession(
    identifier: SessionIdentifier,
    prompt: string,
    options?: ContinueOptions
  ): Promise<Result<GenerateResponse, AgentError>>;

  /**
   * Continue a session with streaming output
   *
   * @param identifier - Session to continue
   * @param prompt - The new prompt
   * @param onChunk - Callback for output chunks
   * @param options - Additional options
   */
  continueSessionStreaming(
    identifier: SessionIdentifier,
    prompt: string,
    onChunk: StreamCallback,
    options?: ContinueOptions
  ): Promise<Result<GenerateResponse, AgentError>>;
}

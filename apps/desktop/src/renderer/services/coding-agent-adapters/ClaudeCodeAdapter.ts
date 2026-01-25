/**
 * Claude Code Adapter
 *
 * Stateless renderer-side adapter for Claude Code that proxies calls to the main process
 * via window.codingAgentAPI. Implements ICodingAgentAdapter interface with
 * Result-based error handling.
 *
 * This adapter:
 * - Wraps IPC calls to maintain consistent Result types
 * - Delegates event subscription to SharedEventDispatcher (no per-adapter IPC listeners)
 * - Does NOT unwrap results - that's the service layer's responsibility
 * - Is stateless - all parameters must be provided per-request
 */

import type { PermissionMode } from '@agent-orchestrator/shared';
import type { AgentType } from '../../../../types/coding-agent-status';
import type {
  AgentAdapterEventType,
  AgentError,
  AgentEventHandler,
  CodingAgentSessionContent,
  ContinueOptions,
  ForkOptions,
  GenerateRequest,
  GenerateResponse,
  ICodingAgentAdapter,
  MessageFilterOptions,
  Result,
  SessionFilterOptions,
  SessionIdentifier,
  SessionInfo,
  SessionSummary,
  StreamCallback,
  StructuredStreamCallback,
} from '../../context/node-services/coding-agent-adapter';
import {
  AgentErrorCode,
  agentError,
  err,
  ok,
} from '../../context/node-services/coding-agent-adapter';
import { sharedEventDispatcher } from '../SharedEventDispatcher';

/**
 * Claude Code Adapter Implementation
 *
 * Proxies all operations to the main process via window.codingAgentAPI.
 * Returns Result types for explicit error handling without unwrapping.
 */
export class ClaudeCodeAdapter implements ICodingAgentAdapter {
  public readonly agentType: AgentType = 'claude_code';

  // ============================================
  // Private Helpers
  // ============================================

  private get api() {
    return window.codingAgentAPI;
  }

  private checkApiAvailable(): AgentError | null {
    if (!this.api) {
      return agentError(
        AgentErrorCode.AGENT_NOT_AVAILABLE,
        'window.codingAgentAPI is not available. Are you running in Electron?'
      );
    }
    return null;
  }

  private wrapError(
    error: unknown,
    defaultCode: AgentErrorCode = AgentErrorCode.UNKNOWN_ERROR
  ): AgentError {
    if (error instanceof Error) {
      return agentError(defaultCode, error.message, error);
    }
    return agentError(defaultCode, String(error), error);
  }

  // ============================================
  // Lifecycle
  // ============================================

  async initialize(): Promise<Result<void, AgentError>> {
    const apiError = this.checkApiAvailable();
    if (apiError) {
      return err(apiError);
    }
    // Event forwarding is now handled by SharedEventDispatcher (initialized at app startup)
    return ok(undefined);
  }

  async isAvailable(): Promise<boolean> {
    if (!this.api) {
      return false;
    }
    try {
      return await this.api.isAgentAvailable(this.agentType);
    } catch {
      return false;
    }
  }

  async dispose(): Promise<void> {
    // No cleanup needed - event handling is managed by SharedEventDispatcher
  }

  async cancelAll(): Promise<void> {
    if (!this.api?.abort) {
      console.warn('[ClaudeCodeAdapter] abort not available in codingAgentAPI');
      return;
    }
    await this.api.abort(this.agentType);
  }

  // ============================================
  // Generation
  // ============================================

  async generate(request: GenerateRequest): Promise<Result<GenerateResponse, AgentError>> {
    const apiError = this.checkApiAvailable();
    if (apiError) {
      return err(apiError);
    }

    try {
      const response = await this.api?.generate(this.agentType, request);
      return ok(response);
    } catch (error) {
      return err(this.wrapError(error, AgentErrorCode.GENERATION_FAILED));
    }
  }

  async generateStreaming(
    request: GenerateRequest,
    onChunk: StreamCallback
  ): Promise<Result<GenerateResponse, AgentError>> {
    const apiError = this.checkApiAvailable();
    if (apiError) {
      return err(apiError);
    }

    try {
      const response = await this.api?.generateStreaming(this.agentType, request, onChunk);
      return ok(response);
    } catch (error) {
      return err(this.wrapError(error, AgentErrorCode.GENERATION_FAILED));
    }
  }

  async generateStreamingStructured(
    request: GenerateRequest,
    onChunk: StructuredStreamCallback
  ): Promise<Result<GenerateResponse, AgentError>> {
    const apiError = this.checkApiAvailable();
    if (apiError) {
      return err(apiError);
    }

    // Check if the API supports structured streaming
    if (!this.api?.generateStreamingStructured) {
      return err(
        agentError(
          AgentErrorCode.CAPABILITY_NOT_SUPPORTED,
          'Structured streaming is not supported by this API version'
        )
      );
    }

    try {
      const response = await this.api?.generateStreamingStructured(
        this.agentType,
        request,
        onChunk
      );
      return ok(response);
    } catch (error) {
      return err(this.wrapError(error, AgentErrorCode.GENERATION_FAILED));
    }
  }

  // ============================================
  // Session Continuation
  // ============================================

  async continueSession(
    identifier: SessionIdentifier,
    prompt: string,
    options?: ContinueOptions
  ): Promise<Result<GenerateResponse, AgentError>> {
    const apiError = this.checkApiAvailable();
    if (apiError) {
      return err(apiError);
    }

    try {
      const response = await this.api?.continueSession(this.agentType, identifier, prompt, options);
      return ok(response);
    } catch (error) {
      return err(this.wrapError(error, AgentErrorCode.SESSION_NOT_FOUND));
    }
  }

  async continueSessionStreaming(
    identifier: SessionIdentifier,
    prompt: string,
    onChunk: StreamCallback,
    options?: ContinueOptions
  ): Promise<Result<GenerateResponse, AgentError>> {
    const apiError = this.checkApiAvailable();
    if (apiError) {
      return err(apiError);
    }

    try {
      const response = await this.api?.continueSessionStreaming(
        this.agentType,
        identifier,
        prompt,
        onChunk,
        options
      );
      return ok(response);
    } catch (error) {
      return err(this.wrapError(error, AgentErrorCode.SESSION_NOT_FOUND));
    }
  }

  // ============================================
  // Session Management
  // ============================================

  async getSession(
    sessionId: string,
    filter?: MessageFilterOptions
  ): Promise<Result<CodingAgentSessionContent | null, AgentError>> {
    const apiError = this.checkApiAvailable();
    if (apiError) {
      return err(apiError);
    }

    try {
      // Note: The IPC API uses slightly different types, cast as needed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = await this.api?.getSession(this.agentType, sessionId, filter as any);
      return ok(session as CodingAgentSessionContent | null);
    } catch (error) {
      return err(this.wrapError(error, AgentErrorCode.SESSION_NOT_FOUND));
    }
  }

  async sessionFileExists(sessionId: string, workspacePath: string): Promise<boolean> {
    if (!this.api) {
      return false;
    }

    try {
      return await this.api.sessionFileExists(this.agentType, sessionId, workspacePath);
    } catch {
      return false;
    }
  }

  // ============================================
  // Optional Capabilities
  // ============================================

  async forkSession(options: ForkOptions): Promise<Result<SessionInfo, AgentError>> {
    const apiError = this.checkApiAvailable();
    if (apiError) {
      return err(apiError);
    }

    // The API now returns Result<SessionInfo, AgentError> directly
    // We need to map the main-side error to renderer-side AgentError
    const result = await this.api?.forkSession(this.agentType, options);

    if (!result.success) {
      // Convert main-side error to renderer-side AgentError
      return err(
        agentError(AgentErrorCode.CAPABILITY_NOT_SUPPORTED, result.error.message, result.error)
      );
    }

    return ok(result.data);
  }

  async listSessionSummaries(
    filter?: SessionFilterOptions
  ): Promise<Result<SessionSummary[], AgentError>> {
    const apiError = this.checkApiAvailable();
    if (apiError) {
      return err(apiError);
    }

    try {
      const summaries = await this.api?.listSessionSummaries(this.agentType, filter);
      return ok(summaries);
    } catch (error) {
      return err(this.wrapError(error, AgentErrorCode.UNKNOWN_ERROR));
    }
  }

  async getLatestSession(workspacePath: string): Promise<Result<SessionInfo | null, AgentError>> {
    const apiError = this.checkApiAvailable();
    if (apiError) {
      return err(apiError);
    }

    try {
      const session = await this.api?.getLatestSession(this.agentType, workspacePath);
      if (!session) {
        return ok(null);
      }
      // Convert the minimal response to SessionInfo
      const sessionInfo: SessionInfo = {
        id: session.id,
        agentType: this.agentType,
        createdAt: session.updatedAt, // Use updatedAt as fallback
        updatedAt: session.updatedAt,
      };
      return ok(sessionInfo);
    } catch (error) {
      return err(this.wrapError(error, AgentErrorCode.SESSION_NOT_FOUND));
    }
  }

  // ============================================
  // CLI REPL Session Commands
  // ============================================

  /**
   * Get CLI flags based on permission mode
   */
  private getPermissionFlag(mode?: PermissionMode): string {
    switch (mode) {
      case 'plan':
        // Read-only tools for plan mode
        return ' --allowedTools "Read,Glob,Grep,LSP,WebFetch,WebSearch"';
      case 'auto-accept':
        // Skip all permission prompts
        return ' --dangerously-skip-permissions';
      case 'ask':
      default:
        // Default interactive mode - no flag needed
        return '';
    }
  }

  /**
   * Build command to start a new CLI REPL session with a specific session ID.
   * Hooks are loaded from workspace-level .claude/settings.local.json (set up by AgentHooksService)
   */
  buildStartSessionCommand(
    workspacePath: string,
    sessionId: string,
    permissionMode?: PermissionMode
  ): string {
    const escapedPath = workspacePath.replace(/"/g, '\\"');
    const permissionFlag = this.getPermissionFlag(permissionMode);
    return `cd "${escapedPath}" && claude --session-id ${sessionId}${permissionFlag}\n`;
  }

  /**
   * Build command to resume an existing CLI REPL session.
   * Hooks are loaded from workspace-level .claude/settings.local.json (set up by AgentHooksService)
   */
  buildResumeSessionCommand(
    workspacePath: string,
    sessionId: string,
    permissionMode?: PermissionMode
  ): string {
    const escapedPath = workspacePath.replace(/"/g, '\\"');
    const permissionFlag = this.getPermissionFlag(permissionMode);
    return `cd "${escapedPath}" && claude --resume ${sessionId}${permissionFlag}\n`;
  }

  /**
   * Get the command to gracefully exit the Claude Code REPL.
   */
  getExitCommand(): string {
    return '/exit\n';
  }

  // ============================================
  // Events
  // ============================================

  onEvent<T extends AgentAdapterEventType>(type: T, handler: AgentEventHandler<T>): () => void {
    // Delegate to SharedEventDispatcher for centralized event handling
    return sharedEventDispatcher.subscribe(type, handler);
  }
}

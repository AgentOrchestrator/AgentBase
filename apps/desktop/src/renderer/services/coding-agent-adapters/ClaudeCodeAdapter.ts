/**
 * Claude Code Adapter
 *
 * Renderer-side adapter for Claude Code that proxies calls to the main process
 * via window.codingAgentAPI. Implements ICodingAgentAdapter interface with
 * Result-based error handling.
 *
 * This adapter:
 * - Wraps IPC calls to maintain consistent Result types
 * - Delegates event subscription to SharedEventDispatcher (no per-adapter IPC listeners)
 * - Provides helper methods for configuration
 * - Does NOT unwrap results - that's the service layer's responsibility
 */

import type {
  ICodingAgentAdapter,
  GenerateRequest,
  GenerateResponse,
  StreamCallback,
  SessionIdentifier,
  SessionInfo,
  SessionSummary,
  CodingAgentSessionContent,
  SessionFilterOptions,
  MessageFilterOptions,
  ContinueOptions,
  ForkOptions,
  AgentAdapterEventType,
  AgentEventHandler,
  Result,
  AgentError,
} from '../../context/node-services/coding-agent-adapter';
import {
  AgentErrorCode,
  ok,
  err,
  agentError,
} from '../../context/node-services/coding-agent-adapter';
import type { AgentType } from '../../../../types/coding-agent-status';
import type { AdapterConfig } from './types';
import { sharedEventDispatcher } from '../SharedEventDispatcher';

/**
 * Claude Code Adapter Implementation
 *
 * Proxies all operations to the main process via window.codingAgentAPI.
 * Returns Result types for explicit error handling without unwrapping.
 */
export class ClaudeCodeAdapter implements ICodingAgentAdapter {
  public readonly agentType: AgentType = 'claude_code';

  private _config: AdapterConfig;

  constructor(config: AdapterConfig = {}) {
    this._config = { ...config };
  }

  // ============================================
  // Configuration Helpers
  // ============================================

  /**
   * Create a new adapter instance with updated config
   */
  withConfig(config: Partial<AdapterConfig>): ClaudeCodeAdapter {
    return new ClaudeCodeAdapter({
      ...this._config,
      ...config,
    });
  }

  /**
   * Create a new adapter instance configured for continuing a session
   */
  withContinueConfig(options: ContinueOptions): ClaudeCodeAdapter {
    return new ClaudeCodeAdapter({
      ...this._config,
      workingDirectory: options.workingDirectory ?? this._config.workingDirectory,
      agentId: options.agentId ?? this._config.agentId,
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<AdapterConfig> {
    return { ...this._config };
  }

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

  private wrapError(error: unknown, defaultCode: AgentErrorCode = AgentErrorCode.UNKNOWN_ERROR): AgentError {
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
      return await this.api.isAgentAvailable('claude_code');
    } catch {
      return false;
    }
  }

  async dispose(): Promise<void> {
    // No cleanup needed - event handling is managed by SharedEventDispatcher
  }

  async cancelAll(): Promise<void> {
    // Currently no cancellation mechanism in the IPC API
    // This would require adding cancel support to the main process
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
      // Merge config into request
      const mergedRequest: GenerateRequest = {
        ...request,
        workingDirectory: request.workingDirectory ?? this._config.workingDirectory,
        agentId: request.agentId ?? this._config.agentId,
      };

      const response = await this.api!.generate('claude_code', mergedRequest);
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
      // Merge config into request
      const mergedRequest: GenerateRequest = {
        ...request,
        workingDirectory: request.workingDirectory ?? this._config.workingDirectory,
        agentId: request.agentId ?? this._config.agentId,
      };

      const response = await this.api!.generateStreaming('claude_code', mergedRequest, onChunk);
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
      // Merge config with options
      const mergedOptions: ContinueOptions = {
        workingDirectory: options?.workingDirectory ?? this._config.workingDirectory,
        agentId: options?.agentId ?? this._config.agentId,
      };

      const response = await this.api!.continueSession(
        'claude_code',
        identifier,
        prompt,
        mergedOptions
      );
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
      // Merge config with options
      const mergedOptions: ContinueOptions = {
        workingDirectory: options?.workingDirectory ?? this._config.workingDirectory,
        agentId: options?.agentId ?? this._config.agentId,
      };

      const response = await this.api!.continueSessionStreaming(
        'claude_code',
        identifier,
        prompt,
        onChunk,
        mergedOptions
      );
      return ok(response);
    } catch (error) {
      return err(this.wrapError(error, AgentErrorCode.SESSION_NOT_FOUND));
    }
  }

  // ============================================
  // Session Management
  // ============================================

  async getFilteredSession(
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
      const session = await this.api!.getSession('claude_code', sessionId, filter as any);
      return ok(session as CodingAgentSessionContent | null);
    } catch (error) {
      return err(this.wrapError(error, AgentErrorCode.SESSION_NOT_FOUND));
    }
  }

  async checkSessionActive(sessionId: string, workspacePath: string): Promise<boolean> {
    if (!this.api) {
      return false;
    }

    try {
      return await this.api.checkSessionActive('claude_code', sessionId, workspacePath);
    } catch {
      return false;
    }
  }

  // ============================================
  // Optional Capabilities
  // ============================================

  async forkSession(
    parentId: SessionIdentifier,
    options?: ForkOptions
  ): Promise<Result<SessionInfo, AgentError>> {
    const apiError = this.checkApiAvailable();
    if (apiError) {
      return err(apiError);
    }

    // Merge config with options
    const mergedOptions: ForkOptions = {
      ...options,
      workingDirectory: options?.workingDirectory ?? this._config.workingDirectory,
    };

    // The API now returns Result<SessionInfo, AgentError> directly
    // We need to map the main-side error to renderer-side AgentError
    const result = await this.api!.forkSession('claude_code', parentId, mergedOptions);

    if (!result.success) {
      // Convert main-side error to renderer-side AgentError
      return err(agentError(
        AgentErrorCode.CAPABILITY_NOT_SUPPORTED,
        result.error.message,
        result.error
      ));
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
      const summaries = await this.api!.listSessionSummaries('claude_code', filter);
      return ok(summaries);
    } catch (error) {
      return err(this.wrapError(error, AgentErrorCode.UNKNOWN_ERROR));
    }
  }

  async getLatestSession(
    workspacePath: string
  ): Promise<Result<SessionInfo | null, AgentError>> {
    const apiError = this.checkApiAvailable();
    if (apiError) {
      return err(apiError);
    }

    try {
      const session = await this.api!.getLatestSession('claude_code', workspacePath);
      if (!session) {
        return ok(null);
      }
      // Convert the minimal response to SessionInfo
      const sessionInfo: SessionInfo = {
        id: session.id,
        agentType: 'claude_code',
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
   * Build command to start a new CLI REPL session with a specific session ID.
   */
  buildStartSessionCommand(workspacePath: string, sessionId: string): string {
    const escapedPath = workspacePath.replace(/"/g, '\\"');
    return `cd "${escapedPath}" && claude --session-id ${sessionId}\n`;
  }

  /**
   * Build command to resume an existing CLI REPL session.
   */
  buildResumeSessionCommand(workspacePath: string, sessionId: string): string {
    const escapedPath = workspacePath.replace(/"/g, '\\"');
    return `cd "${escapedPath}" && claude --resume ${sessionId}\n`;
  }

  // ============================================
  // Events
  // ============================================

  onEvent<T extends AgentAdapterEventType>(
    type: T,
    handler: AgentEventHandler<T>
  ): () => void {
    // Delegate to SharedEventDispatcher for centralized event handling
    return sharedEventDispatcher.subscribe(type, handler);
  }
}

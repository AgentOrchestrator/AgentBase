import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AgentEvent, PermissionPayload, SessionPayload } from '@agent-orchestrator/shared';
import {
  ClaudeCodeJsonlParser,
  createEventRegistry,
  createSDKHookBridge,
  type EventRegistry,
  type SDKHookBridge,
} from '@agent-orchestrator/shared';
import type { CanUseTool, PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import { ForkAdapterFactory } from '../fork-adapters/factory/ForkAdapterFactory';
import type { CodingAgent } from './CodingAgent';
import type {
  QueryExecutor,
  QueryMessageUnion,
  QueryOptions,
  QueryResultMessage,
} from './query-executor';
import { SdkQueryExecutor } from './query-executor';
import type {
  AgentCapabilities,
  AgentConfig,
  AgentError,
  CodingAgentMessage,
  CodingAgentSessionContent,
  CodingAgentType,
  ContinueOptions,
  ForkOptions,
  GenerateRequest,
  GenerateResponse,
  MessageFilterOptions,
  Result,
  SessionFilterOptions,
  SessionIdentifier,
  SessionInfo,
  SessionSummary,
  StreamCallback,
  StructuredStreamCallback,
} from './types';
import { AgentErrorCode, agentError, err, ok } from './types';
import { mapQueryResultError, mapSdkError, noResultError } from './utils/sdk-error-mapper';

/**
 * Active query handle for tracking and cancellation
 */
interface QueryHandle {
  id: string;
  abortController: AbortController;
  startTime: number;
}

/**
 * Claude Code SDK agent implementation
 *
 * Implements the unified CodingAgent interface, providing:
 * - Core generation via SDK query()
 * - Session resumption via SDK options.resume and options.continue
 * - Session forking via SDK options.forkSession
 * - Lifecycle management via AbortController
 * - Session listing via filesystem (SDK doesn't support this)
 *
 * SDK Methods Used:
 * - query({ prompt }) - One-off generation
 * - query({ prompt, options: { resume: id } }) - Resume by ID
 * - query({ prompt, options: { continue: true } }) - Resume latest session
 * - query({ prompt, options: { resume: id, forkSession: true } }) - Fork session
 */

/**
 * Configuration for ClaudeCodeAgent with hook options
 */
export interface ClaudeCodeAgentConfig extends AgentConfig {
  /** Enable debug logging for hooks */
  debugHooks?: boolean;
  /** Custom query executor (for testing) */
  queryExecutor?: QueryExecutor;
}

export class ClaudeCodeAgent extends EventEmitter implements CodingAgent {
  protected readonly config: AgentConfig;
  private readonly eventRegistry: EventRegistry;
  private readonly hookBridge: SDKHookBridge;
  private readonly debugHooks: boolean;
  private readonly queryExecutor: QueryExecutor;
  private readonly activeQueries = new Map<string, QueryHandle>();
  private readonly jsonlParser = new ClaudeCodeJsonlParser();
  private isInitialized = false;
  private currentSessionId: string | null = null;
  private currentWorkspacePath: string | null = null;
  private currentGitBranch: string | null = null;
  private agentId: string | null = null;
  private readonly queryContexts = new WeakMap<
    AbortSignal,
    { agentId?: string; sessionId?: string; workspacePath?: string; gitBranch?: string }
  >();
  private readonly canUseTool: CanUseTool = async (
    toolName: string,
    input: Record<string, unknown>,
    options
  ): Promise<PermissionResult> => {
    const context = options.signal ? this.queryContexts.get(options.signal) : undefined;
    const workspacePath = context?.workspacePath ?? this.currentWorkspacePath;
    const sessionId = context?.sessionId ?? this.currentSessionId;
    const agentId = context?.agentId ?? this.agentId;
    const gitBranch = context?.gitBranch ?? this.currentGitBranch;

    // Validate required context fields - fail explicitly if missing (no defensive defaults)
    if (!agentId) {
      throw new Error('[ClaudeCodeAgent] agentId is required for permission request event');
    }
    if (!sessionId) {
      throw new Error('[ClaudeCodeAgent] sessionId is required for permission request event');
    }
    if (!workspacePath) {
      throw new Error('[ClaudeCodeAgent] workspacePath is required for permission request event');
    }
    if (!gitBranch) {
      throw new Error('[ClaudeCodeAgent] gitBranch is required for permission request event');
    }

    const event: AgentEvent<PermissionPayload> = {
      id: crypto.randomUUID(),
      type: 'permission:request',
      agent: 'claude_code',
      agentId,
      sessionId,
      workspacePath,
      gitBranch,
      timestamp: new Date().toISOString(),
      payload: {
        toolName,
        command: typeof input.command === 'string' ? input.command : undefined,
        args: Array.isArray(input.args) ? (input.args as string[]) : undefined,
        filePath:
          typeof input.file_path === 'string'
            ? input.file_path
            : typeof input.filePath === 'string'
              ? input.filePath
              : undefined,
        workingDirectory: workspacePath,
        reason: options.decisionReason,
      },
      raw: {
        toolInput: input,
        toolUseId: options.toolUseID,
        signal: options.signal,
        suggestions: options.suggestions,
      },
    };

    const results = await this.eventRegistry.emit(event);
    const denyResult = results.find((result) => result.action === 'deny');
    if (denyResult) {
      return {
        behavior: 'deny',
        message: denyResult.message || 'Permission denied',
        toolUseID: options.toolUseID,
      };
    }

    const modifyResult = results.find((result) => result.action === 'modify');
    if (modifyResult) {
      return {
        behavior: 'allow',
        updatedInput: modifyResult.modifiedPayload as Record<string, unknown>,
        toolUseID: options.toolUseID,
      };
    }

    const allowResult = results.find((result) => result.action === 'allow');
    if (allowResult) {
      return {
        behavior: 'allow',
        updatedInput: input,
        toolUseID: options.toolUseID,
      };
    }

    return {
      behavior: 'allow',
      updatedInput: input,
      toolUseID: options.toolUseID,
    };
  };

  constructor(config: ClaudeCodeAgentConfig) {
    super();
    this.config = config;
    this.debugHooks = config.debugHooks ?? false;
    this.eventRegistry = createEventRegistry();
    this.hookBridge = createSDKHookBridge(this.eventRegistry, {
      debug: this.debugHooks,
      getContext: () => {
        if (!this.agentId) {
          throw new Error(
            '[ClaudeCodeAgent] agentId not set. Call setAgentId() before using hooks.'
          );
        }
        if (!this.currentGitBranch) {
          throw new Error(
            '[ClaudeCodeAgent] gitBranch not set. Call setGitBranch() before using hooks.'
          );
        }
        return {
          agentId: this.agentId,
          gitBranch: this.currentGitBranch,
        };
      },
    });
    // Avoid double-emitting permission requests when canUseTool handles them.
    delete this.hookBridge.hooks.PermissionRequest;

    // Initialize query executor (injected or default SdkQueryExecutor)
    this.queryExecutor =
      config.queryExecutor ??
      new SdkQueryExecutor({
        hooks: this.hookBridge.hooks,
        canUseTool: this.canUseTool,
      });

    this.eventRegistry.on<SessionPayload>('session:start', async (event) => {
      this.currentSessionId = event.payload.sessionId;
      return { action: 'continue' };
    });
    this.eventRegistry.on<SessionPayload>('session:end', async () => {
      this.currentSessionId = null;
      return { action: 'continue' };
    });
  }

  /**
   * Get the event registry for registering custom handlers
   */
  getEventRegistry(): EventRegistry {
    return this.eventRegistry;
  }

  get agentType(): CodingAgentType {
    return 'claude_code';
  }

  getCapabilities(): AgentCapabilities {
    return {
      canGenerate: true,
      canResumeSession: true,
      canForkSession: true,
      canListSessions: false, // SDK doesn't expose listing, we use filesystem
      supportsStreaming: true,
    };
  }

  // ============================================
  // Lifecycle Management
  // ============================================

  async initialize(): Promise<Result<void, AgentError>> {
    if (this.isInitialized) {
      return ok(undefined);
    }

    // SDK is always available if installed - no CLI verification needed
    // The SDK will throw on query() if not properly configured
    this.isInitialized = true;
    return ok(undefined);
  }

  async isAvailable(): Promise<boolean> {
    // SDK is available if the package is installed
    // Actual availability is determined when making queries
    return true;
  }

  async cancelAll(): Promise<void> {
    for (const [id, handle] of this.activeQueries) {
      handle.abortController.abort();
      this.activeQueries.delete(id);
    }
  }

  async dispose(): Promise<void> {
    await this.cancelAll();
    this.hookBridge.cleanup();
    this.eventRegistry.clear();
    this.isInitialized = false;
    this.removeAllListeners();
  }

  // ============================================
  // Context Management
  // ============================================

  /**
   * Set the agent ID for this instance.
   * Must be called before using hooks that require context.
   */
  setAgentId(agentId: string): void {
    this.agentId = agentId;
  }

  /**
   * Set the current git branch for context.
   * Must be called before using hooks that require context.
   */
  setGitBranch(gitBranch: string): void {
    this.currentGitBranch = gitBranch;
  }

  /**
   * Get the current agent ID
   */
  getAgentId(): string | null {
    return this.agentId;
  }

  /**
   * Get the current git branch
   */
  getGitBranch(): string | null {
    return this.currentGitBranch;
  }

  /**
   * Check if the agent is initialized
   */
  private ensureInitialized(): Result<void, AgentError> {
    if (!this.isInitialized) {
      return err(
        agentError(
          AgentErrorCode.AGENT_NOT_INITIALIZED,
          'ClaudeCodeAgent not initialized. Call initialize() first.'
        )
      );
    }
    return ok(undefined);
  }

  // ============================================
  // Central Query Execution
  // ============================================

  /**
   * Execute a single query attempt and collect messages.
   *
   * Uses the injected QueryExecutor for SDK-agnostic query execution.
   *
   * @param prompt - The prompt to send
   * @param options - Query execution options
   * @param onChunk - Optional streaming callback for plain text
   * @param onStructuredChunk - Optional structured streaming callback for content blocks
   * @returns Result with GenerateResponse or AgentError
   */
  private async executeQuery(
    prompt: string,
    options: QueryOptions,
    onChunk?: StreamCallback,
    onStructuredChunk?: StructuredStreamCallback
  ): Promise<Result<GenerateResponse, AgentError>> {
    const queryId = crypto.randomUUID();
    const abortController = options.abortController ?? new AbortController();

    try {
      const handle: QueryHandle = {
        id: queryId,
        abortController,
        startTime: Date.now(),
      };
      this.activeQueries.set(queryId, handle);

      console.log(`[ClaudeCodeAgent] Starting query ${queryId}`);

      const messages: QueryMessageUnion[] = [];
      let assistantContent = '';

      for await (const message of this.queryExecutor.execute(prompt, options)) {
        console.log(`[ClaudeCodeAgent] Query ${queryId} received message:`, message.type);
        messages.push(message);

        // Process stream events for callbacks
        if (message.type === 'stream_event') {
          const { textChunk, structuredChunk } = message.data;

          // Plain text streaming callback (backward compatible)
          if (onChunk && textChunk) {
            onChunk(textChunk);
          }

          // Structured streaming callback (content blocks)
          if (onStructuredChunk && structuredChunk) {
            onStructuredChunk(structuredChunk);
          }
        }

        // Accumulate assistant content
        if (message.type === 'assistant') {
          assistantContent += message.data.content;
        }
      }

      console.log(`[ClaudeCodeAgent] Completed query ${queryId} with ${messages.length} messages`);
      this.activeQueries.delete(queryId);

      // Find the result message
      const resultMessage = messages.find((m): m is QueryResultMessage => m.type === 'result');

      if (!resultMessage) {
        console.error(`[ClaudeCodeAgent] No result message found for query ${queryId}`);
        return err(noResultError());
      }

      if (resultMessage.data.isError) {
        return err(mapQueryResultError(resultMessage));
      }

      // Build GenerateResponse from collected messages
      const content = resultMessage.data.content ?? assistantContent;
      const tokensUsed = resultMessage.data.usage
        ? (resultMessage.data.usage.inputTokens ?? 0) + (resultMessage.data.usage.outputTokens ?? 0)
        : undefined;

      return ok({
        content: content.trim(),
        sessionId: resultMessage.data.sessionId ?? '',
        messageId: resultMessage.data.uuid ?? crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        tokensUsed,
      });
    } catch (error) {
      this.activeQueries.delete(queryId);
      throw error; // Re-throw for runQuery to handle fallback
    }
  }

  /**
   * Central method for executing queries with resume fallback logic.
   *
   * When a sessionId is provided, this method:
   * 1. First tries to resume the session using `options.resume`
   * 2. If resume fails (session doesn't exist), falls back to creating a new session
   *    with `extraArgs['session-id']`
   *
   * @param prompt - The prompt to send to Claude
   * @param options - Query execution options
   * @param onChunk - Optional streaming callback for partial messages (plain text)
   * @param onStructuredChunk - Optional structured streaming callback (content blocks)
   * @returns Result with GenerateResponse or AgentError
   */
  private async runQuery(
    prompt: string,
    options: QueryOptions,
    onChunk?: StreamCallback,
    onStructuredChunk?: StructuredStreamCallback
  ): Promise<Result<GenerateResponse, AgentError>> {
    const abortController = options.abortController ?? new AbortController();
    const baseOptions: QueryOptions = {
      ...options,
      abortController,
    };

    // Extract sessionId from extraArgs if present (for fallback scenario)
    const sessionId = baseOptions.extraArgs?.['session-id'];

    // If we have a sessionId, try resume first
    if (sessionId) {
      const resumeOptions: QueryOptions = {
        ...baseOptions,
        resume: sessionId,
        extraArgs: undefined, // Remove extraArgs when using resume
      };

      console.log(`[ClaudeCodeAgent] Attempting to resume session: ${sessionId}`);

      try {
        return await this.executeQuery(prompt, resumeOptions, onChunk, onStructuredChunk);
      } catch (error) {
        console.log(
          `[ClaudeCodeAgent] Resume failed, falling back to new session with session-id: ${sessionId}`,
          error
        );

        // Create a new AbortController for the retry
        const retryAbortController = new AbortController();
        const fallbackOptions: QueryOptions = {
          ...baseOptions,
          abortController: retryAbortController,
          resume: undefined, // Clear resume
          extraArgs: { 'session-id': sessionId },
        };

        try {
          return await this.executeQuery(prompt, fallbackOptions, onChunk, onStructuredChunk);
        } catch (fallbackError) {
          return err(mapSdkError(fallbackError));
        }
      }
    }

    // No sessionId, just execute directly
    try {
      return await this.executeQuery(prompt, baseOptions, onChunk, onStructuredChunk);
    } catch (error) {
      return err(mapSdkError(error));
    }
  }

  // ============================================
  // Generation
  // ============================================

  async generate(request: GenerateRequest): Promise<Result<GenerateResponse, AgentError>> {
    const initCheck = this.ensureInitialized();
    if (initCheck.success === false) {
      return { success: false, error: initCheck.error };
    }

    const options = this.buildQueryOptions(request, new AbortController(), false);
    return this.runQuery(request.prompt, options);
  }

  async generateStreaming(
    request: GenerateRequest,
    onChunk: StreamCallback
  ): Promise<Result<GenerateResponse, AgentError>> {
    const initCheck = this.ensureInitialized();
    if (initCheck.success === false) {
      return { success: false, error: initCheck.error };
    }

    const options = this.buildQueryOptions(request, new AbortController(), true);
    return this.runQuery(request.prompt, options, onChunk);
  }

  /**
   * Generate a streaming response with structured content blocks.
   *
   * Unlike generateStreaming which only streams plain text, this method
   * streams structured content blocks (thinking, tool_use, text) as they arrive.
   *
   * @param request - The generation request
   * @param onChunk - Callback for structured streaming chunks
   * @returns Result with GenerateResponse or AgentError
   */
  async generateStreamingStructured(
    request: GenerateRequest,
    onChunk: StructuredStreamCallback
  ): Promise<Result<GenerateResponse, AgentError>> {
    const initCheck = this.ensureInitialized();
    if (initCheck.success === false) {
      return { success: false, error: initCheck.error };
    }

    const options = this.buildQueryOptions(request, new AbortController(), true);
    // Pass undefined for plain text callback, use structured callback
    return this.runQuery(request.prompt, options, undefined, onChunk);
  }

  /**
   * Build query options from a generate request.
   *
   * Note: Session handling (resume vs new session) is handled by runQuery(),
   * which tries resume first and falls back to extraArgs['session-id'].
   *
   * @param request - The generate request
   * @param abortController - Controller for aborting the query
   * @param streaming - Whether to enable streaming partial messages
   */
  private buildQueryOptions(
    request: GenerateRequest,
    abortController: AbortController,
    streaming = false
  ): QueryOptions {
    const options: QueryOptions = {
      cwd: request.workingDirectory,
      abortController,
      systemPrompt: request.systemPrompt,
      context: {
        agentId: request.agentId,
        sessionId: request.sessionId,
        workspacePath: request.workingDirectory,
      },
    };
    // Validate and set ALL required instance properties so canUseTool can access them
    // (SDK may pass a different signal, so queryContexts lookup may fail)
    if (!request.agentId) {
      throw new Error('[ClaudeCodeAgent] request.agentId is required for generate requests');
    }
    if (!request.sessionId) {
      throw new Error('[ClaudeCodeAgent] request.sessionId is required for generate requests');
    }
    if (!request.workingDirectory) {
      throw new Error(
        '[ClaudeCodeAgent] request.workingDirectory is required for generate requests'
      );
    }

    this.agentId = request.agentId;
    this.currentSessionId = request.sessionId;
    this.currentWorkspacePath = request.workingDirectory;

    // Resolve git branch from workingDirectory
    try {
      const { execFileSync } = require('node:child_process');
      const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: request.workingDirectory,
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();
      if (!branch) {
        throw new Error('git returned empty branch name');
      }
      this.currentGitBranch = branch;
    } catch (error) {
      throw new Error(
        `[ClaudeCodeAgent] Failed to resolve git branch for ${request.workingDirectory}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Pass sessionId via extraArgs - runQuery() handles resume fallback logic
    options.extraArgs = { 'session-id': request.sessionId };

    this.queryContexts.set(abortController.signal, {
      agentId: request.agentId,
      sessionId: request.sessionId,
      workspacePath: options.cwd ?? undefined,
      gitBranch: this.currentGitBranch ?? undefined,
    });

    // Enable streaming partial messages
    if (streaming) {
      options.includePartialMessages = true;
    }

    return options;
  }

  // ============================================
  // Session Continuation
  // ============================================

  async continueSession(
    identifier: SessionIdentifier,
    prompt: string,
    options?: ContinueOptions
  ): Promise<Result<GenerateResponse, AgentError>> {
    const initCheck = this.ensureInitialized();
    if (initCheck.success === false) {
      return { success: false, error: initCheck.error };
    }

    const sdkOptions = this.buildContinueOptions(identifier, new AbortController(), options);
    return this.runQuery(prompt, sdkOptions);
  }

  async continueSessionStreaming(
    identifier: SessionIdentifier,
    prompt: string,
    onChunk: StreamCallback,
    options?: ContinueOptions
  ): Promise<Result<GenerateResponse, AgentError>> {
    const initCheck = this.ensureInitialized();
    if (initCheck.success === false) {
      return { success: false, error: initCheck.error };
    }

    const sdkOptions = this.buildContinueOptions(identifier, new AbortController(), options, true);
    return this.runQuery(prompt, sdkOptions, onChunk);
  }

  /**
   * Build query options for session continuation.
   *
   * Note: For 'id' and 'name' identifiers, we use extraArgs['session-id']
   * and let runQuery() handle the resume fallback logic.
   */
  private buildContinueOptions(
    identifier: SessionIdentifier,
    abortController: AbortController,
    continueOptions?: ContinueOptions,
    streaming = false
  ): QueryOptions {
    // Derive sessionId from identifier
    const sessionId =
      identifier.type === 'id' || identifier.type === 'name' ? identifier.value : undefined;

    const options: QueryOptions = {
      cwd: continueOptions?.workingDirectory,
      abortController,
      context: {
        agentId: continueOptions?.agentId,
        sessionId,
        workspacePath: continueOptions?.workingDirectory,
      },
    };

    // Validate and set ALL required instance properties so canUseTool can access them
    // (SDK may pass a different signal, so queryContexts lookup may fail)
    if (!continueOptions?.agentId) {
      throw new Error(
        '[ClaudeCodeAgent] continueOptions.agentId is required for continue requests'
      );
    }
    if (!sessionId) {
      throw new Error(
        '[ClaudeCodeAgent] sessionId is required for continue requests (use id or name identifier)'
      );
    }
    if (!continueOptions?.workingDirectory) {
      throw new Error(
        '[ClaudeCodeAgent] continueOptions.workingDirectory is required for continue requests'
      );
    }

    this.agentId = continueOptions.agentId;
    this.currentSessionId = sessionId;
    this.currentWorkspacePath = continueOptions.workingDirectory;

    // Resolve git branch from workingDirectory
    try {
      const { execFileSync } = require('node:child_process');
      const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: continueOptions.workingDirectory,
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();
      if (!branch) {
        throw new Error('git returned empty branch name');
      }
      this.currentGitBranch = branch;
    } catch (error) {
      throw new Error(
        `[ClaudeCodeAgent] Failed to resolve git branch for ${continueOptions.workingDirectory}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Map SessionIdentifier to query options
    switch (identifier.type) {
      case 'latest':
        // 'latest' uses continue: true (no session ID)
        options.continue = true;
        break;
      case 'id':
      case 'name':
        // Use extraArgs - runQuery() handles resume fallback
        options.extraArgs = { 'session-id': identifier.value };
        break;
    }

    this.queryContexts.set(abortController.signal, {
      agentId: continueOptions.agentId,
      sessionId,
      workspacePath: continueOptions.workingDirectory,
      gitBranch: this.currentGitBranch ?? undefined,
    });

    if (streaming) {
      options.includePartialMessages = true;
    }

    return options;
  }

  // ============================================
  // Session Forking
  // ============================================

  async forkSession(options: ForkOptions): Promise<Result<SessionInfo, AgentError>> {
    const initCheck = this.ensureInitialized();
    if (initCheck.success === false) {
      return { success: false, error: initCheck.error };
    }

    // Get session ID from options (required field)
    const sourceSessionId = options.sessionId;

    const targetCwd = options.workspacePath ?? process.cwd();
    // Use sourceWorkspacePath if provided, otherwise fall back to process.cwd()
    // sourceWorkspacePath is required for correct session lookup when the same session ID
    // exists in multiple project folders (from previous forks)
    const sourceCwd = options.sourceWorkspacePath ?? process.cwd();
    const isCrossDirectory = targetCwd !== sourceCwd;
    const createWorktree = options.createWorktree !== false; // Default to true for backward compatibility

    // Determine target session ID:
    // - Cross-directory (worktree) forks: use same session ID (file is in different project directory)
    // - Same-directory forks without worktree: generate new session ID
    const targetSessionId = createWorktree ? sourceSessionId : crypto.randomUUID();

    console.log('[ClaudeCodeAgent] Fork operation:', {
      sourceSessionId,
      targetSessionId,
      isCrossDirectory,
      createWorktree,
      sourceCwd,
      targetCwd,
    });

    // Handle forks that need JSONL file copying
    // - Cross-directory forks: copy to new project directory
    // - Same-directory forks without worktree: copy with new session ID
    // IMPORTANT: Copy JSONL first, before any executeQuery, so the context is available
    if (isCrossDirectory || !createWorktree) {
      console.log('[ClaudeCodeAgent] Fork requires JSONL file copy', {
        isCrossDirectory,
        createWorktree,
        sourceCwd,
        targetCwd,
      });

      // Get fork adapter for Claude Code
      const adapter = ForkAdapterFactory.getAdapter('claude_code');
      if (!adapter) {
        return err(
          agentError(AgentErrorCode.CAPABILITY_NOT_SUPPORTED, 'Fork adapter not available')
        );
      }

      try {
        // Resolve real path of target (handles symlinks like /tmp -> /private/tmp on macOS)
        let resolvedTargetCwd = targetCwd;
        try {
          if (!fs.existsSync(targetCwd)) {
            fs.mkdirSync(targetCwd, { recursive: true });
          }
          resolvedTargetCwd = fs.realpathSync(targetCwd);
        } catch {
          // If resolution fails, use original path
        }

        // Copy the JSONL file and update sessions-index.json
        // This registers the session so Claude Code can discover and resume it
        const forkResult = await adapter.forkSessionFile(
          sourceSessionId,
          targetSessionId,
          sourceCwd,
          isCrossDirectory ? resolvedTargetCwd : sourceCwd, // Same cwd for non-worktree forks
          options.filterOptions // Pass filter options for partial context fork
        );

        if (forkResult.success === false) {
          console.error('[ClaudeCodeAgent] Fork adapter failed to fork session', {
            error: forkResult.error,
          });
          throw forkResult.error;
        }

        // For cross-directory forks, we're done - the JSONL is copied and indexed
        // The user can now resume the session with `claude --resume <sessionId>`
        // No need to call executeQuery which would overwrite the copied context
        console.log('[ClaudeCodeAgent] Fork complete - session file copied and indexed');
      } catch (error) {
        return err(
          agentError(AgentErrorCode.UNKNOWN_ERROR, `Failed to fork session file: ${error}`)
        );
      }
    } else {
      // For same-directory forks with worktree, use SDK's built-in fork mechanism
      const abortController = new AbortController();
      const queryOptions: QueryOptions = {
        abortController,
        resume: sourceSessionId,
        forkSession: true,
      };

      try {
        await this.executeQuery('', queryOptions);
      } catch (error) {
        console.error('[ClaudeCodeAgent] Failed to create forked session via SDK', { error });
      }
    }

    return ok({
      id: targetSessionId,
      name: options.newSessionName,
      agentType: 'claude_code',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0,
      parentSessionId: sourceSessionId,
    });
  }

  // ============================================
  // Chat History (Filesystem-based)
  // ============================================

  /**
   * Get the Claude Code projects directory path
   */
  private getProjectsDir(): string {
    const claudeHome = process.env.CLAUDE_CODE_HOME;
    if (claudeHome) {
      return path.join(claudeHome, 'projects');
    }
    return path.join(os.homedir(), '.claude', 'projects');
  }

  getDataPaths(): string[] {
    return [this.getProjectsDir()];
  }

  /**
   * Encode a workspace path the same way Claude Code does.
   * Both forward slashes and spaces are replaced with hyphens.
   * Example: /Users/foo/My Project -> -Users-foo-My-Project
   */
  private encodeWorkspacePath(workspacePath: string): string {
    return workspacePath.replace(/[/ ]/g, '-');
  }

  /**
   * Check if a session file exists for the given session ID and workspace path.
   * This verifies file existence on disk, not runtime session state.
   */
  async sessionFileExists(sessionId: string, workspacePath: string): Promise<boolean> {
    const encodedPath = this.encodeWorkspacePath(workspacePath);
    const sessionFilePath = path.join(this.getProjectsDir(), encodedPath, `${sessionId}.jsonl`);
    const exists = fs.existsSync(sessionFilePath);

    console.log('[ClaudeCodeAgent] Checking session file exists', {
      sessionId,
      workspacePath,
      sessionFilePath,
      exists,
    });
    return exists;
  }

  async getSessionModificationTimes(
    filter?: SessionFilterOptions
  ): Promise<Result<Map<string, number>, AgentError>> {
    const projectsDir = this.getProjectsDir();
    const modTimes = new Map<string, number>();

    try {
      if (!fs.existsSync(projectsDir)) {
        return ok(modTimes);
      }

      const projectDirs = fs.readdirSync(projectsDir);
      const cutoffTime = filter?.sinceTimestamp ?? 0;

      for (const projectDir of projectDirs) {
        const projectDirPath = path.join(projectsDir, projectDir);
        if (!fs.statSync(projectDirPath).isDirectory()) continue;

        // Apply project filter if specified
        if (filter?.projectName) {
          const projectPath = projectDir.replace(/^-/, '/').replace(/-/g, '/');
          const projectName = path.basename(projectPath);
          if (projectName !== filter.projectName) continue;
        }

        const sessionFiles = fs.readdirSync(projectDirPath).filter((f) => f.endsWith('.jsonl'));

        for (const sessionFile of sessionFiles) {
          const sessionFilePath = path.join(projectDirPath, sessionFile);
          const stats = fs.statSync(sessionFilePath);
          const mtime = stats.mtime.getTime();

          if (mtime >= cutoffTime) {
            const sessionId = path.basename(sessionFile, '.jsonl');
            modTimes.set(sessionId, mtime);
          }
        }
      }

      return ok(modTimes);
    } catch (error) {
      return err(
        agentError(
          AgentErrorCode.UNKNOWN_ERROR,
          `Failed to get session modification times: ${error}`
        )
      );
    }
  }

  async listSessionSummaries(
    filter?: SessionFilterOptions
  ): Promise<Result<SessionSummary[], AgentError>> {
    const projectsDir = this.getProjectsDir();
    const summaries: SessionSummary[] = [];

    try {
      if (!fs.existsSync(projectsDir)) {
        return ok(summaries);
      }

      const projectDirs = fs.readdirSync(projectsDir);
      const cutoffTime = filter?.sinceTimestamp ?? 0;
      const lookbackMs = filter?.lookbackDays
        ? filter.lookbackDays * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000; // Default 30 days
      const minTime = Date.now() - lookbackMs;

      for (const projectDir of projectDirs) {
        const projectDirPath = path.join(projectsDir, projectDir);
        if (!fs.statSync(projectDirPath).isDirectory()) continue;

        // Decode the project path (note: paths with hyphens can't be perfectly decoded)
        const decodedProjectPath = projectDir.replace(/^-/, '/').replace(/-/g, '/');
        const projectName = path.basename(decodedProjectPath);

        // For filtering, encode the filter path the same way Claude Code does
        // so we can compare encoded paths directly (avoids hyphen corruption issue)
        if (filter?.projectPath) {
          const encodedFilterPath = this.encodeWorkspacePath(filter.projectPath);
          if (projectDir !== encodedFilterPath) continue;
        }
        if (filter?.projectName && projectName !== filter.projectName) continue;

        const sessionFiles = fs.readdirSync(projectDirPath).filter((f) => f.endsWith('.jsonl'));

        for (const sessionFile of sessionFiles) {
          const sessionFilePath = path.join(projectDirPath, sessionFile);
          const stats = fs.statSync(sessionFilePath);
          const mtime = stats.mtime.getTime();

          // Time filtering
          if (mtime < Math.max(cutoffTime, minTime)) continue;

          const sessionId = path.basename(sessionFile, '.jsonl');
          const summary = this.parseSessionSummary(
            sessionFilePath,
            sessionId,
            decodedProjectPath,
            projectName
          );

          if (summary) {
            // Apply additional filters
            if (filter?.hasThinking && !summary.hasThinking) continue;
            if (filter?.minToolCallCount && summary.toolCallCount < filter.minToolCallCount)
              continue;

            summaries.push(summary);
          }
        }
      }

      // Sort by timestamp descending (most recent first), with updatedAt as tiebreaker
      summaries.sort((a, b) => {
        const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        if (timeDiff !== 0) return timeDiff;
        // Use file modification time as secondary sort
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      return ok(summaries);
    } catch (error) {
      return err(
        agentError(AgentErrorCode.UNKNOWN_ERROR, `Failed to list session summaries: ${error}`)
      );
    }
  }

  private parseSessionSummary(
    filePath: string,
    sessionId: string,
    projectPath: string,
    projectName: string
  ): SessionSummary | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const stats = this.jsonlParser.parseStats(content);

      if (stats.messageCount === 0) return null;

      const fileStats = fs.statSync(filePath);

      return {
        id: sessionId,
        agentType: 'claude_code',
        createdAt: fileStats.birthtime.toISOString(),
        updatedAt: fileStats.mtime.toISOString(),
        timestamp: stats.lastTimestamp || fileStats.mtime.toISOString(),
        projectPath,
        projectName,
        messageCount: stats.messageCount,
        firstUserMessage: stats.firstUserMessage?.substring(0, 200),
        lastAssistantMessage: stats.lastAssistantMessage?.substring(0, 200),
        toolCallCount: stats.toolCallCount,
        hasThinking: stats.hasThinking,
      };
    } catch {
      return null;
    }
  }

  async getSession(
    sessionId: string,
    filter?: MessageFilterOptions
  ): Promise<Result<CodingAgentSessionContent | null, AgentError>> {
    const projectsDir = this.getProjectsDir();
    console.log('[ClaudeCodeAgent] Getting filtered session', { sessionId, filter, projectsDir });
    try {
      if (!fs.existsSync(projectsDir)) {
        return ok(null);
      }

      // If workspacePath is provided, search in that specific project directory first
      // This is important for forked sessions that share the same sessionId
      // but exist in different project directories (parent vs worktree workspace)
      if (filter?.workspacePath) {
        console.log('[ClaudeCodeAgent] Searching for session in specified workspacePath', {
          sessionId,
          workspacePath: filter.workspacePath,
        });

        const encodedPath = this.encodeWorkspacePath(filter.workspacePath);
        const targetDirPath = path.join(projectsDir, encodedPath);
        const sessionFilePath = path.join(targetDirPath, `${sessionId}.jsonl`);

        if (fs.existsSync(sessionFilePath)) {
          console.log('[ClaudeCodeAgent] Found session in target workspace', {
            sessionId,
            workspacePath: filter.workspacePath,
            sessionFilePath,
          });
          return ok(
            this.parseSessionContent(sessionFilePath, sessionId, filter.workspacePath, filter)
          );
        }

        // If not found in target workspace and strict mode would be helpful,
        // we could return null here. For now, fall through to search all directories
        // to maintain backward compatibility.
        console.log('[ClaudeCodeAgent] Session not found in target workspace, searching all', {
          sessionId,
          workspacePath: filter.workspacePath,
        });
      } else {
        console.log(
          '[ClaudeCodeAgent] No workspacePath filter provided, searching all directories for session',
          {
            sessionId,
          }
        );
      }

      // Search for the session file across all project directories
      const projectDirs = fs.readdirSync(projectsDir);

      for (const projectDir of projectDirs) {
        const projectDirPath = path.join(projectsDir, projectDir);
        if (!fs.statSync(projectDirPath).isDirectory()) continue;

        const sessionFilePath = path.join(projectDirPath, `${sessionId}.jsonl`);
        if (fs.existsSync(sessionFilePath)) {
          const projectPath = projectDir.replace(/^-/, '/').replace(/-/g, '/');
          return ok(this.parseSessionContent(sessionFilePath, sessionId, projectPath, filter));
        }
      }

      return ok(null);
    } catch (error) {
      return err(agentError(AgentErrorCode.UNKNOWN_ERROR, `Failed to get session: ${error}`));
    }
  }

  private parseSessionContent(
    filePath: string,
    sessionId: string,
    projectPath: string,
    filter?: MessageFilterOptions
  ): CodingAgentSessionContent {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { messages: allMessages } = this.jsonlParser.parseMessages(content);

    // Apply filters
    const messages = allMessages.filter((msg) => {
      if (
        filter?.messageTypes &&
        msg.messageType &&
        !filter.messageTypes.includes(msg.messageType)
      ) {
        return false;
      }
      if (filter?.roles && msg.role && !filter.roles.includes(msg.role)) {
        return false;
      }
      if (
        filter?.searchText &&
        !msg.content.toLowerCase().includes(filter.searchText.toLowerCase())
      ) {
        return false;
      }
      return true;
    });

    const stats = fs.statSync(filePath);
    const projectName = path.basename(projectPath);

    return {
      id: sessionId,
      agentType: 'claude_code',
      createdAt: stats.birthtime.toISOString(),
      updatedAt: stats.mtime.toISOString(),
      projectPath,
      messageCount: messages.length,
      metadata: {
        projectPath,
        projectName,
        source: 'claude_code',
      },
      messages,
    };
  }

  /**
   * Stream messages one at a time (generator-based)
   */
  async *streamSessionMessages(
    sessionId: string,
    filter?: MessageFilterOptions
  ): AsyncGenerator<CodingAgentMessage, void, unknown> {
    const projectsDir = this.getProjectsDir();

    if (!fs.existsSync(projectsDir)) return;

    const projectDirs = fs.readdirSync(projectsDir);

    for (const projectDir of projectDirs) {
      const projectDirPath = path.join(projectsDir, projectDir);
      if (!fs.statSync(projectDirPath).isDirectory()) continue;

      const sessionFilePath = path.join(projectDirPath, `${sessionId}.jsonl`);
      if (!fs.existsSync(sessionFilePath)) continue;

      const content = fs.readFileSync(sessionFilePath, 'utf-8');

      for (const msg of this.jsonlParser.streamMessages(content)) {
        // Apply filters
        if (
          filter?.messageTypes &&
          msg.messageType &&
          !filter.messageTypes.includes(msg.messageType)
        ) {
          continue;
        }
        if (filter?.roles && msg.role && !filter.roles.includes(msg.role)) {
          continue;
        }
        if (
          filter?.searchText &&
          !msg.content.toLowerCase().includes(filter.searchText.toLowerCase())
        ) {
          continue;
        }

        yield msg;
      }

      return; // Found the session, done
    }
  }
}

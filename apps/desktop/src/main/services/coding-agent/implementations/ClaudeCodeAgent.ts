import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Query, SDKMessage, Options, CanUseTool, PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import {
  createEventRegistry,
  createSDKHookBridge,
  type EventRegistry,
  type SDKHookBridge,
} from '@agent-orchestrator/shared';
import type {
  ICodingAgentProvider,
  ISessionResumable,
  ISessionForkable,
  IProcessLifecycle,
  IChatHistoryProvider,
} from '../interfaces';
import type {
  Result,
  AgentError,
  AgentConfig,
  AgentCapabilities,
  CodingAgentType,
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
  CodingAgentMessage,
  ToolCategory,
  AgentContentBlock,
  AgentWebSearchToolResultContent,
  AgentWebSearchResultBlock,
  AgentWebSearchToolResultErrorCode,
} from '../types';
import { AgentErrorCode, ok, err, agentError } from '../types';
import {
  mapSdkMessagesToResponse,
  findResultMessage,
  extractStreamingChunk,
  isResultError,
} from '../utils/sdk-message-mapper';
import {
  mapSdkError,
  mapSdkResultError,
  noResultError,
} from '../utils/sdk-error-mapper';
import { ForkAdapterFactory } from '../../fork-adapters/factory/ForkAdapterFactory';
import type { AgentEvent, PermissionPayload, SessionPayload } from '@agent-orchestrator/shared';

/**
 * Active query handle for tracking and cancellation
 */
interface QueryHandle {
  id: string;
  query: Query;
  abortController: AbortController;
  startTime: number;
}

/**
 * Claude Code SDK agent implementation
 *
 * Implements:
 * - ICodingAgentProvider: Core generation via SDK query()
 * - ISessionResumable: Resume via SDK options.resume and options.continue
 * - ISessionForkable: Fork via SDK options.forkSession
 * - IProcessLifecycle: Lifecycle management via AbortController
 * - IChatHistoryProvider: Session listing via filesystem (SDK doesn't support this)
 *
 * SDK Methods Used:
 * - query({ prompt }) - One-off generation
 * - query({ prompt, options: { resume: id } }) - Resume by ID
 * - query({ prompt, options: { continue: true } }) - Resume latest session
 * - query({ prompt, options: { resume: id, forkSession: true } }) - Fork session
 */

/**
 * JSONL line structure from Claude Code session files
 */
interface JsonlLine {
  type?: string;
  message?: {
    role: string;
    content: unknown;
  };
  timestamp?: string | number;
  sessionId?: string;
  summary?: string;
}

/**
 * Configuration for ClaudeCodeAgent with hook options
 */
export interface ClaudeCodeAgentConfig extends AgentConfig {
  /** Enable debug logging for hooks */
  debugHooks?: boolean;
}

export class ClaudeCodeAgent
  extends EventEmitter
  implements ICodingAgentProvider, ISessionResumable, ISessionForkable, IProcessLifecycle, IChatHistoryProvider
{
  protected readonly config: AgentConfig;
  private readonly eventRegistry: EventRegistry;
  private readonly hookBridge: SDKHookBridge;
  private readonly debugHooks: boolean;
  private readonly activeQueries = new Map<string, QueryHandle>();
  private isInitialized = false;
  private currentSessionId: string | null = null;
  private currentWorkspacePath: string | null = null;
  private readonly queryContexts = new WeakMap<
    AbortSignal,
    { agentId?: string; sessionId?: string; workspacePath?: string }
  >();
  private readonly canUseTool: CanUseTool = async (
    toolName: string,
    input: Record<string, unknown>,
    options
  ): Promise<PermissionResult> => {
    const context = options.signal ? this.queryContexts.get(options.signal) : undefined;
    const workspacePath = context?.workspacePath ?? this.currentWorkspacePath ?? undefined;
    const sessionId = context?.sessionId ?? this.currentSessionId ?? undefined;
    const event: AgentEvent<PermissionPayload> = {
      id: crypto.randomUUID(),
      type: 'permission:request',
      agent: 'claude_code',
      agentId: context?.agentId,
      sessionId,
      workspacePath,
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
    });
    // Avoid double-emitting permission requests when canUseTool handles them.
    delete this.hookBridge.hooks.PermissionRequest;
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
  // IProcessLifecycle Implementation
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
  // ICodingAgentProvider Implementation
  // ============================================

  async generate(request: GenerateRequest): Promise<Result<GenerateResponse, AgentError>> {
    const initCheck = this.ensureInitialized();
    if (initCheck.success === false) {
      return { success: false, error: initCheck.error };
    }

    const queryId = crypto.randomUUID();
    const abortController = new AbortController();

    try {
      const options = this.buildQueryOptions(request, abortController);
      const queryResult = query({ prompt: request.prompt, options });

      const handle: QueryHandle = {
        id: queryId,
        query: queryResult,
        abortController,
        startTime: Date.now(),
      };

      if (request.sessionId) {
        options.resume = request.sessionId;
      }

      this.activeQueries.set(queryId, handle);

      console.log(`[ClaudeCodeAgent] Starting generate query ${queryId} with options:`, options);

      // Collect all messages
      const messages: SDKMessage[] = [];
      for await (const message of queryResult) {
        messages.push(message);
      }

      console.log(`[ClaudeCodeAgent] Completed generate query ${queryId} with ${messages.length} messages.`);
      console.debug(`[ClaudeCodeAgent] Messages:`, messages);

      this.activeQueries.delete(queryId);

      // Find result message and check for errors
      const resultMessage = findResultMessage(messages);
      
      if (!resultMessage) {
        console.error(`[ClaudeCodeAgent] No result message found for query ${queryId}.`);
        return err(noResultError());
      }

      if (isResultError(resultMessage)) {
        return err(mapSdkResultError(resultMessage));
      }

      return ok(mapSdkMessagesToResponse(messages, resultMessage));
    } catch (error) {
      this.activeQueries.delete(queryId);
      return err(mapSdkError(error));
    }
  }

  async generateStreaming(
    request: GenerateRequest,
    onChunk: StreamCallback
  ): Promise<Result<GenerateResponse, AgentError>> {
    const initCheck = this.ensureInitialized();
    if (initCheck.success === false) {
      return { success: false, error: initCheck.error };
    }

    const queryId = crypto.randomUUID();
    const abortController = new AbortController();

    try {
      const options = this.buildQueryOptions(request, abortController, true);
      const queryResult = query({ prompt: request.prompt, options });

      const handle: QueryHandle = {
        id: queryId,
        query: queryResult,
        abortController,
        startTime: Date.now(),
      };

      if (request.sessionId) {
        options.resume = request.sessionId;
      }

      this.activeQueries.set(queryId, handle);

      // Collect messages and stream chunks
      const messages: SDKMessage[] = [];
      for await (const message of queryResult) {
        messages.push(message);

        // Stream partial messages
        if (message.type === 'stream_event') {
          const chunk = extractStreamingChunk(message);
          if (chunk) {
            onChunk(chunk);
          }
        }
      }

      this.activeQueries.delete(queryId);

      // Find result message and check for errors
      const resultMessage = findResultMessage(messages);
      if (!resultMessage) {
        return err(noResultError());
      }

      if (isResultError(resultMessage)) {
        return err(mapSdkResultError(resultMessage));
      }

      return ok(mapSdkMessagesToResponse(messages, resultMessage));
    } catch (error) {
      this.activeQueries.delete(queryId);
      return err(mapSdkError(error));
    }
  }

  /**
   * Build SDK query options from a generate request
   */
  private buildQueryOptions(
    request: GenerateRequest,
    abortController: AbortController,
    streaming = false
  ): Partial<Options> {
    const options: Partial<Options> = {
      cwd: request.workingDirectory ?? this.config.workingDirectory,
      abortController,
      hooks: this.hookBridge.hooks,
      canUseTool: this.canUseTool,
      tools: { type: 'preset', preset: 'claude_code' },
    };
    this.currentWorkspacePath = options.cwd ?? null;

    // Handle system prompt
    if (request.systemPrompt) {
      options.systemPrompt = {
        type: 'preset',
        preset: 'claude_code',
        append: request.systemPrompt,
      };
    } else {
      options.systemPrompt = { type: 'preset', preset: 'claude_code' };
    }

    if (request.sessionId) {
      options.resume = request.sessionId;
    }

    this.queryContexts.set(abortController.signal, {
      agentId: request.agentId,
      sessionId: request.sessionId,
      workspacePath: options.cwd ?? undefined,
    });

    // Enable streaming partial messages
    if (streaming) {
      options.includePartialMessages = true;
    }

    return options;
  }

  // ============================================
  // ISessionResumable Implementation
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

    const queryId = crypto.randomUUID();
    const abortController = new AbortController();

    try {
      const sdkOptions = this.buildContinueOptions(identifier, abortController, options);
      const queryResult = query({ prompt, options: sdkOptions });

      const handle: QueryHandle = {
        id: queryId,
        query: queryResult,
        abortController,
        startTime: Date.now(),
      };
      this.activeQueries.set(queryId, handle);

      // Collect all messages
      const messages: SDKMessage[] = [];
      for await (const message of queryResult) {
        messages.push(message);
      }

      this.activeQueries.delete(queryId);

      const resultMessage = findResultMessage(messages);
      if (!resultMessage) {
        return err(noResultError());
      }

      if (isResultError(resultMessage)) {
        return err(mapSdkResultError(resultMessage));
      }

      return ok(mapSdkMessagesToResponse(messages, resultMessage));
    } catch (error) {
      this.activeQueries.delete(queryId);
      return err(mapSdkError(error));
    }
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

    const queryId = crypto.randomUUID();
    const abortController = new AbortController();

    try {
      const sdkOptions = this.buildContinueOptions(identifier, abortController, options, true);
      const queryResult = query({ prompt, options: sdkOptions });

      const handle: QueryHandle = {
        id: queryId,
        query: queryResult,
        abortController,
        startTime: Date.now(),
      };
      this.activeQueries.set(queryId, handle);

      // Collect messages and stream chunks
      const messages: SDKMessage[] = [];
      for await (const message of queryResult) {
        messages.push(message);

        if (message.type === 'stream_event') {
          const chunk = extractStreamingChunk(message);
          if (chunk) {
            onChunk(chunk);
          }
        }
      }

      this.activeQueries.delete(queryId);

      const resultMessage = findResultMessage(messages);
      if (!resultMessage) {
        return err(noResultError());
      }

      if (isResultError(resultMessage)) {
        return err(mapSdkResultError(resultMessage));
      }

      return ok(mapSdkMessagesToResponse(messages, resultMessage));
    } catch (error) {
      this.activeQueries.delete(queryId);
      return err(mapSdkError(error));
    }
  }

  /**
   * Build SDK options for session continuation
   */
  private buildContinueOptions(
    identifier: SessionIdentifier,
    abortController: AbortController,
    continueOptions?: ContinueOptions,
    streaming = false
  ): Partial<Options> {
    const options: Partial<Options> = {
      cwd: continueOptions?.workingDirectory ?? this.config.workingDirectory,
      abortController,
      hooks: this.hookBridge.hooks,
      canUseTool: this.canUseTool,
      tools: { type: 'preset', preset: 'claude_code' },
      systemPrompt: { type: 'preset', preset: 'claude_code' },
    };
    this.currentWorkspacePath = options.cwd ?? null;

    // Map SessionIdentifier to SDK options
    switch (identifier.type) {
      case 'latest':
        options.continue = true;
        break;
      case 'id':
      case 'name':
        options.resume = identifier.value;
        break;
    }

    this.queryContexts.set(abortController.signal, {
      agentId: continueOptions?.agentId,
      sessionId: identifier.type === 'id' ? identifier.value : undefined,
      workspacePath: options.cwd ?? undefined,
    });

    if (streaming) {
      options.includePartialMessages = true;
    }

    return options;
  }

  // ============================================
  // ISessionForkable Implementation
  // ============================================

  async forkSession(
    parentIdentifier: SessionIdentifier,
    options?: ForkOptions
  ): Promise<Result<SessionInfo, AgentError>> {
    const initCheck = this.ensureInitialized();
    if (initCheck.success === false) {
      return { success: false, error: initCheck.error };
    }

    // Resolve the parent session ID
    const parentId = this.resolveSessionId(parentIdentifier);
    if (!parentId) {
      return err(
        agentError(
          AgentErrorCode.SESSION_INVALID,
          'Cannot fork from "latest" session - please specify a session ID or name'
        )
      );
    }

    // Handle same-directory fork (original SDK fork behavior)
    const queryId = crypto.randomUUID();
    const abortController = new AbortController();
  
    const targetCwd = options?.workingDirectory ?? this.config.workingDirectory ?? process.cwd();
    const sourceCwd = this.config.workingDirectory ?? process.cwd();
    const isCrossDirectory = targetCwd !== sourceCwd;

    try {

      var sdkOptions: Partial<Options>;

      if (isCrossDirectory) {
        sdkOptions = {
          abortController,
          hooks: this.hookBridge.hooks,
          canUseTool: this.canUseTool,
          tools: { type: 'preset', preset: 'claude_code' },
          systemPrompt: { type: 'preset', preset: 'claude_code' },
          extraArgs: { session_id: parentId }
        };

      } else {
        sdkOptions = {
          abortController,
          hooks: this.hookBridge.hooks,
          canUseTool: this.canUseTool,
          resume: parentId,
          forkSession: true,
          tools: { type: 'preset', preset: 'claude_code' },
          systemPrompt: { type: 'preset', preset: 'claude_code' },
        };
      }

      // Use empty prompt to trigger the fork
      const queryResult = query({ prompt: '', options: sdkOptions });

      const handle: QueryHandle = {
        id: queryId,
        query: queryResult,
        abortController,
        startTime: Date.now(),
      };
      this.activeQueries.set(queryId, handle);

      for await (const message of queryResult) {
        // Extract session_id from any message
        if ('session_id' in message && message.session_id) {
          parentId != message.session_id;
        }
      }
    } catch (error) {
      console.error('[ClaudeCodeAgent] Failed to create new session', { error });
    }

    // Handle cross-directory fork (worktree scenario)
    if (isCrossDirectory) {
      console.log('[ClaudeCodeAgent] Cross-directory fork detected', { sourceCwd, targetCwd });

      // Get fork adapter for Claude Code
      const adapter = ForkAdapterFactory.getAdapter('claude_code');
      if (!adapter) {
        return err(
          agentError(
            AgentErrorCode.CAPABILITY_NOT_SUPPORTED,
            'Cross-directory fork adapter not available'
          )
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

        // IMPORTANT: Use the SAME session ID (parentId) for the forked session
        // This allows Claude Code SDK to find the copied JSONL file in the new directory
        const forkResult = await adapter.forkSessionFile(
          parentId,
          parentId, // Use same session ID - file will be in different project directory
          sourceCwd,
          resolvedTargetCwd
        );

        if (!forkResult.success) {
          console.error('[ClaudeCodeAgent] Fork adapter failed to fork session', { error: forkResult.error });
          throw forkResult.error;
        }
      } catch (error) {
        return err(
          agentError(
            AgentErrorCode.UNKNOWN_ERROR,
            `Failed to fork session file: ${error}`
          )
        );
      }
    }

    return ok({
      id: parentId,
      name: options?.newSessionName,
      agentType: 'claude_code',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0,
      parentSessionId: parentId,
    });
  }

  /**
   * Extract branch name from worktree path
   * e.g., "/repo/.git/worktrees/fork-feature-123" → "fork-feature-123"
   */
  private extractBranchFromPath(path: string): string | null {
    const match = path.match(/worktrees\/([^\/]+)/);
    return match ? match[1] : null;
  }

  private resolveSessionId(identifier: SessionIdentifier): string | null {
    switch (identifier.type) {
      case 'id':
      case 'name':
        return identifier.value;
      case 'latest':
        return null; // Cannot resolve latest without session context
    }
  }

  // ============================================
  // IChatHistoryProvider Implementation
  // (Filesystem-based - unchanged from CLI version)
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

        const sessionFiles = fs.readdirSync(projectDirPath).filter(f => f.endsWith('.jsonl'));

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
          const encodedFilterPath = filter.projectPath.replace(/\//g, '-');
          if (projectDir !== encodedFilterPath) continue;
        }
        if (filter?.projectName && projectName !== filter.projectName) continue;

        const sessionFiles = fs.readdirSync(projectDirPath).filter(f => f.endsWith('.jsonl'));

        for (const sessionFile of sessionFiles) {
          const sessionFilePath = path.join(projectDirPath, sessionFile);
          const stats = fs.statSync(sessionFilePath);
          const mtime = stats.mtime.getTime();

          // Time filtering
          if (mtime < Math.max(cutoffTime, minTime)) continue;

          const sessionId = path.basename(sessionFile, '.jsonl');
          const summary = this.parseSessionSummary(sessionFilePath, sessionId, decodedProjectPath, projectName);

          if (summary) {
            // Apply additional filters
            if (filter?.hasThinking && !summary.hasThinking) continue;
            if (filter?.minToolCallCount && summary.toolCallCount < filter.minToolCallCount) continue;

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
        agentError(
          AgentErrorCode.UNKNOWN_ERROR,
          `Failed to list session summaries: ${error}`
        )
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
      const lines = content.trim().split('\n').filter(line => line.trim());

      if (lines.length === 0) return null;

      let messageCount = 0;
      let toolCallCount = 0;
      let hasThinking = false;
      let firstUserMessage: string | undefined;
      let lastAssistantMessage: string | undefined;
      let lastTimestamp: string | undefined;

      for (const line of lines) {
        try {
          const data: JsonlLine = JSON.parse(line);

          if (data.timestamp) {
            lastTimestamp = this.normalizeTimestamp(data.timestamp);
          }

          if (data.type === 'user' && data.message?.content) {
            messageCount++;
            if (!firstUserMessage) {
              firstUserMessage = this.extractDisplayContent(data.message.content);
            }
          }

          if (data.type === 'assistant' && data.message?.content) {
            messageCount++;
            const display = this.extractDisplayContent(data.message.content);
            if (display) lastAssistantMessage = display;

            // Check for tool use blocks
            if (Array.isArray(data.message.content)) {
              for (const part of data.message.content) {
                if (typeof part === 'object' && part !== null) {
                  if ((part as Record<string, unknown>).type === 'tool_use') {
                    toolCallCount++;
                  }
                  if ((part as Record<string, unknown>).type === 'thinking') {
                    hasThinking = true;
                  }
                }
              }
            }
          }
        } catch {
          // Skip malformed lines
        }
      }

      if (messageCount === 0) return null;

      const stats = fs.statSync(filePath);

      return {
        id: sessionId,
        agentType: 'claude_code',
        createdAt: stats.birthtime.toISOString(),
        updatedAt: stats.mtime.toISOString(),
        timestamp: lastTimestamp || stats.mtime.toISOString(),
        projectPath,
        projectName,
        messageCount,
        firstUserMessage: firstUserMessage?.substring(0, 200),
        lastAssistantMessage: lastAssistantMessage?.substring(0, 200),
        toolCallCount,
        hasThinking,
      };
    } catch {
      return null;
    }
  }

  async getFilteredSession(
    sessionId: string,
    filter?: MessageFilterOptions
  ): Promise<Result<CodingAgentSessionContent | null, AgentError>> {
    const projectsDir = this.getProjectsDir();

    try {
      if (!fs.existsSync(projectsDir)) {
        return ok(null);
      }

      // Search for the session file
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
      return err(
        agentError(
          AgentErrorCode.UNKNOWN_ERROR,
          `Failed to get session: ${error}`
        )
      );
    }
  }

  private parseSessionContent(
    filePath: string,
    sessionId: string,
    projectPath: string,
    filter?: MessageFilterOptions
  ): CodingAgentSessionContent {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    const messages: CodingAgentMessage[] = [];

    for (const line of lines) {
      try {
        const data: JsonlLine = JSON.parse(line);
        const parsedMessages = this.parseJsonlLine(data);

        for (const msg of parsedMessages) {
          // Apply filters
          if (filter?.messageTypes && msg.messageType && !filter.messageTypes.includes(msg.messageType)) {
            continue;
          }
          if (filter?.roles && msg.role && !filter.roles.includes(msg.role)) {
            continue;
          }
          if (filter?.searchText && !msg.content.toLowerCase().includes(filter.searchText.toLowerCase())) {
            continue;
          }

          messages.push(msg);
        }
      } catch {
        // Skip malformed lines
      }
    }

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

  private parseJsonlLine(data: JsonlLine): CodingAgentMessage[] {
    const messages: CodingAgentMessage[] = [];
    const timestamp = this.normalizeTimestamp(data.timestamp);

    if (!data.message?.content) {
      return messages;
    }

    if (data.type === 'user' || data.type === 'assistant') {
      const { blocks, displayText } = this.parseContentBlocks(data.message.content);
      if (!displayText && blocks.length === 0) {
        return messages;
      }

      messages.push({
        id: crypto.randomUUID(),
        role: data.type,
        content: displayText,
        contentBlocks: blocks.length > 0 ? blocks : undefined,
        timestamp,
        messageType: data.type,
        agentMetadata: { rawType: data.type },
      });
    }

    return messages;
  }

  private parseContentBlocks(content: unknown): {
    blocks: AgentContentBlock[];
    displayText: string;
  } {
    const blocks: AgentContentBlock[] = [];
    const textParts: string[] = [];

    const pushTextBlock = (text: string, citations?: unknown[] | null) => {
      const normalized = String(text);
      if (!normalized) return;
      blocks.push({ type: 'text', text: normalized, citations });
      textParts.push(normalized);
    };

    const parseToolInput = (input: unknown): Record<string, unknown> => {
      if (input && typeof input === 'object' && !Array.isArray(input)) {
        return input as Record<string, unknown>;
      }
      return {};
    };

    const parseBlock = (part: unknown) => {
      if (typeof part === 'string') {
        pushTextBlock(part);
        return;
      }

      if (!part || typeof part !== 'object') return;

      const obj = part as Record<string, unknown>;
      const type = obj.type;

      if (type === 'text') {
        if (typeof obj.text === 'string') {
          const citations = Array.isArray(obj.citations)
            ? obj.citations
            : obj.citations === null
            ? null
            : undefined;
          pushTextBlock(obj.text, citations);
        }
        return;
      }

      if (type === 'thinking') {
        if (typeof obj.thinking === 'string') {
          blocks.push({
            type: 'thinking',
            thinking: obj.thinking,
            signature: typeof obj.signature === 'string' ? obj.signature : undefined,
          });
        }
        return;
      }

      if (type === 'redacted_thinking') {
        if (typeof obj.data === 'string') {
          blocks.push({ type: 'redacted_thinking', data: obj.data });
        }
        return;
      }

      if (type === 'tool_use' || type === 'server_tool_use') {
        const id = typeof obj.id === 'string' ? obj.id : crypto.randomUUID();
        const name = typeof obj.name === 'string' ? obj.name : 'unknown';
        const input = parseToolInput(obj.input);
        if (type === 'tool_use') {
          blocks.push({ type: 'tool_use', id, name, input });
        } else {
          blocks.push({ type: 'server_tool_use', id, name, input });
        }
        return;
      }

      if (type === 'web_search_tool_result') {
        const toolUseId =
          typeof obj.tool_use_id === 'string'
            ? obj.tool_use_id
            : typeof obj.toolUseId === 'string'
            ? obj.toolUseId
            : crypto.randomUUID();
        const parsedContent = this.parseWebSearchToolResultContent(obj.content);
        if (parsedContent) {
          blocks.push({
            type: 'web_search_tool_result',
            toolUseId,
            content: parsedContent,
          });
        }
        return;
      }

      if (type === 'tool_result' && obj.content !== undefined) {
        pushTextBlock(String(obj.content));
      }
    };

    if (typeof content === 'string') {
      pushTextBlock(content);
    } else if (Array.isArray(content)) {
      for (const part of content) {
        parseBlock(part);
      }
    } else {
      parseBlock(content);
    }

    return {
      blocks,
      displayText: textParts.join('\n'),
    };
  }

  private parseWebSearchToolResultContent(
    content: unknown
  ): AgentWebSearchToolResultContent | null {
    if (Array.isArray(content)) {
      const results: AgentWebSearchResultBlock[] = [];
      for (const entry of content) {
        if (!entry || typeof entry !== 'object') continue;
        const obj = entry as Record<string, unknown>;
        if (obj.type !== 'web_search_result') continue;
        if (typeof obj.title !== 'string' || typeof obj.url !== 'string') continue;
        results.push({
          type: 'web_search_result',
          encryptedContent: typeof obj.encrypted_content === 'string' ? obj.encrypted_content : '',
          pageAge: typeof obj.page_age === 'string' ? obj.page_age : null,
          title: obj.title,
          url: obj.url,
        });
      }
      return results;
    }

    if (content && typeof content === 'object') {
      const obj = content as Record<string, unknown>;
      if (obj.type === 'web_search_tool_result_error' && typeof obj.error_code === 'string') {
        if (this.isWebSearchToolResultErrorCode(obj.error_code)) {
          return {
            type: 'web_search_tool_result_error',
            errorCode: obj.error_code,
          };
        }
      }
    }

    return null;
  }

  private isWebSearchToolResultErrorCode(
    value: string
  ): value is AgentWebSearchToolResultErrorCode {
    return (
      value === 'invalid_tool_input' ||
      value === 'unavailable' ||
      value === 'max_uses_exceeded' ||
      value === 'too_many_requests' ||
      value === 'query_too_long'
    );
  }

  private categorizeToolByName(name: string): ToolCategory {
    const lowerName = name.toLowerCase();

    if (['read', 'cat', 'head', 'tail'].some(t => lowerName.includes(t))) {
      return 'file_read';
    }
    if (['write', 'edit', 'touch'].some(t => lowerName.includes(t))) {
      return 'file_write';
    }
    if (['glob', 'grep', 'find', 'search'].some(t => lowerName.includes(t))) {
      return 'file_search';
    }
    if (['bash', 'shell', 'terminal', 'exec'].some(t => lowerName.includes(t))) {
      return 'shell';
    }
    if (['web', 'fetch', 'http', 'url'].some(t => lowerName.includes(t))) {
      return 'web';
    }
    if (['lsp', 'definition', 'reference', 'hover'].some(t => lowerName.includes(t))) {
      return 'code_intel';
    }
    if (lowerName.startsWith('mcp')) {
      return 'mcp';
    }

    return 'custom';
  }

  private extractDisplayContent(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      const textParts: string[] = [];
      for (const part of content) {
        if (typeof part === 'string') {
          textParts.push(part);
        } else if (typeof part === 'object' && part !== null) {
          const obj = part as Record<string, unknown>;
          if (obj.type === 'text' && obj.text) {
            textParts.push(String(obj.text));
          }
        }
      }
      return textParts.join('\n');
    }

    return '';
  }

  private normalizeTimestamp(timestamp: string | number | undefined): string {
    if (!timestamp) return new Date().toISOString();

    if (typeof timestamp === 'string') {
      // First, try to parse as ISO date string (most common case)
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }

      // If not a valid date string, try parsing as numeric timestamp
      const num = parseInt(timestamp, 10);
      if (!isNaN(num) && num > 0) {
        timestamp = num;
      } else {
        return new Date().toISOString();
      }
    }

    if (typeof timestamp === 'number') {
      // If > year 2000 in ms
      if (timestamp > 946684800000) {
        return new Date(timestamp).toISOString();
      }
      // If in seconds
      if (timestamp > 946684800) {
        return new Date(timestamp * 1000).toISOString();
      }
    }

    return new Date().toISOString();
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
      const lines = content.trim().split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data: JsonlLine = JSON.parse(line);
          const parsedMessages = this.parseJsonlLine(data);

          for (const msg of parsedMessages) {
            // Apply filters
            if (filter?.messageTypes && msg.messageType && !filter.messageTypes.includes(msg.messageType)) {
              continue;
            }
            if (filter?.roles && msg.role && !filter.roles.includes(msg.role)) {
              continue;
            }
            if (filter?.searchText && !msg.content.toLowerCase().includes(filter.searchText.toLowerCase())) {
              continue;
            }

            yield msg;
          }
        } catch {
          // Skip malformed lines
        }
      }

      return; // Found the session, done
    }
  }
}

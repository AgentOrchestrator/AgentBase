/**
 * AgentServiceImpl
 *
 * Implementation of IAgentService that manages coding agent lifecycle via adapter.
 * Orchestrates terminal display + adapter-driven agent operations.
 *
 * The service layer unwraps Result types from the adapter and throws
 * exceptions for cleaner consumer API, while maintaining status updates
 * and session persistence.
 */

import type {
  AgentType,
  CodingAgentStatus,
  CodingAgentStatusInfo,
  StatusChangeListener,
} from '../../../../types/coding-agent-status';
import type { IAgentService, ITerminalService } from '../../context/node-services';
import type {
  ICodingAgentAdapter,
  GenerateResponse,
  StreamCallback,
  SessionInfo,
  CodingAgentSessionContent,
  MessageFilterOptions,
  AgentAdapterEventType,
  AgentEventHandler,
  Result,
  AgentError,
} from '../../context/node-services/coding-agent-adapter';

/**
 * Agent service implementation using adapter pattern
 */
export class AgentServiceImpl implements IAgentService {
  readonly nodeId: string;
  readonly agentId: string;
  readonly agentType: AgentType;

  private adapter: ICodingAgentAdapter | null;
  private terminalService: ITerminalService;
  private statusListeners: Set<StatusChangeListener> = new Set();
  private currentStatus: CodingAgentStatusInfo | null = null;
  private autoStartEnabled = false;
  private isRunning = false;
  private currentSessionId: string | null = null;
  private workspacePathValue: string | null = null;

  constructor(
    nodeId: string,
    agentId: string,
    agentType: AgentType,
    terminalService: ITerminalService,
    adapter: ICodingAgentAdapter | null,
    workspacePath?: string
  ) {
    this.nodeId = nodeId;
    this.agentId = agentId;
    this.agentType = agentType;
    this.terminalService = terminalService;
    this.adapter = adapter;
    this.workspacePathValue = workspacePath || null;

    // Initialize status
    this.currentStatus = {
      status: 'idle',
      startedAt: Date.now(),
    };
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  /**
   * Require workspace to be set, throw if not
   */
  private requireWorkspace(): string {
    if (!this.workspacePathValue) {
      throw new Error('Workspace path not set. Call setWorkspace() first.');
    }
    return this.workspacePathValue;
  }

  /**
   * Require adapter to be set, throw if not
   */
  private requireAdapter(): ICodingAgentAdapter {
    if (!this.adapter) {
      throw new Error('Adapter not configured for this agent service.');
    }
    return this.adapter;
  }

  /**
   * Unwrap a Result type, throwing on error
   */
  private unwrapResult<T>(result: Result<T, AgentError>): T {
    if (!result.success) {
      const error = new Error(result.error.message);
      (error as Error & { code?: string; cause?: unknown }).code = result.error.code;
      (error as Error & { cause?: unknown }).cause = result.error.cause;
      throw error;
    }
    return result.data;
  }

  // =============================================================================
  // Getters
  // =============================================================================

  /** Get the current workspace path */
  get workspacePath(): string | null {
    return this.workspacePathValue;
  }

  // =============================================================================
  // Lifecycle
  // =============================================================================

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    console.log('[AgentService] initialize() START', {
      agentId: this.agentId,
      terminalId: this.terminalService.terminalId,
      hasAdapter: !!this.adapter,
    });

    // Initialize adapter if available
    if (this.adapter) {
      const result = await this.adapter.initialize();
      if (!result.success) {
        console.warn('[AgentService] Adapter initialization failed:', result.error);
      }
    }

    // Check main process for existing session state (survives renderer refresh)
    await this.restoreSessionStateFromMainProcess();

    console.log('[AgentService] initialize() AFTER restore, isRunning=', this.isRunning, {
      agentId: this.agentId,
      terminalId: this.terminalService.terminalId,
    });

    // Listen to terminal exit to update status
    this.terminalService.onExit((code) => {
      if (this.isRunning) {
        this.isRunning = false;
        this.updateStatus(code === 0 ? 'completed' : 'error', {
          errorMessage: code !== 0 ? `Process exited with code ${code}` : undefined,
        });
        // Clear session state in main process
        this.clearSessionStateInMainProcess();
      }
    });
  }

  /**
   * Dispose the service
   */
  async dispose(): Promise<void> {
    // Stop agent if running
    if (this.isRunning) {
      await this.stop();
    }

    // Dispose adapter if available
    if (this.adapter) {
      await this.adapter.dispose();
    }

    // Clear listeners
    this.statusListeners.clear();
    this.currentStatus = null;
  }

  // =============================================================================
  // Session State Persistence
  // =============================================================================

  /**
   * Restore session state from main process after renderer refresh
   */
  private async restoreSessionStateFromMainProcess(): Promise<void> {
    console.log('[AgentService] restoreSessionStateFromMainProcess() called', {
      agentId: this.agentId,
      terminalId: this.terminalService.terminalId,
      hasAPI: !!window.terminalSessionAPI,
    });

    if (!window.terminalSessionAPI) {
      console.log('[AgentService] No terminalSessionAPI available, skipping restore');
      return;
    }

    try {
      const state = await window.terminalSessionAPI.getTerminalSessionState(
        this.terminalService.terminalId
      );

      console.log('[AgentService] Got session state from main process', {
        agentId: this.agentId,
        terminalId: this.terminalService.terminalId,
        state,
      });

      if (state && state.agentRunning) {
        console.log('[AgentService] Restoring isRunning=true from main process state', {
          agentId: this.agentId,
          terminalId: this.terminalService.terminalId,
        });
        this.isRunning = true;
        this.currentSessionId = state.sessionId || null;
        this.updateStatus('running');
      } else {
        console.log('[AgentService] No active agent session to restore', {
          agentId: this.agentId,
          terminalId: this.terminalService.terminalId,
          state,
        });
      }
    } catch (error) {
      console.warn('[AgentService] Failed to restore session state', error);
    }
  }

  /**
   * Persist session state to main process
   */
  private async persistSessionStateToMainProcess(sessionId?: string): Promise<void> {
    if (!window.terminalSessionAPI) {
      return;
    }

    try {
      await window.terminalSessionAPI.setTerminalSessionState(
        this.terminalService.terminalId,
        {
          agentRunning: true,
          agentType: this.agentType,
          sessionId,
          startedAt: Date.now(),
        }
      );
    } catch (error) {
      console.warn('[AgentService] Failed to persist session state', error);
    }
  }

  /**
   * Clear session state in main process
   */
  private async clearSessionStateInMainProcess(): Promise<void> {
    if (!window.terminalSessionAPI) {
      return;
    }

    try {
      await window.terminalSessionAPI.clearTerminalSessionState(
        this.terminalService.terminalId
      );
    } catch (error) {
      console.warn('[AgentService] Failed to clear session state', error);
    }
  }

  // =============================================================================
  // Terminal Helpers
  // =============================================================================

  /**
   * Wait for terminal to be ready (shell initialized).
   * Resolves when first data is received or after timeout.
   */
  private waitForTerminalReady(timeoutMs = 2000): Promise<void> {
    return new Promise((resolve) => {
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.log('[AgentService] Terminal ready (timeout fallback)');
          resolve();
        }
      }, timeoutMs);

      const unsubscribe = this.terminalService.onData(() => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          unsubscribe();
          console.log('[AgentService] Terminal ready (data received)');
          resolve();
        }
      });
    });
  }

  /**
   * Wait for Claude REPL to be ready, then clear terminal.
   * Looks for indicators that Claude has started (e.g., prompt or welcome message).
   */
  private setupTerminalClearOnReady(timeoutMs = 3000): void {
    let resolved = false;

    const unsubscribe = this.terminalService.onData((data) => {
      // Look for Claude's ready indicator
      // Claude Code typically shows a welcome message or prompt
      if (!resolved && (data.includes('Claude') || data.includes('>'))) {
        resolved = true;
        unsubscribe();
        // Small delay to ensure full initialization
        setTimeout(() => {
          console.log('[AgentService] Clearing terminal (Claude ready)');
          this.terminalService.write('\x1bc'); // Full terminal reset
        }, 100);
      }
    });

    // Fallback timeout in case detection fails
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        unsubscribe();
        console.log('[AgentService] Clearing terminal (timeout fallback)');
        this.terminalService.write('\x1bc');
      }
    }, timeoutMs);
  }

  // =============================================================================
  // Public Lifecycle API
  // =============================================================================

  /**
   * Start the coding agent CLI REPL in the terminal.
   * Call setWorkspace() first to set the working directory.
   * @param sessionId - UUID for the session (required for new sessions, used for resume check)
   * @param initialPrompt - Optional initial prompt (currently unused - user types in terminal)
   */
  async start(sessionId?: string, _initialPrompt?: string): Promise<void> {
    console.log('[AgentService] start() called', {
      agentId: this.agentId,
      terminalId: this.terminalService.terminalId,
      isRunning: this.isRunning,
      sessionId,
    });

    if (this.isRunning) {
      console.log('[AgentService] start() skipped - already running', {
        agentId: this.agentId,
      });
      return;
    }

    // Require workspace and session ID
    const workspacePath = this.requireWorkspace();
    if (!sessionId) {
      console.error('[AgentService] start() requires sessionId');
      this.updateStatus('error', {
        errorMessage: 'Session ID is required to start the agent',
      });
      return;
    }

    // Ensure terminal is created
    if (!this.terminalService.isRunning()) {
      await this.terminalService.create();
    }

    // Wait for terminal to be ready (shell initialized)
    await this.waitForTerminalReady();

    // Check if this is a resume (session file exists)
    const isResume = await this.isSessionActive(sessionId);

    // Build and send CLI command to terminal
    if (this.adapter) {
      let cliCommand: string;

      if (isResume && this.adapter.buildResumeSessionCommand) {
        cliCommand = this.adapter.buildResumeSessionCommand(workspacePath, sessionId);
        console.log('[AgentService] Resuming session in terminal', {
          sessionId,
          workspacePath,
        });
      } else if (this.adapter.buildStartSessionCommand) {
        cliCommand = this.adapter.buildStartSessionCommand(workspacePath, sessionId);
        console.log('[AgentService] Starting new session in terminal', {
          sessionId,
          workspacePath,
        });
      } else {
        console.warn('[AgentService] Adapter does not support CLI session commands');
        cliCommand = '';
      }

      if (cliCommand) {
        this.terminalService.write(cliCommand);
        // Set up terminal clear after Claude REPL is ready
        this.setupTerminalClearOnReady();
      }
    }

    this.isRunning = true;
    this.currentSessionId = sessionId;
    this.updateStatus('running');

    // Persist session state to main process (survives renderer refresh)
    await this.persistSessionStateToMainProcess(sessionId);
  }

  /**
   * Stop the coding agent (cancels operations)
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // Cancel all adapter operations
    if (this.adapter) {
      await this.adapter.cancelAll();
    }

    // Update status
    this.updateStatus('idle');
    this.isRunning = false;
    this.currentSessionId = null;

    // NOTE: We intentionally do NOT clear session state here.
    // The session state is cleared in onExit when the terminal process actually exits.
    // This prevents race conditions during browser refresh where stop() is called
    // but the pty process is still running in the main process.
  }

  // =============================================================================
  // Workspace
  // =============================================================================

  /**
   * Set workspace path.
   * Does NOT start generation - use sendMessage/resumeSession for that.
   */
  async setWorkspace(path: string): Promise<void> {
    console.log('[AgentService] setWorkspace() called', {
      agentId: this.agentId,
      terminalId: this.terminalService.terminalId,
      path,
      isRunning: this.isRunning,
    });

    this.workspacePathValue = path;

    // Ensure terminal is ready for display
    if (!this.terminalService.isRunning()) {
      await this.terminalService.create();
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  // =============================================================================
  // Status
  // =============================================================================

  /**
   * Get current agent status
   */
  getStatus(): CodingAgentStatusInfo | null {
    return this.currentStatus;
  }

  /**
   * Update agent status
   */
  updateStatus(
    status: CodingAgentStatus,
    context?: Partial<Omit<CodingAgentStatusInfo, 'status' | 'startedAt'>>
  ): void {
    const oldStatus = this.currentStatus;
    const newStatus: CodingAgentStatusInfo = {
      status,
      startedAt: Date.now(),
      ...context,
    };

    this.currentStatus = newStatus;

    // Notify listeners
    if (oldStatus) {
      for (const listener of this.statusListeners) {
        try {
          listener(this.agentId, oldStatus, newStatus);
        } catch (err) {
          console.error('[AgentService] Error in status listener:', err);
        }
      }
    }
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(listener: StatusChangeListener): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  // =============================================================================
  // Configuration
  // =============================================================================

  /**
   * Check if auto-start is enabled
   */
  isAutoStartEnabled(): boolean {
    return this.autoStartEnabled;
  }

  /**
   * Enable/disable auto-start
   */
  setAutoStart(enabled: boolean): void {
    this.autoStartEnabled = enabled;
  }

  // =============================================================================
  // Generation (Adapter-driven)
  // =============================================================================

  /**
   * Send a message and get response (non-streaming).
   * Creates a new session if no active session exists.
   * @throws Error if workspace not set or adapter fails
   */
  async sendMessage(prompt: string): Promise<GenerateResponse> {
    const workspacePath = this.requireWorkspace();
    const adapter = this.requireAdapter();

    this.updateStatus('running');

    try {
      const result = await adapter.generate({
        prompt,
        workingDirectory: workspacePath,
        sessionId: this.currentSessionId || undefined,
        agentId: this.agentId,
      });

      const response = this.unwrapResult(result);

      // Update session ID if returned
      if (response.sessionId) {
        this.currentSessionId = response.sessionId;
        await this.persistSessionStateToMainProcess(response.sessionId);
      }

      this.updateStatus('idle');
      return response;
    } catch (error) {
      this.updateStatus('error', {
        errorMessage: error instanceof Error ? error.message : 'Generation failed',
      });
      throw error;
    }
  }

  /**
   * Send a message with streaming (chunks emitted via callback).
   * Returns the final complete response.
   * @throws Error if workspace not set or adapter fails
   */
  async sendMessageStreaming(prompt: string, onChunk: StreamCallback): Promise<GenerateResponse> {
    const workspacePath = this.requireWorkspace();
    const adapter = this.requireAdapter();

    this.updateStatus('running');

    try {
      const result = await adapter.generateStreaming(
        {
          prompt,
          workingDirectory: workspacePath,
          sessionId: this.currentSessionId || undefined,
          agentId: this.agentId,
        },
        onChunk
      );

      const response = this.unwrapResult(result);

      // Update session ID if returned
      if (response.sessionId) {
        this.currentSessionId = response.sessionId;
        await this.persistSessionStateToMainProcess(response.sessionId);
      }

      this.updateStatus('idle');
      return response;
    } catch (error) {
      this.updateStatus('error', {
        errorMessage: error instanceof Error ? error.message : 'Generation failed',
      });
      throw error;
    }
  }

  /**
   * Resume an existing session with a new message (non-streaming).
   * @throws Error if workspace not set, session not found, or adapter fails
   */
  async resumeSession(sessionId: string, prompt: string): Promise<GenerateResponse> {
    const workspacePath = this.requireWorkspace();
    const adapter = this.requireAdapter();

    this.updateStatus('running');

    try {
      const result = await adapter.continueSession(
        { type: 'id', value: sessionId },
        prompt,
        { workingDirectory: workspacePath, agentId: this.agentId }
      );

      const response = this.unwrapResult(result);

      // Update current session
      this.currentSessionId = sessionId;
      await this.persistSessionStateToMainProcess(sessionId);

      this.updateStatus('idle');
      return response;
    } catch (error) {
      this.updateStatus('error', {
        errorMessage: error instanceof Error ? error.message : 'Resume session failed',
      });
      throw error;
    }
  }

  /**
   * Resume an existing session with streaming.
   * Returns the final complete response.
   * @throws Error if workspace not set, session not found, or adapter fails
   */
  async resumeSessionStreaming(
    sessionId: string,
    prompt: string,
    onChunk: StreamCallback
  ): Promise<GenerateResponse> {
    const workspacePath = this.requireWorkspace();
    const adapter = this.requireAdapter();

    this.updateStatus('running');

    try {
      const result = await adapter.continueSessionStreaming(
        { type: 'id', value: sessionId },
        prompt,
        onChunk,
        { workingDirectory: workspacePath, agentId: this.agentId }
      );

      const response = this.unwrapResult(result);

      // Update current session
      this.currentSessionId = sessionId;
      await this.persistSessionStateToMainProcess(sessionId);

      this.updateStatus('idle');
      return response;
    } catch (error) {
      this.updateStatus('error', {
        errorMessage: error instanceof Error ? error.message : 'Resume session failed',
      });
      throw error;
    }
  }

  // =============================================================================
  // Session Queries
  // =============================================================================

  /**
   * Get session content with optional message filtering.
   * Automatically includes workspacePath to scope session lookup for forked sessions.
   * @throws Error if adapter fails
   */
  async getSession(
    sessionId: string,
    filter?: MessageFilterOptions
  ): Promise<CodingAgentSessionContent | null> {
    const adapter = this.requireAdapter();

    // Include workspacePath in filter to scope session lookup
    // This is critical for forked sessions which share the same sessionId
    // but exist in different project directories (parent vs worktree)
    const filterWithWorkspace: MessageFilterOptions = {
      ...filter,
      workspacePath: this.workspacePathValue ?? filter?.workspacePath,
    };

    const result = await adapter.getFilteredSession(sessionId, filterWithWorkspace);
    return this.unwrapResult(result);
  }

  /**
   * Check if a session is active (file exists).
   * @throws Error if workspace not set
   */
  async isSessionActive(sessionId: string): Promise<boolean> {
    const workspacePath = this.requireWorkspace();
    const adapter = this.requireAdapter();

    return adapter.checkSessionActive(sessionId, workspacePath);
  }

  /**
   * Get the latest session for the current workspace.
   * Returns null if no sessions exist or capability not supported.
   * @throws Error if workspace not set
   */
  async getLatestSession(): Promise<SessionInfo | null> {
    const workspacePath = this.requireWorkspace();
    const adapter = this.requireAdapter();

    // Check if adapter supports this capability
    if (!adapter.getLatestSession) {
      return null;
    }

    const result = await adapter.getLatestSession(workspacePath);
    return this.unwrapResult(result);
  }

  // =============================================================================
  // Events
  // =============================================================================

  /**
   * Subscribe to typed agent events (permission requests, session events, etc.)
   * @param type - Event type to subscribe to
   * @param handler - Handler called when event occurs
   * @returns Unsubscribe function
   */
  onAgentEvent<T extends AgentAdapterEventType>(
    type: T,
    handler: AgentEventHandler<T>
  ): () => void {
    const adapter = this.requireAdapter();
    return adapter.onEvent(type, handler);
  }
}

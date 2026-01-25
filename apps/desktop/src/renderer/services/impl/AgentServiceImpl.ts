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
  AgentAdapterEventType,
  AgentError,
  AgentEventHandler,
  CodingAgentSessionContent,
  GenerateResponse,
  ICodingAgentAdapter,
  MessageFilterOptions,
  Result,
  SessionInfo,
  StreamCallback,
  StructuredStreamCallback,
} from '../../context/node-services/coding-agent-adapter';
import { permissionModeStore } from '../../stores';

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
  private isRunning = false;
  private isStarting = false; // Guard against concurrent start() calls

  constructor(
    nodeId: string,
    agentId: string,
    agentType: AgentType,
    terminalService: ITerminalService,
    adapter: ICodingAgentAdapter | null
  ) {
    this.nodeId = nodeId;
    this.agentId = agentId;
    this.agentType = agentType;
    this.terminalService = terminalService;
    this.adapter = adapter;

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

      if (state?.agentRunning) {
        console.log('[AgentService] Restoring isRunning=true from main process state', {
          agentId: this.agentId,
          terminalId: this.terminalService.terminalId,
        });
        this.isRunning = true;
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
      await window.terminalSessionAPI.setTerminalSessionState(this.terminalService.terminalId, {
        agentRunning: true,
        agentType: this.agentType,
        sessionId,
        startedAt: Date.now(),
      });
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
      await window.terminalSessionAPI.clearTerminalSessionState(this.terminalService.terminalId);
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
          this.terminalService.sendControlSequence('\x1bc'); // Full terminal reset
        }, 100);
      }
    });

    // Fallback timeout in case detection fails
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        unsubscribe();
        console.log('[AgentService] Clearing terminal (timeout fallback)');
        this.terminalService.sendControlSequence('\x1bc');
      }
    }, timeoutMs);
  }

  // =============================================================================
  // Public Lifecycle API
  // =============================================================================

  /**
   * Start the coding agent CLI REPL in the terminal.
   * @param workspacePath - Working directory for the agent
   * @param sessionId - Optional session ID for resume
   * @param initialPrompt - Optional initial prompt (currently unused - user types in terminal)
   */
  async start(workspacePath: string, sessionId?: string, _initialPrompt?: string): Promise<void> {
    console.log('[AgentService] start() called', {
      agentId: this.agentId,
      terminalId: this.terminalService.terminalId,
      isRunning: this.isRunning,
      isStarting: this.isStarting,
      workspacePath,
      sessionId,
    });

    // Guard against concurrent start() calls (React re-renders can cause multiple calls)
    if (this.isRunning || this.isStarting) {
      console.log('[AgentService] start() skipped - already running or starting', {
        agentId: this.agentId,
        isRunning: this.isRunning,
        isStarting: this.isStarting,
      });
      return;
    }

    // Set starting flag immediately to prevent concurrent calls
    this.isStarting = true;

    if (!sessionId) {
      console.error('[AgentService] start() requires sessionId');
      this.updateStatus('error', {
        errorMessage: 'Session ID is required to start the agent',
      });
      this.isStarting = false;
      return;
    }

    // Ensure terminal is created
    if (!this.terminalService.isRunning()) {
      await this.terminalService.create();
    }

    // Wait for terminal to be ready (shell initialized)
    await this.waitForTerminalReady();

    // Check if this is a resume (session file exists)
    const isResume = await this.isSessionActive(sessionId, workspacePath);

    // Build and send CLI command to terminal
    if (this.adapter) {
      // Check if REPL session is already running in the terminal
      // This can happen after a renderer refresh when main process state is restored
      const sessionState = window.terminalSessionAPI
        ? await window.terminalSessionAPI.getTerminalSessionState(this.terminalService.terminalId)
        : null;

      if (sessionState?.agentRunning && sessionState?.sessionId === sessionId) {
        console.log('[AgentService] REPL session already running, skipping start/resume command', {
          agentId: this.agentId,
          sessionId,
          terminalId: this.terminalService.terminalId,
        });
        // Session is already running, no need to send CLI command
      } else {
        let cliCommand: string;
        // Get permission mode for this agent to pass to CLI
        const permissionMode = permissionModeStore.getEffectiveMode(this.agentId);

        if (isResume && this.adapter.buildResumeSessionCommand) {
          cliCommand = this.adapter.buildResumeSessionCommand(
            workspacePath,
            sessionId,
            permissionMode
          );
          console.log('[AgentService] Resuming session in terminal', {
            sessionId,
            workspacePath,
            permissionMode,
          });
        } else if (this.adapter.buildStartSessionCommand) {
          cliCommand = this.adapter.buildStartSessionCommand(
            workspacePath,
            sessionId,
            permissionMode
          );
          console.log('[AgentService] Starting new session in terminal', {
            sessionId,
            workspacePath,
            permissionMode,
          });
        } else {
          console.warn('[AgentService] Adapter does not support CLI session commands');
          cliCommand = '';
        }

        if (cliCommand) {
          this.terminalService.executeCommand(cliCommand);
          // Set up terminal clear after Claude REPL is ready
          this.setupTerminalClearOnReady();
        }
      }
    }

    this.isRunning = true;
    this.isStarting = false; // Clear starting flag now that we're running
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

    // NOTE: We intentionally do NOT clear session state here.
    // The session state is cleared in onExit when the terminal process actually exits.
    // This prevents race conditions during browser refresh where stop() is called
    // but the pty process is still running in the main process.
  }

  /**
   * Gracefully exit the CLI REPL and wait for process to terminate.
   * Sends vendor-specific exit command via adapter and waits for terminal exit.
   * @param timeoutMs - Max time to wait for graceful exit before forcing destroy
   */
  async exitRepl(timeoutMs = 3000): Promise<void> {
    if (!this.terminalService.isRunning()) {
      return;
    }

    return new Promise<void>((resolve) => {
      let resolved = false;

      // Set up timeout in case REPL doesn't exit gracefully
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn('[AgentService] REPL exit timeout, forcing terminal destroy');
          this.terminalService.destroy().finally(resolve);
        }
      }, timeoutMs);

      // Listen for terminal exit
      const unsubscribe = this.terminalService.onExit(() => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          unsubscribe();
          console.log('[AgentService] REPL exited gracefully');
          // Terminal already exited, just update service state
          this.terminalService.destroy().finally(resolve);
        }
      });

      // Send vendor-specific exit command via adapter
      if (this.adapter) {
        const exitCommand = this.adapter.getExitCommand();
        console.log('[AgentService] Sending exit command to REPL');
        this.terminalService.executeCommand(exitCommand);
      } else {
        // No adapter - force destroy immediately
        console.warn('[AgentService] No adapter available, forcing terminal destroy');
        resolved = true;
        clearTimeout(timeout);
        unsubscribe();
        this.terminalService.destroy().finally(resolve);
      }

      // Update running state
      this.isRunning = false;
      this.updateStatus('idle');
    });
  }

  /**
   * Restart the CLI REPL session with the current permission mode from the store.
   * This is used when permission mode changes to apply the new mode.
   * Exits the current session and resumes with new CLI flags.
   * @param workspacePath - Working directory for the agent
   * @param sessionId - Session ID to resume
   */
  async restartSession(workspacePath: string, sessionId: string): Promise<void> {
    const permissionMode = permissionModeStore.getEffectiveMode(this.agentId);
    console.log('[AgentService] restartSession() called', {
      agentId: this.agentId,
      workspacePath,
      sessionId,
      isRunning: this.isRunning,
      permissionMode,
    });

    // Exit the current REPL if running
    if (this.isRunning) {
      await this.exitRepl();
      // Reset running state after exit
      this.isRunning = false;
    }

    // Explicitly clear session state in main process to ensure start() sends the CLI command
    await this.clearSessionStateInMainProcess();

    // Delay to allow terminal PTY to fully reset after REPL exit.
    // The terminal needs time to process the exit and reinitialize before accepting new commands.
    // Without this delay, the resume command may be sent before the terminal is ready.
    const TERMINAL_READY_DELAY_MS = 500;
    await new Promise((resolve) => setTimeout(resolve, TERMINAL_READY_DELAY_MS));

    // Start the session again - this will pick up the new permission mode from the store
    await this.start(workspacePath, sessionId);
  }

  /**
   * Abort all pending operations and return to idle state.
   * Cancels SDK queries and sends Ctrl+C to terminal if running.
   * This is a recovery mechanism, so it must be resilient to failures.
   */
  async abort(): Promise<void> {
    console.log('[AgentService] abort() called', {
      agentId: this.agentId,
      hasAdapter: !!this.adapter,
      terminalRunning: this.terminalService.isRunning(),
    });

    // Cancel all adapter operations (SDK queries)
    // Wrap in try/catch since abort() is a recovery mechanism
    if (this.adapter) {
      try {
        await this.adapter.cancelAll();
      } catch (error) {
        console.warn('[AgentService] Error during cancelAll:', error);
      }
    }

    // Send Ctrl+C to terminal to interrupt any running process
    if (this.terminalService.isRunning()) {
      this.terminalService.sendUserInput('\x03');
    }

    // Update status to idle
    this.updateStatus('idle');
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
  // Generation (Adapter-driven, stateless)
  // =============================================================================

  /**
   * Send a message and get response (non-streaming).
   * Creates or continues a session based on whether the session file exists.
   * @param prompt - The message to send
   * @param workspacePath - Working directory for the agent
   * @param sessionId - Session ID (required)
   * @throws Error if adapter fails
   */
  async sendMessage(
    prompt: string,
    workspacePath: string,
    sessionId: string
  ): Promise<GenerateResponse> {
    // Validate all required fields before sending request
    if (!prompt) {
      throw new Error('[AgentService] prompt is required for sendMessage');
    }
    if (!workspacePath) {
      throw new Error('[AgentService] workspacePath is required for sendMessage');
    }
    if (!sessionId) {
      throw new Error('[AgentService] sessionId is required for sendMessage');
    }
    if (!this.agentId) {
      throw new Error('[AgentService] agentId is not set - service not properly initialized');
    }

    const adapter = this.requireAdapter();

    this.updateStatus('running');

    try {
      const result = await adapter.generate({
        prompt,
        workingDirectory: workspacePath,
        sessionId,
        agentId: this.agentId,
      });

      const response = this.unwrapResult(result);

      await this.persistSessionStateToMainProcess(sessionId);

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
   * Creates or continues a session based on whether the session file exists.
   * @param prompt - The message to send
   * @param workspacePath - Working directory for the agent
   * @param sessionId - Session ID (required)
   * @param onChunk - Callback for streaming chunks
   * @throws Error if adapter fails
   */
  async sendMessageStreaming(
    prompt: string,
    workspacePath: string,
    sessionId: string,
    onChunk: StreamCallback
  ): Promise<GenerateResponse> {
    // Validate all required fields before sending request
    if (!prompt) {
      throw new Error('[AgentService] prompt is required for sendMessageStreaming');
    }
    if (!workspacePath) {
      throw new Error('[AgentService] workspacePath is required for sendMessageStreaming');
    }
    if (!sessionId) {
      throw new Error('[AgentService] sessionId is required for sendMessageStreaming');
    }
    if (!this.agentId) {
      throw new Error('[AgentService] agentId is not set - service not properly initialized');
    }

    const adapter = this.requireAdapter();

    this.updateStatus('running');

    try {
      const result = await adapter.generateStreaming(
        {
          prompt,
          workingDirectory: workspacePath,
          sessionId,
          agentId: this.agentId,
        },
        onChunk
      );

      const response = this.unwrapResult(result);

      await this.persistSessionStateToMainProcess(sessionId);

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
   * Send a message with structured streaming (content blocks).
   * Streams thinking, tool_use, and text blocks as they arrive.
   * Creates or continues a session based on whether the session file exists.
   * @param prompt - The message to send
   * @param workspacePath - Working directory for the agent
   * @param sessionId - Session ID (required)
   * @param onChunk - Callback for structured streaming chunks
   * @throws Error if adapter fails or structured streaming not supported
   */
  async sendMessageStreamingStructured(
    prompt: string,
    workspacePath: string,
    sessionId: string,
    onChunk: StructuredStreamCallback
  ): Promise<GenerateResponse> {
    // Validate all required fields before sending request
    if (!prompt) {
      throw new Error('[AgentService] prompt is required for sendMessageStreamingStructured');
    }
    if (!workspacePath) {
      throw new Error(
        '[AgentService] workspacePath is required for sendMessageStreamingStructured'
      );
    }
    if (!sessionId) {
      throw new Error('[AgentService] sessionId is required for sendMessageStreamingStructured');
    }
    if (!this.agentId) {
      throw new Error('[AgentService] agentId is not set - service not properly initialized');
    }

    const adapter = this.requireAdapter();

    // Check if adapter supports structured streaming
    if (!adapter.generateStreamingStructured) {
      throw new Error('Adapter does not support structured streaming');
    }

    this.updateStatus('running');

    // Get permission mode for this agent to pass to SDK
    const permissionMode = permissionModeStore.getEffectiveMode(this.agentId);
    console.log('[AgentService] sendMessageStreamingStructured with permission mode', {
      agentId: this.agentId,
      sessionId,
      permissionMode,
    });

    try {
      const result = await adapter.generateStreamingStructured(
        {
          prompt,
          workingDirectory: workspacePath,
          sessionId,
          agentId: this.agentId,
          permissionMode,
        },
        onChunk
      );

      const response = this.unwrapResult(result);

      await this.persistSessionStateToMainProcess(sessionId);

      this.updateStatus('idle');
      return response;
    } catch (error) {
      this.updateStatus('error', {
        errorMessage: error instanceof Error ? error.message : 'Generation failed',
      });
      throw error;
    }
  }

  // =============================================================================
  // Session Queries (stateless)
  // =============================================================================

  /**
   * Get session content with optional message filtering.
   * @param sessionId - Session ID to retrieve
   * @param workspacePath - Working directory to scope session lookup
   * @param filter - Optional message filter options
   * @throws Error if adapter fails
   */
  async getSession(
    sessionId: string,
    workspacePath: string,
    filter?: MessageFilterOptions
  ): Promise<CodingAgentSessionContent | null> {
    const adapter = this.requireAdapter();

    // Include workspacePath in filter to scope session lookup
    // This is critical for forked sessions which share the same sessionId
    // but exist in different project directories (parent vs worktree)
    const filterWithWorkspace: MessageFilterOptions = {
      ...filter,
      workspacePath,
    };

    // Debug logging to trace workspace path being used
    console.log('[AgentServiceImpl] getSession called', {
      sessionId,
      workspacePath,
      filter,
    });

    const result = await adapter.getSession(sessionId, filterWithWorkspace);
    return this.unwrapResult(result);
  }

  /**
   * Check if a session file exists on disk.
   * @param sessionId - Session ID to check
   * @param workspacePath - Working directory to scope session lookup
   */
  async isSessionActive(sessionId: string, workspacePath: string): Promise<boolean> {
    const adapter = this.requireAdapter();
    return adapter.sessionFileExists(sessionId, workspacePath);
  }

  /**
   * Get the latest session for a workspace.
   * Returns null if no sessions exist or capability not supported.
   * @param workspacePath - Working directory to scope session lookup
   */
  async getLatestSession(workspacePath: string): Promise<SessionInfo | null> {
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

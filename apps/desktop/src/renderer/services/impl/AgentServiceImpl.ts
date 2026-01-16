/**
 * AgentServiceImpl
 *
 * Implementation of IAgentService that manages coding agent CLI lifecycle.
 * Orchestrates terminal service to start/stop the agent binary.
 */

import type {
  AgentType,
  CodingAgentStatus,
  CodingAgentStatusInfo,
  StatusChangeListener,
} from '../../../../types/coding-agent-status';
import type { IAgentService, ITerminalService } from '../../context/node-services';

/**
 * CLI command mapping for different agent types
 */
const CLI_COMMANDS: Record<AgentType, string> = {
  claude_code: 'claude',
  cursor: 'cursor',
  codex: 'codex',
  windsurf: 'windsurf',
  vscode: 'code',
  factory: 'factory',
  other: '',
};

/**
 * Agent service implementation
 */
export class AgentServiceImpl implements IAgentService {
  readonly nodeId: string;
  readonly agentId: string;
  readonly agentType: AgentType;

  private terminalService: ITerminalService;
  private statusListeners: Set<StatusChangeListener> = new Set();
  private currentStatus: CodingAgentStatusInfo | null = null;
  private autoStartEnabled = false;
  private isStarted = false;
  private workspacePathValue: string | null = null;

  constructor(
    nodeId: string,
    agentId: string,
    agentType: AgentType,
    terminalService: ITerminalService,
    workspacePath?: string
  ) {
    this.nodeId = nodeId;
    this.agentId = agentId;
    this.agentType = agentType;
    this.terminalService = terminalService;
    this.workspacePathValue = workspacePath || null;

    // Initialize status
    this.currentStatus = {
      status: 'idle',
      startedAt: Date.now(),
    };
  }

  // =============================================================================
  // Getters
  // =============================================================================

  /** Get the current workspace path */
  get workspacePath(): string | null {
    return this.workspacePathValue;
  }

  // =============================================================================
  // Centralized Terminal Operations
  // =============================================================================

  /**
   * Write to shell (only when CLI is NOT running).
   * Guards against accidentally piping shell commands into the REPL.
   */
  private writeToShell(data: string): void {
    if (this.isStarted) {
      console.warn('[AgentService] writeToShell() blocked - CLI is running, cannot write shell commands', {
        agentId: this.agentId,
        terminalId: this.terminalService.terminalId,
        data: data.length > 100 ? data.substring(0, 100) + '...' : data,
      });
      return;
    }

    console.log('[AgentService] writeToShell()', {
      agentId: this.agentId,
      terminalId: this.terminalService.terminalId,
      dataLength: data.length,
      data: data.length > 100 ? data.substring(0, 100) + '...' : data,
    });
    this.terminalService.write(data);
  }

  /**
   * Write to CLI REPL (only when CLI IS running).
   * Use this for sending prompts or Ctrl+C to the running agent.
   */
  private writeToCli(data: string): void {
    if (!this.isStarted) {
      console.warn('[AgentService] writeToCli() blocked - CLI is not running', {
        agentId: this.agentId,
        terminalId: this.terminalService.terminalId,
        data: data.length > 100 ? data.substring(0, 100) + '...' : data,
      });
      return;
    }

    console.log('[AgentService] writeToCli()', {
      agentId: this.agentId,
      terminalId: this.terminalService.terminalId,
      dataLength: data.length,
      data: data.length > 100 ? data.substring(0, 100) + '...' : data,
    });
    this.terminalService.write(data);
  }

  /**
   * Ensure terminal is created and ready for input
   */
  private async ensureTerminalReady(): Promise<void> {
    if (!this.terminalService.isRunning()) {
      await this.terminalService.create();
      // Wait for shell to initialize
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  /**
   * Start the CLI process (single entry point for CLI startup)
   * This is the ONLY place that writes the CLI command to terminal.
   */
  private async startCli(options: {
    sessionId?: string;
    initialPrompt?: string;
    customCommand?: string;
  }): Promise<void> {
    const { sessionId, initialPrompt, customCommand } = options;

    // ALWAYS check main process as source of truth (not renderer-side isStarted)
    // This handles React StrictMode double-mount where dispose() may reset isStarted
    if (window.terminalSessionAPI) {
      const state = await window.terminalSessionAPI.getTerminalSessionState(
        this.terminalService.terminalId
      );
      if (state?.agentRunning) {
        console.log('[AgentService] startCli() skipped - main process says agent is running', {
          agentId: this.agentId,
          terminalId: this.terminalService.terminalId,
          state,
        });
        this.isStarted = true; // Sync local state with main process
        this.updateStatus('running');
        return;
      }
    }

    // Fallback to local state check (for when main process API unavailable)
    if (this.isStarted) {
      console.log('[AgentService] startCli() skipped - already started (local state)', {
        agentId: this.agentId,
      });
      return;
    }

    const cliCommand = customCommand || this.getCliCommand();
    if (!cliCommand) {
      throw new Error(`No CLI command configured for agent type: ${this.agentType}`);
    }

    const startCommand = customCommand
      ? cliCommand
      : this.buildCliStartCommand(cliCommand, { sessionId, initialPrompt });

    console.log('[AgentService] startCli() - writing CLI command', {
      agentId: this.agentId,
      terminalId: this.terminalService.terminalId,
      startCommand,
    });

    // Write to shell (not CLI) - we're starting the CLI
    this.writeToShell(`${startCommand}\n`);
    this.isStarted = true;
    this.updateStatus('running');

    // Persist session state to main process (survives renderer refresh)
    await this.persistSessionStateToMainProcess(sessionId);
  }

  // =============================================================================
  // Public API
  // =============================================================================

  /**
   * Set workspace path and navigate terminal to it.
   * Does NOT start the CLI - use start() for that.
   * IMPORTANT: Must be called BEFORE start() - cannot change workspace while CLI is running.
   */
  async setWorkspace(path: string): Promise<void> {
    console.log('[AgentService] setWorkspace() called', {
      agentId: this.agentId,
      terminalId: this.terminalService.terminalId,
      path,
      isStarted: this.isStarted,
    });

    // Check main process as source of truth (handles React StrictMode race conditions)
    if (window.terminalSessionAPI) {
      const state = await window.terminalSessionAPI.getTerminalSessionState(
        this.terminalService.terminalId
      );
      if (state?.agentRunning) {
        console.warn('[AgentService] setWorkspace() skipped - CLI is running per main process. Stop the CLI first to change workspace.');
        this.isStarted = true; // Sync local state
        return;
      }
    }

    // Fallback to local state check
    if (this.isStarted) {
      console.warn('[AgentService] setWorkspace() skipped - CLI is already running (local state). Stop the CLI first to change workspace.');
      return;
    }

    this.workspacePathValue = path;

    // Ensure terminal is ready
    await this.ensureTerminalReady();

    // Navigate to workspace (shell command, not CLI)
    this.writeToShell(`cd "${path}"\n`);
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    console.log('[AgentService] initialize() START', {
      agentId: this.agentId,
      terminalId: this.terminalService.terminalId,
    });

    // Check main process for existing session state (survives renderer refresh)
    await this.restoreSessionStateFromMainProcess();

    console.log('[AgentService] initialize() AFTER restore, isStarted=', this.isStarted, {
      agentId: this.agentId,
      terminalId: this.terminalService.terminalId,
    });

    // Listen to terminal exit to update status
    this.terminalService.onExit((code) => {
      if (this.isStarted) {
        this.isStarted = false;
        this.updateStatus(code === 0 ? 'completed' : 'error', {
          errorMessage: code !== 0 ? `Process exited with code ${code}` : undefined,
        });
        // Clear session state in main process
        this.clearSessionStateInMainProcess();
      }
    });
  }

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
        console.log('[AgentService] ✅ Restoring isStarted=true from main process state', {
          agentId: this.agentId,
          terminalId: this.terminalService.terminalId,
        });
        this.isStarted = true;
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

  /**
   * Start the coding agent CLI in the terminal.
   * Call setWorkspace() first if you need to navigate to a directory.
   */
  async start(command?: string, sessionId?: string, initialPrompt?: string): Promise<void> {
    console.log('[AgentService] start() called', {
      agentId: this.agentId,
      terminalId: this.terminalService.terminalId,
      isStarted: this.isStarted,
      command,
      sessionId,
      hasInitialPrompt: !!initialPrompt,
    });

    // Ensure terminal is ready
    await this.ensureTerminalReady();

    // Delegate to centralized startCli
    await this.startCli({ sessionId, initialPrompt, customCommand: command });
  }

  /**
   * Stop the coding agent
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    // Send Ctrl+C to interrupt the CLI
    this.writeToCli('\x03');

    // Update status
    this.updateStatus('idle');
    this.isStarted = false;

    // NOTE: We intentionally do NOT clear session state here.
    // The session state is cleared in onExit when the terminal process actually exits.
    // This prevents race conditions during browser refresh where stop() is called
    // but the pty process is still running in the main process.
  }

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

  /**
   * Check if CLI auto-start is enabled
   */
  isAutoStartEnabled(): boolean {
    return this.autoStartEnabled;
  }

  /**
   * Enable/disable CLI auto-start
   */
  setAutoStart(enabled: boolean): void {
    this.autoStartEnabled = enabled;
  }

  /**
   * Get CLI command for this agent type
   */
  getCliCommand(): string {
    return CLI_COMMANDS[this.agentType] || '';
  }

  private buildCliStartCommand(
    cliCommand: string,
    options: { sessionId?: string; initialPrompt?: string }
  ): string {
    const { sessionId } = options;

    if (this.agentType !== 'claude_code' || !sessionId) {
      return this.buildCliCommand(cliCommand, options);
    }

    const sessionIdCommand = this.buildCliCommand(cliCommand, options, 'session-id');
    const resumeCommand = this.buildCliCommand(cliCommand, options, 'resume');
    const logMessage = this.formatShellValue(
      `[AgentService] Failed to create session ${sessionId}. Falling back to --resume.`
    );

    return `${sessionIdCommand} || (echo ${logMessage} >&2; ${resumeCommand})`;
  }

  private buildCliCommand(
    cliCommand: string,
    options: { sessionId?: string; initialPrompt?: string },
    sessionMode: 'session-id' | 'resume' = 'session-id'
  ): string {
    const { sessionId, initialPrompt } = options;
    const args: string[] = [];

    if (this.agentType === 'claude_code' && sessionId) {
      const flag = sessionMode === 'resume' ? '--resume' : '--session-id';
      args.push(`${flag} ${this.formatShellValue(sessionId)}`);
    }

    if (initialPrompt) {
      const promptValue = this.formatShellValue(initialPrompt);
      return `echo ${promptValue} | ${cliCommand}${args.length > 0 ? ` ${args.join(' ')}` : ''} -p`;
    }

    return `${cliCommand}${args.length > 0 ? ` ${args.join(' ')}` : ''}`;
  }

  private formatShellValue(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`;
  }

  /**
   * Dispose the service
   */
  async dispose(): Promise<void> {
    // Stop agent if running
    if (this.isStarted) {
      await this.stop();
    }

    // Clear listeners
    this.statusListeners.clear();
    this.currentStatus = null;
  }
}

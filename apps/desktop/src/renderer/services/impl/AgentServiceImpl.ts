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
  private workspacePath: string | null = null;

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
    this.workspacePath = workspacePath || null;

    // Initialize status
    this.currentStatus = {
      status: 'idle',
      startedAt: Date.now(),
    };
  }

  /**
   * Set workspace and navigate terminal to it.
   * If autoStartCli is true, also starts the CLI after navigation.
   * If initialPrompt is provided, it will be sent to the agent after CLI starts.
   */
  async setWorkspace(
    path: string,
    autoStartCli?: boolean,
    initialPrompt?: string,
    sessionId?: string
  ): Promise<void> {
    this.workspacePath = path;

    // Ensure terminal is created and running
    if (!this.terminalService.isRunning()) {
      await this.terminalService.create();
      // Wait for shell to initialize
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Navigate to workspace
    this.terminalService.write(`cd "${path}"\n`);

    // Start CLI if requested and not already started
    if (autoStartCli && !this.isStarted) {
      // Wait for cd to complete
      await new Promise((resolve) => setTimeout(resolve, 200));
      const cliCommand = this.getCliCommand();
      if (cliCommand) {
        const startCommand = this.buildCliStartCommand(cliCommand, {
          sessionId,
          initialPrompt,
        });
        this.terminalService.write(`${startCommand}\n`);
        this.isStarted = true;
        this.updateStatus('running');
      }
    }
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    // Listen to terminal exit to update status
    this.terminalService.onExit((code) => {
      if (this.isStarted) {
        this.isStarted = false;
        this.updateStatus(code === 0 ? 'completed' : 'error', {
          errorMessage: code !== 0 ? `Process exited with code ${code}` : undefined,
        });
      }
    });
  }

  /**
   * Start the coding agent CLI in the terminal
   */
  async start(command?: string, sessionId?: string, initialPrompt?: string): Promise<void> {
    if (this.isStarted) {
      return;
    }

    // Ensure terminal is created
    if (!this.terminalService.isRunning()) {
      await this.terminalService.create();
      // Small delay for shell to initialize
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Get CLI command
    const cliCommand = command || this.getCliCommand();
    if (!cliCommand) {
      throw new Error(`No CLI command configured for agent type: ${this.agentType}`);
    }

    // Update status
    this.updateStatus('running');

    const startCommand = command
      ? cliCommand
      : this.buildCliStartCommand(cliCommand, { sessionId, initialPrompt });

    // Change to workspace directory if set
    if (this.workspacePath) {
      this.terminalService.write(`cd "${this.workspacePath}" && ${startCommand}\n`);
    } else {
      this.terminalService.write(`${startCommand}\n`);
    }
    this.isStarted = true;
  }

  /**
   * Stop the coding agent
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    // Send Ctrl+C to interrupt
    this.terminalService.write('\x03');

    // Update status
    this.updateStatus('idle');
    this.isStarted = false;
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
    return this.buildCliCommand(cliCommand, options);
  }

  private buildCliCommand(
    cliCommand: string,
    options: { sessionId?: string; initialPrompt?: string }
  ): string {
    const { sessionId, initialPrompt } = options;
    const args: string[] = [];

    if (this.agentType === 'claude_code' && sessionId) {
      args.push(`--session-id ${this.formatShellValue(sessionId)}`);
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

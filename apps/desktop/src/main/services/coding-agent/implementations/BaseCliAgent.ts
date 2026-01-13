import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import type { IProcessLifecycle } from '../interfaces';
import type {
  Result,
  AgentError,
  AgentConfig,
  AgentCapabilities,
  CodingAgentType,
  GenerateResponse,
} from '../types';
import { AgentErrorCode, ok, err, agentError } from '../types';

/**
 * Managed process handle
 */
interface ProcessHandle {
  id: string;
  process: ChildProcess;
  startTime: number;
}

/**
 * Options for spawning a process
 */
interface SpawnOptions {
  workingDirectory?: string;
  timeout?: number;
}

/**
 * Abstract base class for CLI-based coding agents
 *
 * Provides common process management functionality:
 * - Process spawning and tracking
 * - Timeout handling
 * - Output collection (buffered and streaming)
 * - Resource cleanup
 *
 * Subclasses must implement:
 * - agentType: The agent type identifier
 * - getCapabilities(): Available capabilities
 * - getExecutablePath(): Path to CLI executable
 * - buildGenerateArgs(): CLI arguments for generation
 * - parseOutput(): Parse CLI output to response
 */
export abstract class BaseCliAgent extends EventEmitter implements IProcessLifecycle {
  protected readonly config: AgentConfig;
  private readonly activeProcesses = new Map<string, ProcessHandle>();
  private isInitialized = false;

  constructor(config: AgentConfig) {
    super();
    this.config = config;
  }

  /**
   * The type of coding agent
   */
  abstract get agentType(): CodingAgentType;

  /**
   * Get the agent's capabilities
   */
  abstract getCapabilities(): AgentCapabilities;

  /**
   * Get the path to the CLI executable
   */
  protected abstract getExecutablePath(): string;

  /**
   * Verify the executable is available
   */
  protected abstract verifyExecutable(): Promise<boolean>;

  /**
   * Parse CLI output into a response
   */
  protected abstract parseOutput(output: string): GenerateResponse;

  /**
   * Initialize the agent
   */
  async initialize(): Promise<Result<void, AgentError>> {
    if (this.isInitialized) {
      return ok(undefined);
    }

    const available = await this.isAvailable();
    if (!available) {
      return err(
        agentError(
          AgentErrorCode.AGENT_NOT_AVAILABLE,
          `${this.agentType} CLI not found or not accessible at: ${this.getExecutablePath()}`
        )
      );
    }

    this.isInitialized = true;
    return ok(undefined);
  }

  /**
   * Check if the agent CLI is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      return await this.verifyExecutable();
    } catch {
      return false;
    }
  }

  /**
   * Cancel all running operations
   */
  async cancelAll(): Promise<void> {
    const entries = Array.from(this.activeProcesses.entries());
    for (const [id, handle] of entries) {
      handle.process.kill('SIGTERM');
      this.activeProcesses.delete(id);
    }
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    await this.cancelAll();
    this.isInitialized = false;
    this.removeAllListeners();
  }

  /**
   * Spawn a CLI process
   */
  protected spawnProcess(
    args: string[],
    options?: SpawnOptions
  ): Result<ProcessHandle, AgentError> {
    const processId = crypto.randomUUID();

    try {
      const proc = spawn(this.getExecutablePath(), args, {
        cwd: options?.workingDirectory ?? this.config.workingDirectory,
        env: { ...process.env, ...this.config.environment },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
      });

      const handle: ProcessHandle = {
        id: processId,
        process: proc,
        startTime: Date.now(),
      };

      this.activeProcesses.set(processId, handle);

      // Cleanup on process exit
      proc.on('close', () => {
        this.activeProcesses.delete(processId);
      });

      return ok(handle);
    } catch (error) {
      return err(
        agentError(
          AgentErrorCode.PROCESS_SPAWN_FAILED,
          `Failed to spawn ${this.agentType} process`,
          { args },
          error instanceof Error ? error : undefined
        )
      );
    }
  }

  /**
   * Collect output from a process (buffered)
   */
  protected collectOutput(
    handle: ProcessHandle,
    timeout?: number
  ): Promise<Result<GenerateResponse, AgentError>> {
    return new Promise((resolve) => {
      const chunks: string[] = [];
      let stderr = '';
      let resolved = false;

      const effectiveTimeout = timeout ?? this.config.timeout ?? 120_000;

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          handle.process.kill('SIGKILL');
          this.activeProcesses.delete(handle.id);
          resolve(
            err(
              agentError(AgentErrorCode.PROCESS_TIMEOUT, `Process timed out after ${effectiveTimeout}ms`)
            )
          );
        }
      }, effectiveTimeout);

      handle.process.stdout?.on('data', (data: Buffer) => {
        chunks.push(data.toString());
      });

      handle.process.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      handle.process.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          this.activeProcesses.delete(handle.id);
          resolve(
            err(
              agentError(
                AgentErrorCode.PROCESS_SPAWN_FAILED,
                error.message,
                undefined,
                error
              )
            )
          );
        }
      });

      handle.process.on('close', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          this.activeProcesses.delete(handle.id);

          if (code === 0) {
            try {
              const response = this.parseOutput(chunks.join(''));
              resolve(ok(response));
            } catch (parseError) {
              resolve(
                err(
                  agentError(
                    AgentErrorCode.PROCESS_OUTPUT_PARSE_ERROR,
                    'Failed to parse CLI output',
                    { output: chunks.join('').slice(0, 500) },
                    parseError instanceof Error ? parseError : undefined
                  )
                )
              );
            }
          } else {
            resolve(
              err(
                agentError(
                  AgentErrorCode.PROCESS_SPAWN_FAILED,
                  stderr || `Process exited with code ${code}`,
                  { exitCode: code }
                )
              )
            );
          }
        }
      });
    });
  }

  /**
   * Stream output from a process
   */
  protected streamOutput(
    handle: ProcessHandle,
    onChunk: (chunk: string) => void,
    timeout?: number
  ): Promise<Result<GenerateResponse, AgentError>> {
    return new Promise((resolve) => {
      const allChunks: string[] = [];
      let stderr = '';
      let resolved = false;

      const effectiveTimeout = timeout ?? this.config.timeout ?? 120_000;

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          handle.process.kill('SIGKILL');
          this.activeProcesses.delete(handle.id);
          resolve(
            err(
              agentError(AgentErrorCode.PROCESS_TIMEOUT, `Process timed out after ${effectiveTimeout}ms`)
            )
          );
        }
      }, effectiveTimeout);

      handle.process.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        allChunks.push(chunk);
        onChunk(chunk);
      });

      handle.process.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      handle.process.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          this.activeProcesses.delete(handle.id);
          resolve(
            err(
              agentError(
                AgentErrorCode.PROCESS_SPAWN_FAILED,
                error.message,
                undefined,
                error
              )
            )
          );
        }
      });

      handle.process.on('close', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          this.activeProcesses.delete(handle.id);

          if (code === 0) {
            try {
              const response = this.parseOutput(allChunks.join(''));
              resolve(ok(response));
            } catch (parseError) {
              resolve(
                err(
                  agentError(
                    AgentErrorCode.PROCESS_OUTPUT_PARSE_ERROR,
                    'Failed to parse CLI output',
                    { output: allChunks.join('').slice(0, 500) },
                    parseError instanceof Error ? parseError : undefined
                  )
                )
              );
            }
          } else {
            resolve(
              err(
                agentError(
                  AgentErrorCode.PROCESS_SPAWN_FAILED,
                  stderr || `Process exited with code ${code}`,
                  { exitCode: code }
                )
              )
            );
          }
        }
      });
    });
  }

  /**
   * Check if the agent is initialized
   */
  protected ensureInitialized(): Result<void, AgentError> {
    if (!this.isInitialized) {
      return err(
        agentError(
          AgentErrorCode.AGENT_NOT_INITIALIZED,
          `${this.agentType} agent not initialized. Call initialize() first.`
        )
      );
    }
    return ok(undefined);
  }
}

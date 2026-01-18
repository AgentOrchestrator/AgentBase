import { type ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type { IProcessLifecycle } from '../interfaces';
import type {
  AgentCapabilities,
  AgentConfig,
  AgentError,
  CodingAgentType,
  GenerateResponse,
  Result,
} from '../types';
import { AgentErrorCode, agentError, err, ok } from '../types';

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
  /** Input to write to stdin (will be written and stdin closed immediately) */
  stdinInput?: string;
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
    const executable = this.getExecutablePath();
    const cwd = options?.workingDirectory;

    console.log(`[${this.agentType}] Spawning process`, {
      processId,
      executable,
      args,
      cwd,
    });

    try {
      const proc = spawn(executable, args, {
        cwd,
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

      console.log(`[${this.agentType}] Process spawned successfully`, {
        processId,
        pid: proc.pid,
      });

      // Cleanup on process exit
      proc.on('close', (code) => {
        const duration = Date.now() - handle.startTime;
        console.log(`[${this.agentType}] Process closed`, {
          processId,
          pid: proc.pid,
          exitCode: code,
          durationMs: duration,
        });
        this.activeProcesses.delete(processId);
      });

      // Write to stdin if input provided, then close stdin
      if (options?.stdinInput !== undefined) {
        proc.stdin?.write(options.stdinInput);
        proc.stdin?.end();
      }

      return ok(handle);
    } catch (error) {
      console.error(`[${this.agentType}] Failed to spawn process`, {
        processId,
        executable,
        args,
        error: error instanceof Error ? error.message : String(error),
      });
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
              agentError(
                AgentErrorCode.PROCESS_TIMEOUT,
                `Process timed out after ${effectiveTimeout}ms`
              )
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
            err(agentError(AgentErrorCode.PROCESS_SPAWN_FAILED, error.message, undefined, error))
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
      let chunkCount = 0;
      let totalBytes = 0;

      const effectiveTimeout = timeout ?? this.config.timeout ?? 120_000;

      console.log(`[${this.agentType}] Starting stream output collection`, {
        processId: handle.id,
        pid: handle.process.pid,
        timeoutMs: effectiveTimeout,
      });

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn(`[${this.agentType}] Process timeout`, {
            processId: handle.id,
            pid: handle.process.pid,
            timeoutMs: effectiveTimeout,
            chunksReceived: chunkCount,
            bytesReceived: totalBytes,
            stderrPreview: stderr.slice(0, 500),
          });
          handle.process.kill('SIGKILL');
          this.activeProcesses.delete(handle.id);
          resolve(
            err(
              agentError(
                AgentErrorCode.PROCESS_TIMEOUT,
                `Process timed out after ${effectiveTimeout}ms`
              )
            )
          );
        }
      }, effectiveTimeout);

      handle.process.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        allChunks.push(chunk);
        chunkCount++;
        totalBytes += data.length;

        if (chunkCount === 1) {
          console.log(`[${this.agentType}] First stdout chunk received`, {
            processId: handle.id,
            chunkLength: chunk.length,
            chunkPreview: chunk.slice(0, 100),
          });
        } else if (chunkCount % 10 === 0) {
          console.log(`[${this.agentType}] Streaming progress`, {
            processId: handle.id,
            chunkCount,
            totalBytes,
          });
        }

        onChunk(chunk);
      });

      handle.process.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        console.log(`[${this.agentType}] stderr received`, {
          processId: handle.id,
          chunkLength: chunk.length,
          stderrPreview: chunk.slice(0, 200),
        });
      });

      handle.process.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          console.error(`[${this.agentType}] Process error`, {
            processId: handle.id,
            error: error.message,
            stack: error.stack,
          });
          this.activeProcesses.delete(handle.id);
          resolve(
            err(agentError(AgentErrorCode.PROCESS_SPAWN_FAILED, error.message, undefined, error))
          );
        }
      });

      handle.process.on('close', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          this.activeProcesses.delete(handle.id);

          const duration = Date.now() - handle.startTime;
          console.log(`[${this.agentType}] Stream output complete`, {
            processId: handle.id,
            exitCode: code,
            durationMs: duration,
            totalChunks: chunkCount,
            totalBytes,
            hasStderr: stderr.length > 0,
          });

          if (code === 0) {
            try {
              const response = this.parseOutput(allChunks.join(''));
              console.log(`[${this.agentType}] Output parsed successfully`, {
                processId: handle.id,
                responseLength: response.content.length,
              });
              resolve(ok(response));
            } catch (parseError) {
              console.error(`[${this.agentType}] Failed to parse output`, {
                processId: handle.id,
                error: parseError instanceof Error ? parseError.message : String(parseError),
                outputPreview: allChunks.join('').slice(0, 500),
              });
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
            console.error(`[${this.agentType}] Process exited with error`, {
              processId: handle.id,
              exitCode: code,
              stderr: stderr.slice(0, 1000),
            });
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

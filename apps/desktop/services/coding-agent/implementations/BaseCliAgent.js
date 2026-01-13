"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseCliAgent = void 0;
const child_process_1 = require("child_process");
const events_1 = require("events");
const types_1 = require("../types");
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
class BaseCliAgent extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.activeProcesses = new Map();
        this.isInitialized = false;
        this.config = config;
    }
    /**
     * Initialize the agent
     */
    async initialize() {
        if (this.isInitialized) {
            return (0, types_1.ok)(undefined);
        }
        const available = await this.isAvailable();
        if (!available) {
            return (0, types_1.err)((0, types_1.agentError)(types_1.AgentErrorCode.AGENT_NOT_AVAILABLE, `${this.agentType} CLI not found or not accessible at: ${this.getExecutablePath()}`));
        }
        this.isInitialized = true;
        return (0, types_1.ok)(undefined);
    }
    /**
     * Check if the agent CLI is available
     */
    async isAvailable() {
        try {
            return await this.verifyExecutable();
        }
        catch {
            return false;
        }
    }
    /**
     * Cancel all running operations
     */
    async cancelAll() {
        const entries = Array.from(this.activeProcesses.entries());
        for (const [id, handle] of entries) {
            handle.process.kill('SIGTERM');
            this.activeProcesses.delete(id);
        }
    }
    /**
     * Dispose of resources
     */
    async dispose() {
        await this.cancelAll();
        this.isInitialized = false;
        this.removeAllListeners();
    }
    /**
     * Spawn a CLI process
     */
    spawnProcess(args, options) {
        const processId = crypto.randomUUID();
        try {
            const proc = (0, child_process_1.spawn)(this.getExecutablePath(), args, {
                cwd: options?.workingDirectory ?? this.config.workingDirectory,
                env: { ...process.env, ...this.config.environment },
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: false,
            });
            const handle = {
                id: processId,
                process: proc,
                startTime: Date.now(),
            };
            this.activeProcesses.set(processId, handle);
            // Cleanup on process exit
            proc.on('close', () => {
                this.activeProcesses.delete(processId);
            });
            return (0, types_1.ok)(handle);
        }
        catch (error) {
            return (0, types_1.err)((0, types_1.agentError)(types_1.AgentErrorCode.PROCESS_SPAWN_FAILED, `Failed to spawn ${this.agentType} process`, { args }, error instanceof Error ? error : undefined));
        }
    }
    /**
     * Collect output from a process (buffered)
     */
    collectOutput(handle, timeout) {
        return new Promise((resolve) => {
            const chunks = [];
            let stderr = '';
            let resolved = false;
            const effectiveTimeout = timeout ?? this.config.timeout ?? 120000;
            const timeoutId = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    handle.process.kill('SIGKILL');
                    this.activeProcesses.delete(handle.id);
                    resolve((0, types_1.err)((0, types_1.agentError)(types_1.AgentErrorCode.PROCESS_TIMEOUT, `Process timed out after ${effectiveTimeout}ms`)));
                }
            }, effectiveTimeout);
            handle.process.stdout?.on('data', (data) => {
                chunks.push(data.toString());
            });
            handle.process.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            handle.process.on('error', (error) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeoutId);
                    this.activeProcesses.delete(handle.id);
                    resolve((0, types_1.err)((0, types_1.agentError)(types_1.AgentErrorCode.PROCESS_SPAWN_FAILED, error.message, undefined, error)));
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
                            resolve((0, types_1.ok)(response));
                        }
                        catch (parseError) {
                            resolve((0, types_1.err)((0, types_1.agentError)(types_1.AgentErrorCode.PROCESS_OUTPUT_PARSE_ERROR, 'Failed to parse CLI output', { output: chunks.join('').slice(0, 500) }, parseError instanceof Error ? parseError : undefined)));
                        }
                    }
                    else {
                        resolve((0, types_1.err)((0, types_1.agentError)(types_1.AgentErrorCode.PROCESS_SPAWN_FAILED, stderr || `Process exited with code ${code}`, { exitCode: code })));
                    }
                }
            });
        });
    }
    /**
     * Stream output from a process
     */
    streamOutput(handle, onChunk, timeout) {
        return new Promise((resolve) => {
            const allChunks = [];
            let stderr = '';
            let resolved = false;
            const effectiveTimeout = timeout ?? this.config.timeout ?? 120000;
            const timeoutId = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    handle.process.kill('SIGKILL');
                    this.activeProcesses.delete(handle.id);
                    resolve((0, types_1.err)((0, types_1.agentError)(types_1.AgentErrorCode.PROCESS_TIMEOUT, `Process timed out after ${effectiveTimeout}ms`)));
                }
            }, effectiveTimeout);
            handle.process.stdout?.on('data', (data) => {
                const chunk = data.toString();
                allChunks.push(chunk);
                onChunk(chunk);
            });
            handle.process.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            handle.process.on('error', (error) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeoutId);
                    this.activeProcesses.delete(handle.id);
                    resolve((0, types_1.err)((0, types_1.agentError)(types_1.AgentErrorCode.PROCESS_SPAWN_FAILED, error.message, undefined, error)));
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
                            resolve((0, types_1.ok)(response));
                        }
                        catch (parseError) {
                            resolve((0, types_1.err)((0, types_1.agentError)(types_1.AgentErrorCode.PROCESS_OUTPUT_PARSE_ERROR, 'Failed to parse CLI output', { output: allChunks.join('').slice(0, 500) }, parseError instanceof Error ? parseError : undefined)));
                        }
                    }
                    else {
                        resolve((0, types_1.err)((0, types_1.agentError)(types_1.AgentErrorCode.PROCESS_SPAWN_FAILED, stderr || `Process exited with code ${code}`, { exitCode: code })));
                    }
                }
            });
        });
    }
    /**
     * Check if the agent is initialized
     */
    ensureInitialized() {
        if (!this.isInitialized) {
            return (0, types_1.err)((0, types_1.agentError)(types_1.AgentErrorCode.AGENT_NOT_INITIALIZED, `${this.agentType} agent not initialized. Call initialize() first.`));
        }
        return (0, types_1.ok)(undefined);
    }
}
exports.BaseCliAgent = BaseCliAgent;

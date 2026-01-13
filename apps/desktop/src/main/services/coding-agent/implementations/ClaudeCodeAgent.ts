import { spawn } from 'child_process';
import { BaseCliAgent } from './BaseCliAgent';
import type {
  ICodingAgentProvider,
  ISessionResumable,
  ISessionForkable,
  IProcessLifecycle,
} from '../interfaces';
import type {
  Result,
  AgentError,
  AgentCapabilities,
  CodingAgentType,
  GenerateRequest,
  GenerateResponse,
  StreamCallback,
  SessionIdentifier,
  SessionInfo,
  ContinueOptions,
  ForkOptions,
} from '../types';
import { AgentErrorCode, ok, err, agentError } from '../types';

/**
 * Claude Code CLI agent implementation
 *
 * Implements:
 * - ICodingAgentProvider: Core generation via `claude -p`
 * - ISessionResumable: Resume via `--resume` and `--continue`
 * - ISessionForkable: Fork via `--fork-session`
 * - IProcessLifecycle: Lifecycle management (inherited from BaseCliAgent)
 *
 * Does NOT implement ISessionManager since Claude Code CLI
 * doesn't expose session listing commands (CLI-only approach).
 *
 * CLI Commands Used:
 * - `claude -p "prompt"` - One-off generation
 * - `claude --resume <id> -p "prompt"` - Resume by ID/name
 * - `claude --continue -p "prompt"` - Resume latest session
 * - `claude --fork-session --session-id <parent>` - Fork session
 * - `claude --version` - Verify availability
 */
export class ClaudeCodeAgent
  extends BaseCliAgent
  implements ICodingAgentProvider, ISessionResumable, ISessionForkable, IProcessLifecycle
{
  private static readonly DEFAULT_EXECUTABLE = 'claude';

  get agentType(): CodingAgentType {
    return 'claude_code';
  }

  getCapabilities(): AgentCapabilities {
    return {
      canGenerate: true,
      canResumeSession: true,
      canForkSession: true,
      canListSessions: false, // CLI doesn't expose listing
      supportsStreaming: true,
    };
  }

  protected getExecutablePath(): string {
    return this.config.executablePath ?? ClaudeCodeAgent.DEFAULT_EXECUTABLE;
  }

  protected async verifyExecutable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(this.getExecutablePath(), ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 5000,
      });

      proc.on('close', (code) => {
        resolve(code === 0);
      });

      proc.on('error', () => {
        resolve(false);
      });
    });
  }

  protected parseOutput(output: string): GenerateResponse {
    // Claude Code in print mode outputs directly to stdout
    // The output is the assistant's response text
    return {
      content: output.trim(),
      messageId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================
  // ICodingAgentProvider Implementation
  // ============================================

  async generate(request: GenerateRequest): Promise<Result<GenerateResponse, AgentError>> {
    const initCheck = this.ensureInitialized();
    if (initCheck.success === false) {
      return { success: false, error: initCheck.error };
    }

    const args = this.buildGenerateArgs(request);
    const spawnResult = this.spawnProcess(args, {
      workingDirectory: request.workingDirectory,
      timeout: request.timeout,
    });

    if (spawnResult.success === false) {
      return { success: false, error: spawnResult.error };
    }

    return this.collectOutput(spawnResult.data, request.timeout);
  }

  async generateStreaming(
    request: GenerateRequest,
    onChunk: StreamCallback
  ): Promise<Result<GenerateResponse, AgentError>> {
    const initCheck = this.ensureInitialized();
    if (initCheck.success === false) {
      return { success: false, error: initCheck.error };
    }

    const args = this.buildGenerateArgs(request);
    const spawnResult = this.spawnProcess(args, {
      workingDirectory: request.workingDirectory,
      timeout: request.timeout,
    });

    if (spawnResult.success === false) {
      return { success: false, error: spawnResult.error };
    }

    return this.streamOutput(spawnResult.data, onChunk, request.timeout);
  }

  private buildGenerateArgs(request: GenerateRequest): string[] {
    const args: string[] = ['-p', request.prompt];

    if (request.systemPrompt) {
      args.push('--append-system-prompt', request.systemPrompt);
    }

    return args;
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

    const args = this.buildContinueArgs(identifier, prompt);
    const spawnResult = this.spawnProcess(args, {
      workingDirectory: options?.workingDirectory,
      timeout: options?.timeout,
    });

    if (spawnResult.success === false) {
      return { success: false, error: spawnResult.error };
    }

    return this.collectOutput(spawnResult.data, options?.timeout);
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

    const args = this.buildContinueArgs(identifier, prompt);
    const spawnResult = this.spawnProcess(args, {
      workingDirectory: options?.workingDirectory,
      timeout: options?.timeout,
    });

    if (spawnResult.success === false) {
      return { success: false, error: spawnResult.error };
    }

    return this.streamOutput(spawnResult.data, onChunk, options?.timeout);
  }

  private buildContinueArgs(identifier: SessionIdentifier, prompt: string): string[] {
    const args: string[] = [];

    switch (identifier.type) {
      case 'latest':
        args.push('--continue');
        break;
      case 'id':
      case 'name':
        args.push('--resume', identifier.value);
        break;
    }

    args.push('-p', prompt);
    return args;
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

    const args: string[] = ['--fork-session', '--resume', parentId];

    if (options?.customSessionId) {
      args.push('--session-id', options.customSessionId);
    }

    // Add a minimal prompt to trigger the fork
    args.push('-p', '');

    const spawnResult = this.spawnProcess(args);
    if (spawnResult.success === false) {
      return { success: false, error: spawnResult.error };
    }

    // Wait for the process to complete
    const result = await this.collectOutput(spawnResult.data);

    if (result.success === false) {
      return { success: false, error: result.error };
    }

    // Return the new session info
    // Note: The actual session ID is generated by Claude Code internally
    // We return what we know about the new session
    const newSessionId = options?.customSessionId ?? crypto.randomUUID();
    const now = new Date().toISOString();

    return ok({
      id: newSessionId,
      name: options?.newSessionName,
      agentType: 'claude_code',
      createdAt: now,
      updatedAt: now,
      messageCount: 0, // Unknown without DB access
      parentSessionId: parentId,
    });
  }

  private resolveSessionId(identifier: SessionIdentifier): string | null {
    switch (identifier.type) {
      case 'id':
      case 'name':
        return identifier.value;
      case 'latest':
        return null; // Cannot resolve latest without DB access
    }
  }
}

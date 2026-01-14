import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BaseCliAgent } from './BaseCliAgent';
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
  AgentCapabilities,
  CodingAgentType,
  GenerateRequest,
  GenerateResponse,
  StreamCallback,
  SessionIdentifier,
  SessionInfo,
  SessionSummary,
  SessionContent,
  SessionFilterOptions,
  MessageFilterOptions,
  ContinueOptions,
  ForkOptions,
  ChatMessage,
  MessageType,
  ToolCategory,
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

export class ClaudeCodeAgent
  extends BaseCliAgent
  implements ICodingAgentProvider, ISessionResumable, ISessionForkable, IProcessLifecycle, IChatHistoryProvider
{
  private static readonly DEFAULT_EXECUTABLE = 'claude';

  /**
   * Common installation paths for Claude CLI
   */
  private static readonly COMMON_PATHS = [
    path.join(os.homedir(), '.claude', 'local', 'claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
  ];

  /** Cached resolved executable path */
  private resolvedExecutablePath: string | null = null;

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
    // Return cached path if already resolved
    if (this.resolvedExecutablePath) {
      return this.resolvedExecutablePath;
    }

    // Use configured path if provided
    if (this.config.executablePath) {
      this.resolvedExecutablePath = this.config.executablePath;
      return this.resolvedExecutablePath;
    }

    // Check common installation paths
    for (const execPath of ClaudeCodeAgent.COMMON_PATHS) {
      if (fs.existsSync(execPath)) {
        console.log('[ClaudeCodeAgent] Found CLI at:', execPath);
        this.resolvedExecutablePath = execPath;
        return this.resolvedExecutablePath;
      }
    }

    // Fallback to default (rely on PATH)
    this.resolvedExecutablePath = ClaudeCodeAgent.DEFAULT_EXECUTABLE;
    return this.resolvedExecutablePath;
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
      stdinInput: request.prompt, // Claude CLI expects prompt via stdin in --print mode
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
      stdinInput: request.prompt, // Claude CLI expects prompt via stdin in --print mode
    });

    if (spawnResult.success === false) {
      return { success: false, error: spawnResult.error };
    }

    return this.streamOutput(spawnResult.data, onChunk, request.timeout);
  }

  private buildGenerateArgs(request: GenerateRequest): string[] {
    // Use --print flag for non-interactive mode; prompt is sent via stdin
    const args: string[] = ['-p'];

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

    const args = this.buildContinueArgs(identifier);
    const spawnResult = this.spawnProcess(args, {
      workingDirectory: options?.workingDirectory,
      timeout: options?.timeout,
      stdinInput: prompt, // Claude CLI expects prompt via stdin
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

    const args = this.buildContinueArgs(identifier);
    const spawnResult = this.spawnProcess(args, {
      workingDirectory: options?.workingDirectory,
      timeout: options?.timeout,
      stdinInput: prompt, // Claude CLI expects prompt via stdin
    });

    if (spawnResult.success === false) {
      return { success: false, error: spawnResult.error };
    }

    return this.streamOutput(spawnResult.data, onChunk, options?.timeout);
  }

  private buildContinueArgs(identifier: SessionIdentifier): string[] {
    // Use --print flag; prompt is sent via stdin
    const args: string[] = ['-p'];

    switch (identifier.type) {
      case 'latest':
        args.push('--continue');
        break;
      case 'id':
      case 'name':
        args.push('--resume', identifier.value);
        break;
    }

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

  // ============================================
  // IChatHistoryProvider Implementation
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

        const projectPath = projectDir.replace(/^-/, '/').replace(/-/g, '/');
        const projectName = path.basename(projectPath);

        // Apply project filter
        if (filter?.projectName && projectName !== filter.projectName) continue;
        if (filter?.projectPath && projectPath !== filter.projectPath) continue;

        const sessionFiles = fs.readdirSync(projectDirPath).filter(f => f.endsWith('.jsonl'));

        for (const sessionFile of sessionFiles) {
          const sessionFilePath = path.join(projectDirPath, sessionFile);
          const stats = fs.statSync(sessionFilePath);
          const mtime = stats.mtime.getTime();

          // Time filtering
          if (mtime < Math.max(cutoffTime, minTime)) continue;

          const sessionId = path.basename(sessionFile, '.jsonl');
          const summary = this.parseSessionSummary(sessionFilePath, sessionId, projectPath, projectName);

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
  ): Promise<Result<SessionContent | null, AgentError>> {
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
  ): SessionContent {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    const messages: ChatMessage[] = [];
    let lastTimestamp: string | undefined;

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
          if (msg.timestamp) lastTimestamp = msg.timestamp;
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

  private parseJsonlLine(data: JsonlLine): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const timestamp = this.normalizeTimestamp(data.timestamp);

    if (data.type === 'user' && data.message?.content) {
      const display = this.extractDisplayContent(data.message.content);
      if (display) {
        messages.push({
          id: crypto.randomUUID(),
          role: 'user',
          content: display,
          timestamp,
          messageType: 'user',
          agentMetadata: { rawType: data.type },
        });
      }
    }

    if (data.type === 'assistant' && data.message?.content) {
      const contentParts = Array.isArray(data.message.content)
        ? data.message.content
        : [data.message.content];

      for (const part of contentParts) {
        if (typeof part === 'string') {
          messages.push({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: part,
            timestamp,
            messageType: 'assistant',
            agentMetadata: { rawType: data.type },
          });
        } else if (typeof part === 'object' && part !== null) {
          const partObj = part as Record<string, unknown>;

          if (partObj.type === 'text' && partObj.text) {
            messages.push({
              id: crypto.randomUUID(),
              role: 'assistant',
              content: String(partObj.text),
              timestamp,
              messageType: 'assistant',
              agentMetadata: { rawType: data.type },
            });
          } else if (partObj.type === 'tool_use') {
            messages.push({
              id: String(partObj.id || crypto.randomUUID()),
              role: 'assistant',
              content: `Tool: ${partObj.name}`,
              timestamp,
              messageType: 'tool_call',
              tool: {
                name: String(partObj.name || 'unknown'),
                category: this.categorizeToolByName(String(partObj.name || '')),
                input: partObj.input as Record<string, unknown> | undefined,
                status: 'pending',
              },
              agentMetadata: { rawType: 'tool_use', rawContent: part },
            });
          } else if (partObj.type === 'tool_result') {
            messages.push({
              id: crypto.randomUUID(),
              role: 'assistant',
              content: String(partObj.content || ''),
              timestamp,
              messageType: 'tool_result',
              tool: {
                name: 'tool_result',
                category: 'unknown',
                output: String(partObj.content || ''),
                status: partObj.is_error ? 'error' : 'success',
              },
              agentMetadata: { rawType: 'tool_result', toolUseId: partObj.tool_use_id },
            });
          } else if (partObj.type === 'thinking') {
            messages.push({
              id: crypto.randomUUID(),
              role: 'assistant',
              content: String(partObj.thinking || ''),
              timestamp,
              messageType: 'thinking',
              thinking: {
                content: String(partObj.thinking || ''),
                isRedacted: false,
              },
              agentMetadata: { rawType: 'thinking' },
            });
          }
        }
      }
    }

    return messages;
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
  ): AsyncGenerator<ChatMessage, void, unknown> {
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

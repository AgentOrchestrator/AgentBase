/**
 * OrchestratorService
 *
 * Main service for the meta-orchestrator that uses Claude CLI + MCP
 * to control the canvas through natural language.
 */

import { execFileSync, spawn } from 'node:child_process';
import type { IDatabase } from '../../database/IDatabase';
import type {
  ICanvasStateProvider,
  IOrchestratorService,
  OrchestratorConversation,
  OrchestratorHealth,
  OrchestratorMessage,
  OrchestratorResponse,
  StreamCallback,
  ToolCall,
} from './interfaces';

/**
 * Parsed JSON line from Claude CLI output
 */
interface ClaudeOutputLine {
  type: 'text' | 'tool_use' | 'tool_result' | 'error' | 'result';
  content?: string;
  tool_use_id?: string;
  name?: string;
  input?: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

export class OrchestratorService implements IOrchestratorService {
  private db: IDatabase;
  private canvasProvider: ICanvasStateProvider;
  private lastHealthCheck: number = 0;
  private cliAvailable: boolean = false;

  constructor(db: IDatabase, canvasProvider: ICanvasStateProvider) {
    this.db = db;
    this.canvasProvider = canvasProvider;
  }

  async initialize(): Promise<void> {
    // Check CLI availability on init
    await this.getHealth();
  }

  async getHealth(): Promise<OrchestratorHealth> {
    const now = Date.now();

    // Cache health check for 30 seconds
    if (now - this.lastHealthCheck < 30000) {
      return {
        cliAvailable: this.cliAvailable,
        lastHealthCheck: this.lastHealthCheck,
      };
    }

    try {
      // Use execFileSync (no shell) for safety
      execFileSync('claude', ['--version'], { stdio: 'pipe' });
      this.cliAvailable = true;
    } catch {
      this.cliAvailable = false;
    }

    this.lastHealthCheck = now;
    return {
      cliAvailable: this.cliAvailable,
      lastHealthCheck: this.lastHealthCheck,
    };
  }

  async sendMessage(
    conversationId: string,
    message: string,
    onChunk?: StreamCallback
  ): Promise<OrchestratorResponse> {
    // 1. Save user message
    await this.db.addOrchestratorMessage({
      conversationId,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    });

    // 2. Build conversation history for context
    const history = await this.db.getOrchestratorMessages(conversationId);

    // 3. Execute Claude CLI and get response
    const response = await this.executeClaudeCLI(history, onChunk);

    // 4. Save assistant response
    await this.db.addOrchestratorMessage({
      conversationId,
      role: 'assistant',
      content: response.content,
      timestamp: Date.now(),
      toolCalls: response.toolCalls,
    });

    return response;
  }

  async getConversation(id: string): Promise<OrchestratorConversation | null> {
    return this.db.getOrchestratorConversation(id);
  }

  async getMostRecentConversation(): Promise<OrchestratorConversation | null> {
    return this.db.getMostRecentOrchestratorConversation();
  }

  async createConversation(): Promise<OrchestratorConversation> {
    return this.db.createOrchestratorConversation();
  }

  async getMessages(conversationId: string): Promise<OrchestratorMessage[]> {
    return this.db.getOrchestratorMessages(conversationId);
  }

  dispose(): void {
    // No cleanup needed currently
  }

  /**
   * Execute Claude CLI with conversation history
   */
  private async executeClaudeCLI(
    history: OrchestratorMessage[],
    onChunk?: StreamCallback
  ): Promise<OrchestratorResponse> {
    return new Promise((resolve, reject) => {
      // Build the prompt from history
      const prompt = this.buildPromptFromHistory(history);

      // Build system prompt for canvas control
      const systemPrompt = this.buildSystemPrompt();

      // Spawn Claude CLI (spawn doesn't use shell by default, safe from injection)
      const proc = spawn('claude', [
        '-p',
        prompt,
        '--output-format',
        'stream-json',
        '--system',
        systemPrompt,
        '--allowedTools',
        'mcp__canvas',
      ]);

      let content = '';
      const toolCalls: ToolCall[] = [];
      const pendingToolExecutions: Promise<void>[] = [];

      proc.stdout.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as ClaudeOutputLine;

            switch (parsed.type) {
              case 'text':
                if (parsed.content) {
                  content += parsed.content;
                  onChunk?.(parsed.content);
                }
                break;

              case 'tool_use':
                // Execute tool immediately when we see tool_use
                if (parsed.name && parsed.tool_use_id) {
                  const toolExecution = this.executeMCPTool(parsed.name, parsed.input || {})
                    .then((result) => {
                      toolCalls.push({
                        id: parsed.tool_use_id!,
                        name: parsed.name!,
                        input: parsed.input || {},
                        result,
                      });
                    })
                    .catch((err) => {
                      toolCalls.push({
                        id: parsed.tool_use_id!,
                        name: parsed.name!,
                        input: parsed.input || {},
                        result: { error: err.message },
                      });
                    });
                  pendingToolExecutions.push(toolExecution);
                }
                break;

              case 'tool_result':
                // Tool result from CLI - we already executed the tool
                break;

              case 'result':
                // Final result, content should be complete
                if (parsed.content) {
                  content = parsed.content;
                }
                break;

              case 'error':
                reject(new Error(parsed.error || 'Unknown CLI error'));
                return;
            }
          } catch {
            // Skip non-JSON lines
          }
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        console.error('[OrchestratorService] CLI stderr:', data.toString());
      });

      proc.on('error', (error) => {
        if (error.message.includes('ENOENT')) {
          reject(new Error('Claude CLI not found. Please install it first.'));
        } else {
          reject(error);
        }
      });

      proc.on('close', async (code) => {
        // Wait for all tool executions to complete
        await Promise.all(pendingToolExecutions);

        if (code === 0 || content) {
          resolve({ content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined });
        } else {
          reject(new Error(`Claude CLI exited with code ${code}`));
        }
      });

      // Set timeout
      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error('Claude CLI timeout after 120 seconds'));
      }, 120000);

      proc.on('close', () => clearTimeout(timeout));
    });
  }

  /**
   * Build prompt from conversation history
   */
  private buildPromptFromHistory(history: OrchestratorMessage[]): string {
    // For now, just use the last user message
    // In the future, we could build a more sophisticated prompt
    const lastUserMessage = history.filter((m) => m.role === 'user').pop();
    return lastUserMessage?.content || '';
  }

  /**
   * Build system prompt for canvas orchestration
   */
  private buildSystemPrompt(): string {
    return `You are a meta-orchestrator for an agent canvas system. You can control agents on the canvas using MCP tools.

Available tools:
- canvas/list_agents: List all agents currently on the canvas
- canvas/create_agent: Create a new agent with a workspace path
- canvas/delete_agent: Delete an agent by ID

When the user asks to manage agents, use these tools to accomplish their requests.
Be concise and helpful. Report what actions you took.`;
  }

  /**
   * Execute an MCP tool via the canvas provider
   */
  private async executeMCPTool(toolName: string, input: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case 'canvas/list_agents':
        return this.canvasProvider.listAgents();

      case 'canvas/create_agent':
        return this.canvasProvider.createAgent({
          workspacePath: input.workspacePath as string,
          title: input.title as string | undefined,
          initialPrompt: input.initialPrompt as string | undefined,
        });

      case 'canvas/delete_agent':
        await this.canvasProvider.deleteAgent(input.agentId as string);
        return { success: true };

      default:
        throw new Error(`Unknown MCP tool: ${toolName}`);
    }
  }
}

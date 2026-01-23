/**
 * Agent Hooks Service
 *
 * Manages the HTTP server that receives lifecycle events from terminal-based agents
 * and the setup scripts needed for hook integration.
 *
 * Architecture:
 * - Terminal processes are spawned with env vars (AGENT_ORCHESTRATOR_*)
 * - Agent hooks (Claude Code CLI) call notify.sh on lifecycle events
 * - notify.sh sends HTTP POST to this service
 * - This service validates and forwards events via EventEmitter
 */

import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as http from 'node:http';
import {
  buildTerminalEnv,
  DEFAULT_HOOKS_PORT,
  generateClaudeSettings,
  generateClaudeWrapper,
  generateNotifyScript,
  type LifecycleEvent,
  resolveGitBranch,
  TERMINAL_MARKER,
  type TerminalEnvParams,
  validateHookRequest,
} from '@agent-orchestrator/shared';
import {
  getClaudeSettingsPath,
  getClaudeWrapperPath,
  getHooksScriptsDir,
  getNotifyScriptPath,
} from './paths.js';

/**
 * Configuration for AgentHooksService
 */
export interface AgentHooksServiceConfig {
  /** Port for the HTTP server */
  port: number;
  /** Home directory for storing hooks scripts */
  homeDir: string;
}

/**
 * Parameters for getting terminal environment variables
 */
export interface GetTerminalEnvParams {
  terminalId: string;
  workspacePath: string;
  agentId: string;
}

/**
 * Service for managing agent lifecycle hooks via HTTP sideband
 *
 * @example
 * ```typescript
 * const service = new AgentHooksService({ port: 31415, homeDir: '/Users/foo' });
 * await service.ensureSetup();
 * service.startServer();
 *
 * service.on('lifecycle', (event) => {
 *   console.log('Agent lifecycle event:', event);
 * });
 * ```
 */
export class AgentHooksService extends EventEmitter {
  private readonly port: number;
  private readonly homeDir: string;
  private server: http.Server | null = null;
  private isSetup = false;

  constructor(config: AgentHooksServiceConfig) {
    super();
    this.port = config.port;
    this.homeDir = config.homeDir;
  }

  /**
   * Ensure all hooks scripts and directories are set up
   */
  async ensureSetup(): Promise<void> {
    if (this.isSetup) {
      return;
    }

    const scriptsDir = getHooksScriptsDir(this.homeDir);

    // Create directories
    await fs.promises.mkdir(scriptsDir, { recursive: true });

    // Write notify script
    const notifyScriptPath = getNotifyScriptPath(this.homeDir);
    const notifyScript = generateNotifyScript({
      port: this.port,
      marker: TERMINAL_MARKER,
    });
    await fs.promises.writeFile(notifyScriptPath, notifyScript, { mode: 0o755 });

    // Write Claude settings
    const claudeSettingsPath = getClaudeSettingsPath(this.homeDir);
    const claudeSettings = generateClaudeSettings(notifyScriptPath);
    await fs.promises.writeFile(claudeSettingsPath, JSON.stringify(claudeSettings, null, 2));

    // Write Claude wrapper
    const claudeWrapperPath = getClaudeWrapperPath(this.homeDir);
    const claudeWrapper = generateClaudeWrapper(claudeSettingsPath);
    await fs.promises.writeFile(claudeWrapperPath, claudeWrapper, { mode: 0o755 });

    this.isSetup = true;
    console.log('[AgentHooksService] Setup complete', {
      scriptsDir,
      notifyScriptPath,
      claudeSettingsPath,
    });
  }

  /**
   * Start the HTTP server for receiving hook events
   */
  startServer(): void {
    if (this.server) {
      console.log('[AgentHooksService] Server already running');
      return;
    }

    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    this.server.listen(this.port, '127.0.0.1', () => {
      console.log(`[AgentHooksService] HTTP server listening on port ${this.port}`);
    });

    this.server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.warn(`[AgentHooksService] Port ${this.port} already in use, skipping server start`);
      } else {
        console.error('[AgentHooksService] Server error:', error);
      }
    });
  }

  /**
   * Stop the HTTP server
   */
  stopServer(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      console.log('[AgentHooksService] Server stopped');
    }
  }

  /**
   * Get environment variables to inject into a terminal process
   */
  getTerminalEnv(params: GetTerminalEnvParams): Record<string, string> {
    const gitBranch = resolveGitBranch(params.workspacePath);

    const envParams: TerminalEnvParams = {
      terminalId: params.terminalId,
      workspacePath: params.workspacePath,
      gitBranch,
      agentId: params.agentId,
      port: this.port,
    };

    return buildTerminalEnv(envParams);
  }

  /**
   * Get the port this service is configured for
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Handle incoming HTTP requests
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Only accept POST to /hook
    if (req.method !== 'POST' || req.url !== '/hook') {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      // Limit body size to prevent abuse
      if (body.length > 10000) {
        res.writeHead(413);
        res.end('Payload Too Large');
        req.destroy();
      }
    });

    req.on('end', () => {
      this.processHookRequest(body, res);
    });
  }

  /**
   * Process a validated hook request
   */
  private processHookRequest(body: string, res: http.ServerResponse): void {
    try {
      const raw = JSON.parse(body);
      const result = validateHookRequest(raw);

      if (!result.valid) {
        console.warn('[AgentHooksService] Invalid hook request:', result.reason);
        res.writeHead(400);
        res.end(JSON.stringify({ error: result.reason }));
        return;
      }

      // Emit the validated event
      this.emit('lifecycle', result.event);

      console.log('[AgentHooksService] Lifecycle event received:', {
        type: result.event.type,
        terminalId: result.event.terminalId,
        agentId: result.event.agentId,
      });

      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
    } catch (error) {
      console.error('[AgentHooksService] Error processing hook request:', error);
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopServer();
    this.removeAllListeners();
  }
}

// Re-export types for convenience
export type { LifecycleEvent };

// Default instance factory
export function createAgentHooksService(homeDir: string): AgentHooksService {
  return new AgentHooksService({
    port: DEFAULT_HOOKS_PORT,
    homeDir,
  });
}

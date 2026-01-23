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

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';

// Debug logging
const DEBUG_LOG = '/tmp/debug-terminal-hooks.log';
const DBG_ID = 'DBG-h00ks1';
let dbgStep = 1000; // Start at 1000 for AgentHooksService to distinguish from main.ts
function dbg(loc: string, state: Record<string, unknown>) {
  dbgStep++;
  const line = `[${DBG_ID}] Step ${dbgStep} | AgentHooksService.ts:${loc} | ${JSON.stringify(state)}`;
  try {
    fs.appendFileSync(DEBUG_LOG, `${line}\n`);
  } catch {
    // Ignore write errors
  }
}

import { EventEmitter } from 'node:events';
import * as http from 'node:http';
import {
  buildTerminalEnv,
  DEFAULT_HOOKS_PORT,
  generateClaudeSettings,
  generateClaudeWrapper,
  generateNotifyScript,
  type LifecycleEvent,
  TERMINAL_MARKER,
  type TerminalEnvParams,
  validateHookRequest,
} from '@agent-orchestrator/shared';

/**
 * Resolve the current git branch for a workspace path.
 * Inlined here to avoid browser bundling issues with the shared package.
 */
function resolveGitBranch(workspacePath: string): string {
  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: workspacePath,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return branch || 'unknown';
  } catch {
    return 'unknown';
  }
}

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
    dbg('ensureSetup-entry', { isAlreadySetup: this.isSetup });
    if (this.isSetup) {
      return;
    }

    const scriptsDir = getHooksScriptsDir(this.homeDir);
    dbg('ensureSetup-dirs', { scriptsDir });

    // Create directories
    await fs.promises.mkdir(scriptsDir, { recursive: true });

    // Write notify script
    const notifyScriptPath = getNotifyScriptPath(this.homeDir);
    const notifyScript = generateNotifyScript({
      port: this.port,
      marker: TERMINAL_MARKER,
    });
    await fs.promises.writeFile(notifyScriptPath, notifyScript, { mode: 0o755 });
    dbg('ensureSetup-notify-script', { notifyScriptPath, scriptLength: notifyScript.length });

    // Write Claude settings
    const claudeSettingsPath = getClaudeSettingsPath(this.homeDir);
    const claudeSettings = generateClaudeSettings(notifyScriptPath);
    await fs.promises.writeFile(claudeSettingsPath, JSON.stringify(claudeSettings, null, 2));
    dbg('ensureSetup-claude-settings', { claudeSettingsPath, settings: claudeSettings });

    // Write Claude wrapper
    const claudeWrapperPath = getClaudeWrapperPath(this.homeDir);
    const claudeWrapper = generateClaudeWrapper(claudeSettingsPath);
    await fs.promises.writeFile(claudeWrapperPath, claudeWrapper, { mode: 0o755 });
    dbg('ensureSetup-claude-wrapper', { claudeWrapperPath });

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
    dbg('startServer-entry', { hasExistingServer: !!this.server, port: this.port });
    if (this.server) {
      console.log('[AgentHooksService] Server already running');
      return;
    }

    this.server = http.createServer((req, res) => {
      dbg('http-request-received', { method: req.method, url: req.url });
      this.handleRequest(req, res);
    });

    this.server.listen(this.port, '127.0.0.1', () => {
      dbg('server-listening', { port: this.port, host: '127.0.0.1' });
      console.log(`[AgentHooksService] HTTP server listening on port ${this.port}`);
    });

    this.server.on('error', (error: NodeJS.ErrnoException) => {
      dbg('server-error', { code: error.code, message: error.message });
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
   * Ensure workspace-level Claude hooks are configured.
   * Creates .claude/settings.local.json in the workspace with hooks pointing to our notify.sh.
   * This is gitignored so it won't affect other team members.
   */
  async ensureWorkspaceHooks(workspacePath: string): Promise<void> {
    const notifyScriptPath = getNotifyScriptPath(this.homeDir);
    const claudeDir = `${workspacePath}/.claude`;
    const settingsPath = `${claudeDir}/settings.local.json`;

    dbg('ensureWorkspaceHooks-entry', { workspacePath, settingsPath, notifyScriptPath });

    // Create .claude directory if needed
    await fs.promises.mkdir(claudeDir, { recursive: true });

    // Check if settings.local.json exists and has our hooks
    let existingSettings: Record<string, unknown> = {};
    try {
      const content = await fs.promises.readFile(settingsPath, 'utf-8');
      existingSettings = JSON.parse(content);
      dbg('ensureWorkspaceHooks-existing', { hasHooks: !!existingSettings.hooks });
    } catch {
      // File doesn't exist, start fresh
      dbg('ensureWorkspaceHooks-no-existing', {});
    }

    // Generate our hooks config
    const hooksConfig = generateClaudeSettings(notifyScriptPath);
    const ourHooks = (hooksConfig as { hooks: Record<string, unknown> }).hooks;

    // Merge our hooks with existing settings
    const existingHooks = (existingSettings.hooks || {}) as Record<string, unknown>;
    const mergedHooks = { ...existingHooks, ...ourHooks };

    const newSettings = {
      ...existingSettings,
      hooks: mergedHooks,
    };

    await fs.promises.writeFile(settingsPath, JSON.stringify(newSettings, null, 2));
    dbg('ensureWorkspaceHooks-written', { settingsPath, hookNames: Object.keys(mergedHooks) });
    console.log('[AgentHooksService] Workspace hooks configured:', settingsPath);
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
    dbg('processHookRequest-entry', {
      bodyLength: body.length,
      bodyPreview: body.substring(0, 200),
    });
    try {
      const raw = JSON.parse(body);
      dbg('processHookRequest-parsed', { raw });

      const result = validateHookRequest(raw);
      dbg('processHookRequest-validated', {
        valid: result.valid,
        reason: !result.valid ? result.reason : undefined,
        eventType: result.valid ? result.event.type : undefined,
      });

      if (!result.valid) {
        console.warn('[AgentHooksService] Invalid hook request:', result.reason);
        res.writeHead(400);
        res.end(JSON.stringify({ error: result.reason }));
        return;
      }

      // Emit the validated event
      dbg('processHookRequest-emitting', {
        eventType: result.event.type,
        terminalId: result.event.terminalId,
        agentId: result.event.agentId,
        sessionId: result.event.sessionId,
      });
      this.emit('lifecycle', result.event);

      console.log('[AgentHooksService] Lifecycle event received:', {
        type: result.event.type,
        terminalId: result.event.terminalId,
        agentId: result.event.agentId,
      });

      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
    } catch (error) {
      dbg('processHookRequest-error', { error: String(error) });
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

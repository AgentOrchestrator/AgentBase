import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import * as pty from 'node-pty';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import { spawn } from 'child_process';
import * as fs from 'fs';
import { DatabaseFactory } from './database';
import { IDatabase } from './database/IDatabase';
import { CanvasState } from './types/database';
import { WorktreeManagerFactory } from './worktree';
import { registerWorktreeIpcHandlers } from './worktree/ipc';
import type { CodingAgentState } from '../../types/coding-agent-status';
import type {
  GitInfo,
  TerminalSessionState,
  AddWorkspaceOptions,
  RecentWorkspace,
} from '@agent-orchestrator/shared';
import {
  CodingAgentFactory,
  isSessionResumable,
  isSessionForkable,
  isChatHistoryProvider,
  isSessionValidator,
} from './services/coding-agent';
import type {
  AgentActionResponse,
  AgentEvent,
  EventRegistry,
  EventResult,
  PermissionPayload,
} from '@agent-orchestrator/shared';
import type {
  CodingAgentType,
  GenerateRequest,
  SessionIdentifier,
  ForkOptions,
  ContinueOptions,
  SessionFilterOptions,
  MessageFilterOptions,
} from './services/coding-agent';
import {
  LLMServiceFactory,
  registerLLMIpcHandlers,
  DEFAULT_LLM_CONFIG,
} from './services/llm';
import {
  registerSessionWatcherIpcHandlers,
  disposeSessionWatcher,
} from './services/session-watcher';
import { gitBranchService } from './services/git';
import {
  RepresentationService,
  type RepresentationInput,
  type ImageTransformOptions,
  type SummaryTransformOptions,
  type AudioTransformOptions,
  type ILogger,
  type IIdGenerator,
} from './services/representation';
import { awaitAgentActionResponse, emitAgentEvent, registerAgentActionHandlers } from './services/coding-agent/agent-event-bridge';

// Map to store terminal instances by ID
const terminalProcesses = new Map<string, pty.IPty>();

// Terminal output buffers for restoring scrollback after renderer refresh
const terminalBuffers = new Map<string, string[]>();

// Terminal session state for tracking agent activity across renderer refreshes
const terminalSessionStates = new Map<string, TerminalSessionState>();

// Maximum lines to keep in terminal buffer (configurable)
const TERMINAL_BUFFER_LINES = 1000;

// Database instance
let database: IDatabase;

// RepresentationService instance and dependencies
const representationLogger: ILogger = {
  info: (message: string, context?: Record<string, unknown>) =>
    console.log(`[Representation] ${message}`, context || ''),
  warn: (message: string, context?: Record<string, unknown>) =>
    console.warn(`[Representation] ${message}`, context || ''),
  error: (message: string, context?: Record<string, unknown>) =>
    console.error(`[Representation] ${message}`, context || ''),
};

const representationIdGenerator: IIdGenerator = {
  generate: () => crypto.randomUUID(),
};

const representationService = new RepresentationService(
  { defaultTimeout: 30000, initializeProvidersOnStart: true },
  { logger: representationLogger, idGenerator: representationIdGenerator }
);

// NOTE: registerAgentActionHandlers() moved inside app.whenReady() - ipcMain requires app to be ready

interface EventRegistryProvider {
  getEventRegistry: () => EventRegistry;
}

const bridgedAgents = new WeakSet<object>();

function isEventRegistryProvider(agent: unknown): agent is EventRegistryProvider {
  return typeof (agent as EventRegistryProvider)?.getEventRegistry === 'function';
}

function sanitizeAgentEvent(event: AgentEvent): AgentEvent {
  if (!event.raw || typeof event.raw !== 'object') {
    return event;
  }

  const raw = event.raw as { toolInput?: unknown; toolUseId?: string };
  return {
    ...event,
    raw: {
      toolInput: raw.toolInput,
      toolUseId: raw.toolUseId,
    },
  };
}

function mapActionResponseToEventResult(
  response: AgentActionResponse,
  event: AgentEvent<PermissionPayload>
): EventResult {
  if (response.type === 'tool_approval') {
    return response.decision === 'allow'
      ? { action: 'allow' }
      : { action: 'deny', message: response.message || 'Permission denied' };
  }

  if (response.type === 'clarifying_question') {
    const toolInput = (event.raw as { toolInput?: Record<string, unknown> } | undefined)
      ?.toolInput ?? {};
    return {
      action: 'modify',
      modifiedPayload: {
        ...toolInput,
        answers: response.answers,
      },
    };
  }

  return { action: 'continue' };
}

function ensureAgentEventBridge(agent: unknown): void {
  if (!isEventRegistryProvider(agent)) {
    return;
  }

  const agentObject = agent as object;
  if (bridgedAgents.has(agentObject)) {
    return;
  }

  bridgedAgents.add(agentObject);
  const registry = agent.getEventRegistry();

  registry.on<PermissionPayload>('permission:request', async (event) => {
    emitAgentEvent(sanitizeAgentEvent(event));

    try {
      const response = await awaitAgentActionResponse(
        event.id,
        (event.raw as { signal?: AbortSignal } | undefined)?.signal
      );
      return mapActionResponseToEventResult(response, event);
    } catch (error) {
      return {
        action: 'deny',
        message: error instanceof Error ? error.message : 'Permission request aborted',
      };
    }
  });
}

const createWindow = (): void => {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1e1e1e',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true
    }
  });

  // Load from Vite dev server in development, otherwise load from dist
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    const devServerPort = process.env.VITE_DEV_SERVER_PORT || '5173';
    const devServerUrl = `http://localhost:${devServerPort}`;
    console.log('[Main] Loading from dev server:', devServerUrl);
    win.loadURL(devServerUrl);
    // Open DevTools in development
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../../../index.html'));
  }

  // Return home directory synchronously
  ipcMain.on('get-home-dir', (event) => {
    event.returnValue = process.env.HOME || os.homedir();
  });

  // Window control handlers for custom titlebar
  ipcMain.on('window-minimize', () => {
    win.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.on('window-close', () => {
    win.close();
  });

  ipcMain.handle('window-is-maximized', () => {
    return win.isMaximized();
  });

  // Track terminals being created to prevent race conditions
  const terminalsBeingCreated = new Set<string>();
  const terminalCreationTimes = new Map<string, number>();

  // Create a new terminal instance
  ipcMain.on('terminal-create', (event, terminalId: string) => {
    const callTime = Date.now();
    const lastCreationTime = terminalCreationTimes.get(terminalId);
    const timeSinceLastCreation = lastCreationTime ? callTime - lastCreationTime : null;
    
    console.log('[Main] terminal-create IPC received', { 
      terminalId, 
      timeSinceLastCreation: timeSinceLastCreation ? `${timeSinceLastCreation}ms` : 'never',
      existingInMap: terminalProcesses.has(terminalId),
      beingCreated: terminalsBeingCreated.has(terminalId),
      stackTrace: new Error().stack?.split('\n').slice(2, 5).join('\n')
    });

    // If terminal already exists, skip creation (prevent duplicates)
    const existingProcess = terminalProcesses.get(terminalId);
    if (existingProcess) {
      console.log('[Main] ⚠️ Terminal already exists, skipping duplicate creation', { terminalId });
      return;
    }

    // If terminal is currently being created, skip to prevent race conditions
    if (terminalsBeingCreated.has(terminalId)) {
      console.log('[Main] ⚠️ Terminal is already being created, skipping duplicate request', { terminalId });
      return;
    }

    // Mark as being created immediately to prevent race conditions
    terminalsBeingCreated.add(terminalId);
    terminalCreationTimes.set(terminalId, callTime);

    const shell = process.platform === 'win32' ? 'cmd.exe' : process.env.SHELL || '/bin/bash';
    // Use login shell (-l) to ensure user's PATH is loaded from shell profile
    // This is needed for commands like 'claude' that are installed in user-specific locations
    const shellArgs: string[] = process.platform === 'win32' ? [] : ['-l'];

    const ptyProcess = pty.spawn(
      shell,
      shellArgs,
      {
        name: 'xterm-256color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME || process.cwd(),
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          // Ensure shell runs in interactive mode via environment
          PS1: process.env.PS1 || '$ ',
          // For zsh, ensure it runs interactively
          ...(shell.includes('zsh') ? { ZDOTDIR: process.env.HOME } : {})
        } as { [key: string]: string }
      }
    );

    // Add to map immediately after creation to prevent duplicates
    terminalProcesses.set(terminalId, ptyProcess);
    // Remove from "being created" set
    terminalsBeingCreated.delete(terminalId);

    // Log terminal creation for debugging
    console.log('[Main] ✅ Terminal created successfully', { terminalId, shell, shellArgs });

    // Initialize buffer for this terminal
    if (!terminalBuffers.has(terminalId)) {
      terminalBuffers.set(terminalId, []);
    }

    // Handle shell data - send to renderer via IPC with terminal ID
    ptyProcess.onData((data: string) => {
      // Buffer the output for restoration after refresh
      const buffer = terminalBuffers.get(terminalId);
      if (buffer) {
        // Split by newlines and add to buffer
        const lines = data.split('\n');
        buffer.push(...lines);
        // Keep buffer within limit
        while (buffer.length > TERMINAL_BUFFER_LINES) {
          buffer.shift();
        }
      }

      // Check if window is still valid before sending
      if (!win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
        win.webContents.send('terminal-data', { terminalId, data });
      }
    });

    // Handle shell exit
    ptyProcess.onExit((exitInfo: { exitCode: number; signal?: number }) => {
      console.log('[Main] Terminal exited', { terminalId, exitInfo });
      // Check if window is still valid before sending
      if (!win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
        win.webContents.send('terminal-exit', {
          terminalId,
          code: exitInfo.exitCode,
          signal: exitInfo.signal
        });
      }
      // Remove from map when process exits so it can be recreated
      terminalProcesses.delete(terminalId);
      // Also remove from "being created" set if it's still there
      terminalsBeingCreated.delete(terminalId);
      // Clean up buffer and session state
      terminalBuffers.delete(terminalId);
      terminalSessionStates.delete(terminalId);
    });
  });

  // Handle resize from renderer (throttled on renderer side, but log less frequently here too)
  let lastResizeLog: { [key: string]: { cols: number; rows: number; time: number } } = {};
  ipcMain.on('terminal-resize', (_event, { terminalId, cols, rows }: { terminalId: string; cols: number; rows: number }) => {
    const ptyProcess = terminalProcesses.get(terminalId);
    if (ptyProcess) {
      // Validate dimensions are positive (node-pty requires this)
      if (cols <= 0 || rows <= 0) {
        return;
      }

      // Only log resize if it's been more than 2000ms since last log OR dimensions changed significantly (>5 cols or >1 row)
      const lastLog = lastResizeLog[terminalId];
      const now = Date.now();
      const dimensionChanged = !lastLog || lastLog.cols !== cols || lastLog.rows !== rows;
      const significantChange = lastLog && (Math.abs(lastLog.cols - cols) > 5 || Math.abs(lastLog.rows - rows) > 1);
      const timeThreshold = !lastLog || (now - lastLog.time > 2000);

      if (timeThreshold || (dimensionChanged && significantChange)) {
        console.log('[Main] Terminal resize', { terminalId, cols, rows });
        lastResizeLog[terminalId] = { cols, rows, time: now };
      }
      ptyProcess.resize(cols, rows);
    }
  });

  // Handle input from renderer
  ipcMain.on('terminal-input', (_event, { terminalId, data }: { terminalId: string; data: string }) => {
    // Don't log every input - too verbose (logs every keystroke)
    const ptyProcess = terminalProcesses.get(terminalId);
    if (ptyProcess) {
      ptyProcess.write(data);
    }
  });

  // Handle terminal destroy
  ipcMain.on('terminal-destroy', (event, terminalId: string) => {
    const destroyTime = Date.now();
    const creationTime = terminalCreationTimes.get(terminalId);
    const lifetime = creationTime ? destroyTime - creationTime : null;
    
    console.log('[Main] ⚠️ terminal-destroy IPC received', { 
      terminalId,
      lifetime: lifetime ? `${lifetime}ms` : 'unknown',
      existsInMap: terminalProcesses.has(terminalId),
      stackTrace: new Error().stack?.split('\n').slice(2, 5).join('\n')
    });
    
    const ptyProcess = terminalProcesses.get(terminalId);
    if (ptyProcess) {
      console.log('[Main] 🗑️ Destroying terminal process', { terminalId });
      ptyProcess.kill();
      terminalProcesses.delete(terminalId);
      terminalsBeingCreated.delete(terminalId);
      terminalCreationTimes.delete(terminalId);
      // Clean up buffer and session state
      terminalBuffers.delete(terminalId);
      terminalSessionStates.delete(terminalId);
    } else {
      console.log('[Main] ⚠️ Terminal destroy requested but process not found', { terminalId });
    }
  });

  // Initialize session file watcher for real-time sync between terminal and chat views
  registerSessionWatcherIpcHandlers(win);

  // Clean up all terminals when window closes
  win.on('closed', () => {
    console.log('[Main] Window closed');
    terminalProcesses.forEach((ptyProcess) => {
      ptyProcess.kill();
    });
    terminalProcesses.clear();
    terminalBuffers.clear();
    terminalSessionStates.clear();
  });

  // ============================================
  // Terminal Session State IPC Handlers
  // ============================================

  // Get terminal output buffer for restoring scrollback after refresh
  ipcMain.handle('terminal-get-buffer', async (_event, terminalId: string) => {
    const buffer = terminalBuffers.get(terminalId);
    if (!buffer) {
      return { success: true, data: '' };
    }
    return { success: true, data: buffer.join('\n') };
  });

  // Get terminal session state
  ipcMain.handle('terminal-get-session-state', async (_event, terminalId: string) => {
    const state = terminalSessionStates.get(terminalId);
    console.log('[Main] terminal-get-session-state', { terminalId, state: state || null });
    return { success: true, data: state || null };
  });

  // Set terminal session state
  ipcMain.handle('terminal-set-session-state', async (_event, terminalId: string, state: TerminalSessionState) => {
    terminalSessionStates.set(terminalId, state);
    console.log('[Main] Terminal session state set', { terminalId, state });
    return { success: true };
  });

  // Clear terminal session state
  ipcMain.handle('terminal-clear-session-state', async (_event, terminalId: string) => {
    terminalSessionStates.delete(terminalId);
    console.log('[Main] Terminal session state cleared', { terminalId });
    return { success: true };
  });
};

// ============================================================================
// Shell API helper types and functions (needed before registerIpcHandlers)
// ============================================================================

type EditorApp = 'vscode' | 'cursor' | 'zed' | 'sublime' | 'atom' | 'webstorm' | 'finder';

// Editor command configurations for macOS
const EDITOR_COMMANDS: Record<EditorApp, { app?: string; command?: string; args: (dir: string) => string[] }> = {
  vscode: { command: 'code', args: (dir) => [dir] },
  cursor: { command: 'cursor', args: (dir) => [dir] },
  zed: { command: 'zed', args: (dir) => [dir] },
  sublime: { command: 'subl', args: (dir) => [dir] },
  atom: { command: 'atom', args: (dir) => [dir] },
  webstorm: { app: 'WebStorm', args: (dir) => [dir] },
  finder: { command: 'open', args: (dir) => [dir] },
};

// Check if a command exists in PATH
async function commandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const which = spawn('which', [command]);
    which.on('close', (code) => resolve(code === 0));
    which.on('error', () => resolve(false));
  });
}

// Check if a macOS app exists
async function appExists(appName: string): Promise<boolean> {
  const appPath = `/Applications/${appName}.app`;
  return new Promise((resolve) => {
    fs.access(appPath, fs.constants.F_OK, (err) => resolve(!err));
  });
}

// Helper to run git commands
function runGitCommand(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const git = spawn('git', args, { cwd });
    let stdout = '';
    let stderr = '';

    git.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    git.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    git.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `git command failed with code ${code}`));
      }
    });

    git.on('error', (err) => {
      reject(err);
    });
  });
}

// ============================================================================
// IPC Handlers Registration (called after app.whenReady())
// ============================================================================

function registerIpcHandlers(): void {
  // Database IPC handlers
  ipcMain.handle('canvas:save', async (_event, canvasId: string, state: CanvasState) => {
    try {
      await database.saveCanvas(canvasId, state);
      console.log('[Main] Canvas saved successfully', { canvasId });
      return { success: true };
    } catch (error) {
      console.error('[Main] Error saving canvas', { canvasId, error });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('canvas:load', async (_event, canvasId: string) => {
    try {
      const canvas = await database.loadCanvas(canvasId);
      console.log('[Main] Canvas loaded', { canvasId, found: !!canvas });
      return { success: true, data: canvas };
    } catch (error) {
      console.error('[Main] Error loading canvas', { canvasId, error });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('canvas:list', async () => {
    try {
      const canvases = await database.listCanvases();
      console.log('[Main] Listed canvases', { count: canvases.length });
      return { success: true, data: canvases };
    } catch (error) {
      console.error('[Main] Error listing canvases', { error });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('canvas:delete', async (_event, canvasId: string) => {
    try {
      await database.deleteCanvas(canvasId);
      console.log('[Main] Canvas deleted', { canvasId });
      return { success: true };
    } catch (error) {
      console.error('[Main] Error deleting canvas', { canvasId, error });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('canvas:get-current-id', async () => {
    try {
      const canvasId = await database.getCurrentCanvasId();
      console.log('[Main] Current canvas ID retrieved', { canvasId });
      return { success: true, data: canvasId };
    } catch (error) {
      console.error('[Main] Error getting current canvas ID', { error });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('canvas:set-current-id', async (_event, canvasId: string) => {
    try {
      await database.setCurrentCanvasId(canvasId);
      console.log('[Main] Current canvas ID set', { canvasId });
      return { success: true };
    } catch (error) {
      console.error('[Main] Error setting current canvas ID', { canvasId, error });
      return { success: false, error: (error as Error).message };
    }
  });

  // Agent Status IPC handlers
  ipcMain.handle(
    'agent-status:save',
    async (_event, agentId: string, state: CodingAgentState) => {
      try {
        await database.saveAgentStatus(agentId, state);
        console.log('[Main] Agent status saved', { agentId });
        return { success: true };
      } catch (error) {
        console.error('[Main] Error saving agent status', { agentId, error });
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // File reading API for debug mode
  ipcMain.handle('file:read', async (_event, filePath: string) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `File does not exist: ${filePath}` };
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      return { success: true, data: content };
    } catch (error: any) {
      console.error('[Main] Error reading file', { error, filePath });
      return { success: false, error: error.message || 'Unknown error' };
    }
  });

  // File existence check API
  ipcMain.handle('file:exists', async (_event, filePath: string) => {
    try {
      return { success: true, exists: fs.existsSync(filePath) };
    } catch (error: any) {
      console.error('[Main] Error checking file existence', { error, filePath });
      return { success: false, exists: false, error: error.message || 'Unknown error' };
    }
  });

  ipcMain.handle('agent-status:load', async (_event, agentId: string) => {
    try {
      const state = await database.loadAgentStatus(agentId);
      console.log('[Main] Agent status loaded', { agentId, found: !!state });
      return { success: true, data: state };
    } catch (error) {
      console.error('[Main] Error loading agent status', { agentId, error });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('agent-status:delete', async (_event, agentId: string) => {
    try {
      await database.deleteAgentStatus(agentId);
      console.log('[Main] Agent status deleted', { agentId });
      return { success: true };
    } catch (error) {
      console.error('[Main] Error deleting agent status', { agentId, error });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('agent-status:load-all', async () => {
    try {
      const states = await database.loadAllAgentStatuses();
      console.log('[Main] Loaded all agent statuses', { count: states.length });
      return { success: true, data: states };
    } catch (error) {
      console.error('[Main] Error loading all agent statuses', { error });
      return { success: false, error: (error as Error).message };
    }
  });

  // ============================================
  // Recent Workspaces IPC Handlers
  // ============================================

  ipcMain.handle(
    'recent-workspaces:add',
    async (_event, workspacePath: string, options?: AddWorkspaceOptions) => {
      try {
        const now = Date.now();
        const existing = await database.getRecentWorkspaceByPath(workspacePath);

        const workspace: RecentWorkspace = {
          path: workspacePath,
          name: options?.name || path.basename(workspacePath),
          lastOpenedAt: now,
          createdAt: existing?.createdAt || now,
        };

        await database.upsertRecentWorkspace(workspace);
        console.log('[Main] Recent workspace added/updated', { path: workspacePath });
        return { success: true };
      } catch (error) {
        console.error('[Main] Error adding recent workspace', { path: workspacePath, error });
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle('recent-workspaces:get', async (_event, limit?: number) => {
    try {
      const workspaces = await database.getRecentWorkspaces(limit);
      console.log('[Main] Retrieved recent workspaces', { count: workspaces.length });
      return { success: true, data: workspaces };
    } catch (error) {
      console.error('[Main] Error getting recent workspaces', { error });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('recent-workspaces:remove', async (_event, workspacePath: string) => {
    try {
      await database.removeRecentWorkspace(workspacePath);
      console.log('[Main] Recent workspace removed', { path: workspacePath });
      return { success: true };
    } catch (error) {
      console.error('[Main] Error removing recent workspace', { path: workspacePath, error });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('recent-workspaces:clear', async () => {
    try {
      await database.clearAllRecentWorkspaces();
      console.log('[Main] All recent workspaces cleared');
      return { success: true };
    } catch (error) {
      console.error('[Main] Error clearing recent workspaces', { error });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('recent-workspaces:has', async (_event, workspacePath: string) => {
    try {
      const workspace = await database.getRecentWorkspaceByPath(workspacePath);
      return { success: true, data: workspace !== null };
    } catch (error) {
      console.error('[Main] Error checking recent workspace', { path: workspacePath, error });
      return { success: false, error: (error as Error).message };
    }
  });

  // ============================================
  // Coding Agent IPC Handlers
  // ============================================

  ipcMain.handle(
    'coding-agent:generate',
    async (
      _event,
      agentType: CodingAgentType,
      request: GenerateRequest
    ) => {
      try {
        const agentResult = await CodingAgentFactory.getAgent(agentType);
        if (agentResult.success === false) {
          console.error('[Main] Error getting coding agent', { agentType, error: agentResult.error });
          return { success: false, error: agentResult.error.message };
        }

        ensureAgentEventBridge(agentResult.data);
        const result = await agentResult.data.generate(request);
        if (result.success === false) {
          console.error('[Main] Error generating response', { agentType, error: result.error });
          return { success: false, error: result.error.message };
        }

        console.log('[Main] Generated response', { agentType, contentLength: result.data.content.length });
        return { success: true, data: result.data };
      } catch (error) {
        console.error('[Main] Error in coding-agent:generate', { agentType, error });
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle(
    'coding-agent:continue-session',
    async (
      _event,
      agentType: CodingAgentType,
      identifier: SessionIdentifier,
      prompt: string,
      options?: ContinueOptions
    ) => {
      try {
        const agentResult = await CodingAgentFactory.getAgent(agentType);
        if (agentResult.success === false) {
          return { success: false, error: agentResult.error.message };
        }

        const agent = agentResult.data;
        ensureAgentEventBridge(agent);
        if (!isSessionResumable(agent)) {
          return { success: false, error: `${agentType} does not support session resumption` };
        }

        const result = await agent.continueSession(identifier, prompt, options);
        if (result.success === false) {
          console.error('[Main] Error continuing session', { agentType, error: result.error });
          return { success: false, error: result.error.message };
        }

        console.log('[Main] Continued session', { agentType, identifier });
        return { success: true, data: result.data };
      } catch (error) {
        console.error('[Main] Error in coding-agent:continue-session', { agentType, error });
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle(
    'coding-agent:continue-session-streaming',
    async (
      event,
      requestId: string,
      agentType: CodingAgentType,
      identifier: SessionIdentifier,
      prompt: string,
      options?: ContinueOptions
    ) => {
      const startTime = Date.now();
      let chunksSent = 0;
      let totalBytesSent = 0;

      console.log('[Main] Starting streaming session continuation', {
        requestId,
        agentType,
        promptPreview: prompt.slice(0, 100),
        promptLength: prompt.length,
        identifier,
        workingDirectory: options?.workingDirectory,
        timeout: options?.timeout,
      });

      try {
        const agentResult = await CodingAgentFactory.getAgent(agentType);
        if (agentResult.success === false) {
          console.error('[Main] Error getting coding agent', {
            requestId,
            agentType,
            error: agentResult.error,
          });
          return { success: false, error: agentResult.error.message };
        }

        const agent = agentResult.data;
        ensureAgentEventBridge(agent);
        if (!isSessionResumable(agent)) {
          return { success: false, error: `${agentType} does not support session resumption` };
        }

        const result = await agent.continueSessionStreaming(
          identifier,
          prompt,
          (chunk: string) => {
            chunksSent++;
            totalBytesSent += chunk.length;

            if (chunksSent === 1) {
              console.log('[Main] First chunk received from agent (continue)', {
                requestId,
                chunkLength: chunk.length,
                timeSinceStart: `${Date.now() - startTime}ms`,
              });
            }

            event.sender.send('coding-agent:stream-chunk', { requestId, chunk });
          },
          options
        );

        const duration = Date.now() - startTime;

        if (result.success === false) {
          console.error('[Main] Error continuing session with streaming', {
            requestId,
            agentType,
            error: result.error,
            durationMs: duration,
            chunksSent,
            totalBytesSent,
          });
          return { success: false, error: result.error.message };
        }

        console.log('[Main] Streaming session continuation complete', {
          requestId,
          agentType,
          contentLength: result.data.content.length,
          durationMs: duration,
          chunksSent,
          totalBytesSent,
        });
        return { success: true, data: result.data };
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error('[Main] Error in coding-agent:continue-session-streaming', {
          requestId,
          agentType,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          durationMs: duration,
          chunksSent,
          totalBytesSent,
        });
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle(
    'coding-agent:fork-session',
    async (
      _event,
      agentType: CodingAgentType,
      parentIdentifier: SessionIdentifier,
      options?: ForkOptions
    ) => {
      try {
        const agentResult = await CodingAgentFactory.getAgent(agentType);
        if (agentResult.success === false) {
          return { success: false, error: agentResult.error.message };
        }

        const agent = agentResult.data;
        ensureAgentEventBridge(agent);
        if (!isSessionForkable(agent)) {
          return { success: false, error: `${agentType} does not support session forking` };
        }

        const result = await agent.forkSession(parentIdentifier, options);
        if (result.success === false) {
          console.error('[Main] Error forking session', { agentType, error: result.error });
          return { success: false, error: result.error.message };
        }

        console.log('[Main] Forked session', { agentType, newSessionId: result.data.id });
        return { success: true, data: result.data };
      } catch (error) {
        console.error('[Main] Error in coding-agent:fork-session', { agentType, error });
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle('coding-agent:get-available', async () => {
    try {
      const available = await CodingAgentFactory.getAvailableAgents();
      console.log('[Main] Available coding agents', { agents: available });
      return { success: true, data: available };
    } catch (error) {
      console.error('[Main] Error getting available agents', { error });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle(
    'coding-agent:get-capabilities',
    async (_event, agentType: CodingAgentType) => {
      try {
        const agentResult = await CodingAgentFactory.getAgent(agentType);
        if (agentResult.success === false) {
          return { success: false, error: agentResult.error.message };
        }

        const capabilities = agentResult.data.getCapabilities();
        console.log('[Main] Agent capabilities', { agentType, capabilities });
        return { success: true, data: capabilities };
      } catch (error) {
        console.error('[Main] Error getting capabilities', { agentType, error });
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle(
    'coding-agent:is-available',
    async (_event, agentType: CodingAgentType) => {
      try {
        const available = await CodingAgentFactory.isAgentAvailable(agentType);
        return { success: true, data: available };
      } catch (error) {
        console.error('[Main] Error checking agent availability', { agentType, error });
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle(
    'coding-agent:list-session-summaries',
    async (_event, agentType: CodingAgentType, filter?: SessionFilterOptions) => {
      try {
        // Use skipCliVerification since chat history reads from filesystem, not CLI
        const agentResult = await CodingAgentFactory.getAgent(agentType, { skipCliVerification: true });
        if (agentResult.success === false) {
          return { success: false, error: agentResult.error.message };
        }

        const agent = agentResult.data;
        if (!isChatHistoryProvider(agent)) {
          return { success: false, error: `${agentType} does not support chat history retrieval` };
        }

        const result = await agent.listSessionSummaries(filter);
        if (result.success === false) {
          console.error('[Main] Error listing session summaries', { agentType, error: result.error });
          return { success: false, error: result.error.message };
        }

        console.log('[Main] Listed session summaries', { agentType, count: result.data.length });
        return { success: true, data: result.data };
      } catch (error) {
        console.error('[Main] Error in coding-agent:list-session-summaries', { agentType, error });
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle(
    'coding-agent:get-session',
    async (
      _event,
      agentType: CodingAgentType,
      sessionId: string,
      filter?: MessageFilterOptions
    ) => {
      try {
        // Use skipCliVerification since chat history reads from filesystem, not CLI
        const agentResult = await CodingAgentFactory.getAgent(agentType, { skipCliVerification: true });
        if (agentResult.success === false) {
          return { success: false, error: agentResult.error.message };
        }

        const agent = agentResult.data;
        if (!isChatHistoryProvider(agent)) {
          return { success: false, error: `${agentType} does not support chat history retrieval` };
        }

        const result = await agent.getFilteredSession(sessionId, filter);
        if (result.success === false) {
          console.error('[Main] Error getting session', { agentType, sessionId, error: result.error });
          return { success: false, error: result.error.message };
        }

        console.log('[Main] Got session', { agentType, sessionId, messageCount: result.data?.messages?.length ?? 0 });
        return { success: true, data: result.data };
      } catch (error) {
        console.error('[Main] Error in coding-agent:get-session', { agentType, sessionId, error });
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // Get the latest session for a workspace path
  ipcMain.handle(
    'coding-agent:get-latest-session',
    async (_event, agentType: CodingAgentType, workspacePath: string) => {
      try {
        // Use skipCliVerification since chat history reads from filesystem, not CLI
        const agentResult = await CodingAgentFactory.getAgent(agentType, { skipCliVerification: true });
        if (agentResult.success === false) {
          return { success: false, error: agentResult.error.message };
        }

        const agent = agentResult.data;
        if (!isChatHistoryProvider(agent)) {
          return { success: false, error: `${agentType} does not support chat history retrieval` };
        }

        const result = await agent.listSessionSummaries({ projectPath: workspacePath });
        if (result.success === false) {
          return { success: false, error: result.error.message };
        }

        if (!result.data.length) {
          console.log('[Main] No sessions found for workspace', { workspacePath });
          return { success: true, data: null };
        }

        const latestSession = [...result.data].sort((a, b) => {
          const aTime = new Date(a.updatedAt ?? a.timestamp ?? a.createdAt).getTime();
          const bTime = new Date(b.updatedAt ?? b.timestamp ?? b.createdAt).getTime();
          return bTime - aTime;
        })[0];

        console.log('[Main] Latest session found', { workspacePath, sessionId: latestSession.id });
        return { success: true, data: { id: latestSession.id, updatedAt: latestSession.updatedAt } };
      } catch (error) {
        console.error('[Main] Error getting latest session', { agentType, workspacePath, error });
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // Check if a session file exists (session is active)
  ipcMain.handle(
    'coding-agent:check-session-active',
    async (_event, agentType: CodingAgentType, sessionId: string, workspacePath: string) => {
      try {
        const agentResult = await CodingAgentFactory.getAgent(agentType, { skipCliVerification: true });
        if (agentResult.success === false) {
          return { success: false, error: agentResult.error.message };
        }

        const agent = agentResult.data;
        if (!isSessionValidator(agent)) {
          return { success: false, error: `${agentType} does not support session validation` };
        }

        const isActive = await agent.checkSessionActive(sessionId, workspacePath);
        return { success: true, data: isActive };
      } catch (error) {
        console.error('[Main] Error checking session active', { agentType, sessionId, workspacePath, error });
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // Streaming generation handler
  ipcMain.handle(
    'coding-agent:generate-streaming',
    async (
      event,
      requestId: string,
      agentType: CodingAgentType,
      request: GenerateRequest
    ) => {
      const startTime = Date.now();
      let chunksSent = 0;
      let totalBytesSent = 0;

      console.log('[Main] Starting streaming generation', {
        requestId,
        agentType,
        promptPreview: request.prompt.slice(0, 100),
        promptLength: request.prompt.length,
        workingDirectory: request.workingDirectory,
        timeout: request.timeout,
      });

      try {
        const agentResult = await CodingAgentFactory.getAgent(agentType);
        if (agentResult.success === false) {
          console.error('[Main] Error getting coding agent', {
            requestId,
            agentType,
            error: agentResult.error,
          });
          return { success: false, error: agentResult.error.message };
        }

        console.log('[Main] Agent acquired, starting generation', {
          requestId,
          agentType,
          timeSinceStart: `${Date.now() - startTime}ms`,
        });

        ensureAgentEventBridge(agentResult.data);
        const result = await agentResult.data.generateStreaming(request, (chunk: string) => {
          chunksSent++;
          totalBytesSent += chunk.length;

          if (chunksSent === 1) {
            console.log('[Main] First chunk received from agent', {
              requestId,
              chunkLength: chunk.length,
              timeSinceStart: `${Date.now() - startTime}ms`,
            });
          }

          // Send chunk to renderer
          event.sender.send('coding-agent:stream-chunk', { requestId, chunk });
        });

        const duration = Date.now() - startTime;

        if (result.success === false) {
          console.error('[Main] Error generating streaming response', {
            requestId,
            agentType,
            error: result.error,
            durationMs: duration,
            chunksSent,
            totalBytesSent,
          });
          return { success: false, error: result.error.message };
        }

        console.log('[Main] Streaming generation complete', {
          requestId,
          agentType,
          contentLength: result.data.content.length,
          durationMs: duration,
          chunksSent,
          totalBytesSent,
        });
        return { success: true, data: result.data };
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error('[Main] Error in coding-agent:generate-streaming', {
          requestId,
          agentType,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          durationMs: duration,
          chunksSent,
          totalBytesSent,
        });
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // ============================================
  // Representation Service IPC Handlers
  // ============================================

  ipcMain.handle('representation:get-available-types', async () => {
    try {
      const types = representationService.getAvailableTypes();
      console.log('[Main] Available representation types', { types });
      return { success: true, data: types };
    } catch (error) {
      console.error('[Main] Error getting available types', { error });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle(
    'representation:transform',
    async (_event, providerId: string, input: RepresentationInput) => {
      try {
        const result = await representationService.transform(providerId, input);
        if (!result.success) {
          return { success: false, error: result.error.message };
        }
        return { success: true, data: result.data };
      } catch (error) {
        console.error('[Main] Error in representation:transform', { providerId, error });
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle(
    'representation:transform-to-image',
    async (_event, input: RepresentationInput, options?: ImageTransformOptions) => {
      try {
        const result = await representationService.transformToImage(input, options);
        if (!result.success) {
          return { success: false, error: result.error.message };
        }
        return { success: true, data: result.data };
      } catch (error) {
        console.error('[Main] Error in representation:transform-to-image', { error });
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle(
    'representation:transform-to-summary',
    async (_event, input: RepresentationInput, options?: SummaryTransformOptions) => {
      try {
        const result = await representationService.transformToSummary(input, options);
        if (!result.success) {
          return { success: false, error: result.error.message };
        }
        return { success: true, data: result.data };
      } catch (error) {
        console.error('[Main] Error in representation:transform-to-summary', { error });
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle(
    'representation:transform-to-audio',
    async (_event, input: RepresentationInput, options?: AudioTransformOptions) => {
      try {
        const result = await representationService.transformToAudio(input, options);
        if (!result.success) {
          return { success: false, error: result.error.message };
        }
        return { success: true, data: result.data };
      } catch (error) {
        console.error('[Main] Error in representation:transform-to-audio', { error });
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle('representation:get-all-providers', async () => {
    try {
      const providers = representationService.getAllProviders().map((p) => ({
        providerId: p.providerId,
        providerName: p.providerName,
        representationType: p.representationType,
        capabilities: p.getCapabilities(),
      }));
      return { success: true, data: providers };
    } catch (error) {
      console.error('[Main] Error getting all providers', { error });
      return { success: false, error: (error as Error).message };
    }
  });

  // ============================================================================
  // Shell API handlers
  // ============================================================================

  ipcMain.handle('shell:open-with-editor', async (_event, directoryPath: string, editor: EditorApp) => {
    try {
      console.log('[Main] Opening directory with editor', { directoryPath, editor });

      // Verify directory exists
      if (!fs.existsSync(directoryPath)) {
        return { success: false, error: `Directory does not exist: ${directoryPath}` };
      }

      const config = EDITOR_COMMANDS[editor];
      if (!config) {
        return { success: false, error: `Unknown editor: ${editor}` };
      }

      // Special case for Finder
      if (editor === 'finder') {
        shell.openPath(directoryPath);
        return { success: true };
      }

      // Try command-line tool first
      if (config.command) {
        const exists = await commandExists(config.command);
        if (exists) {
          spawn(config.command, config.args(directoryPath), { detached: true, stdio: 'ignore' }).unref();
          return { success: true };
        }
      }

      // Fall back to opening the app directly (macOS)
      if (config.app) {
        const exists = await appExists(config.app);
        if (exists) {
          spawn('open', ['-a', config.app, directoryPath], { detached: true, stdio: 'ignore' }).unref();
          return { success: true };
        }
      }

      return { success: false, error: `Editor ${editor} is not installed or not found in PATH` };
    } catch (error) {
      console.error('[Main] Error opening with editor', { error });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('shell:get-available-editors', async () => {
    try {
      const available: EditorApp[] = [];

      for (const [editor, config] of Object.entries(EDITOR_COMMANDS) as [EditorApp, typeof EDITOR_COMMANDS[EditorApp]][]) {
        // Check command
        if (config.command) {
          const exists = await commandExists(config.command);
          if (exists) {
            available.push(editor);
            continue;
          }
        }

        // Check app (macOS)
        if (config.app) {
          const exists = await appExists(config.app);
          if (exists) {
            available.push(editor);
          }
        }
      }

      // Finder is always available on macOS
      if (!available.includes('finder')) {
        available.push('finder');
      }

      return { success: true, data: available };
    } catch (error) {
      console.error('[Main] Error getting available editors', { error });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('shell:show-in-folder', async (_event, filePath: string) => {
    try {
      shell.showItemInFolder(filePath);
      return { success: true };
    } catch (error) {
      console.error('[Main] Error showing in folder', { error });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('shell:open-directory-dialog', async (_event, options?: { title?: string; defaultPath?: string }) => {
    try {
      const result = await dialog.showOpenDialog({
        title: options?.title || 'Select Directory',
        defaultPath: options?.defaultPath || process.env.HOME,
        properties: ['openDirectory', 'createDirectory'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null };
      }

      return { success: true, data: result.filePaths[0] };
    } catch (error) {
      console.error('[Main] Error opening directory dialog', { error });
      return { success: false, error: (error as Error).message };
    }
  });

  // ============================================================================
  // Git API handlers
  // ============================================================================

  ipcMain.handle('git:list-branches', async (_event, workspacePath: string): Promise<{ success: boolean; data?: string[]; error?: string }> => {
    try {
      // Verify path exists and is a git repo
      if (!fs.existsSync(workspacePath)) {
        return { success: false, error: `Path does not exist: ${workspacePath}` };
      }

      // Get all local branches
      try {
        const branchesOutput = await runGitCommand(workspacePath, ['branch', '--format=%(refname:short)']);
        const branches = branchesOutput
          .split('\n')
          .map((b) => b.trim())
          .filter((b) => b.length > 0);

        console.log('[Main] Branches retrieved', { workspacePath, branches });
        return { success: true, data: branches };
      } catch {
        return { success: false, error: 'Not a git repository' };
      }
    } catch (error) {
      console.error('[Main] Error listing branches', { workspacePath, error });
      return { success: false, error: (error as Error).message };
    }
  });

  // Git info handler - throws if not a git repository
  ipcMain.handle('git:get-info-strict', async (_event, workspacePath: string): Promise<GitInfo> => {
    // This throws if not a git repo - let the error propagate
    return gitBranchService.getGitInfo(workspacePath);
  });

  console.log('[Main] IPC handlers registered successfully');
}

ipcMain.handle('git:create-branch', async (_event, workspacePath: string, branchName: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Verify path exists and is a git repo
    if (!fs.existsSync(workspacePath)) {
      return { success: false, error: `Path does not exist: ${workspacePath}` };
    }

    // Validate branch name
    if (!branchName || !branchName.trim()) {
      return { success: false, error: 'Branch name is required' };
    }

    // Sanitize branch name (remove invalid characters)
    const sanitizedBranchName = branchName.trim().replace(/[^a-zA-Z0-9._/-]/g, '-');
    if (!sanitizedBranchName) {
      return { success: false, error: 'Invalid branch name' };
    }

    try {
      // Create and checkout the new branch
      await runGitCommand(workspacePath, ['checkout', '-b', sanitizedBranchName]);
      console.log('[Main] Branch created and checked out', { workspacePath, branchName: sanitizedBranchName });
      return { success: true };
    } catch (error) {
      const errorMessage = (error as Error).message;
      // Check if branch already exists
      if (errorMessage.includes('already exists')) {
        // Try to checkout the existing branch instead
        try {
          await runGitCommand(workspacePath, ['checkout', sanitizedBranchName]);
          console.log('[Main] Branch already exists, checked out existing branch', { workspacePath, branchName: sanitizedBranchName });
          return { success: true };
        } catch (checkoutError) {
          return { success: false, error: (checkoutError as Error).message };
        }
      }
      return { success: false, error: errorMessage };
    }
  } catch (error) {
    console.error('[Main] Error creating branch', { workspacePath, branchName, error });
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('git:checkout-branch', async (_event, workspacePath: string, branchName: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Verify path exists and is a git repo
    if (!fs.existsSync(workspacePath)) {
      return { success: false, error: `Path does not exist: ${workspacePath}` };
    }

    // Validate branch name
    if (!branchName || !branchName.trim()) {
      return { success: false, error: 'Branch name is required' };
    }

    try {
      // Checkout the branch
      await runGitCommand(workspacePath, ['checkout', branchName.trim()]);
      console.log('[Main] Branch checked out', { workspacePath, branchName });
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  } catch (error) {
    console.error('[Main] Error checking out branch', { workspacePath, branchName, error });
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('git:get-github-username', async (): Promise<{ success: boolean; data?: { username: string }; error?: string }> => {
  try {
    const gh = spawn('gh', ['api', 'user', '--jq', '.login'], { shell: true });
    let stdout = '';
    let stderr = '';

    gh.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    gh.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const username = await new Promise<string>((resolve, reject) => {
      gh.on('close', (code) => {
        if (code === 0) {
          const trimmed = stdout.trim();
          if (trimmed) {
            resolve(trimmed);
          } else {
            reject(new Error('GitHub CLI returned empty username'));
          }
        } else {
          reject(new Error(stderr.trim() || `GitHub CLI failed with code ${code}`));
        }
      });
      gh.on('error', (err) => {
        reject(new Error(`Failed to execute GitHub CLI: ${err.message}`));
      });
    });

    if (username) {
      console.log('[Main] GitHub username retrieved:', username);
      return { success: true, data: { username } };
    }

    return { success: false, error: 'Could not determine GitHub username' };
  } catch (error) {
    console.error('[Main] Error getting GitHub username', { error });
    return { success: false, error: (error as Error).message };
  }
});

app.whenReady().then(async () => {
  console.log('[Main] App ready');

  // Register all IPC handlers (must be after app ready for ipcMain)
  registerIpcHandlers();
  registerAgentActionHandlers();

  // Initialize database
  try {
    database = await DatabaseFactory.getDatabase('sqlite');
    console.log('[Main] Database initialized successfully');
  } catch (error) {
    console.error('[Main] Error initializing database', error);
    // Continue without database - app should still function
  }

  // Initialize WorktreeManager
  try {
    const worktreeBaseDir = path.join(app.getPath('userData'), 'worktrees');
    WorktreeManagerFactory.configure({
      baseWorktreeDirectory: worktreeBaseDir,
    });
    await WorktreeManagerFactory.getManager();
    registerWorktreeIpcHandlers();
    console.log('[Main] WorktreeManager initialized successfully');
  } catch (error) {
    console.error('[Main] Error initializing WorktreeManager', error);
    // Continue without worktree manager - app should still function
  }

  // Initialize LLM Service
  try {
    LLMServiceFactory.configure(DEFAULT_LLM_CONFIG);
    await LLMServiceFactory.getService();
    registerLLMIpcHandlers();
    console.log('[Main] LLM Service initialized successfully');
  } catch (error) {
    console.error('[Main] Error initializing LLM Service', error);
    // Continue without LLM service - app should still function
  }

  // Initialize RepresentationService
  try {
    const initResult = await representationService.initialize();
    if (initResult.success) {
      console.log('[Main] RepresentationService initialized successfully');
    } else {
      console.error('[Main] Error initializing RepresentationService', initResult.error);
    }
  } catch (error) {
    console.error('[Main] Error initializing RepresentationService', error);
    // Continue without representation service - app should still function
  }

  createWindow();
});

// Clean up on app quit
app.on('will-quit', async () => {
  console.log('[Main] App quitting, closing database, worktree manager, coding agents, LLM service, session watcher, and representation service');
  DatabaseFactory.closeDatabase();
  WorktreeManagerFactory.closeManager();
  disposeSessionWatcher();
  await CodingAgentFactory.disposeAll();
  await LLMServiceFactory.dispose();
  await representationService.dispose();
});

import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import * as pty from 'node-pty';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import * as fs from 'fs';
import { DatabaseFactory } from './database';
import { IDatabase } from './database/IDatabase';
import { CanvasState } from './types/database';
import { WorktreeManagerFactory } from './worktree';
import { registerWorktreeIpcHandlers } from './worktree/ipc';
import type { CodingAgentState } from '../../types/coding-agent-status';
import type { GitInfo } from '@agent-orchestrator/shared';
import {
  CodingAgentFactory,
  isSessionResumable,
  isSessionForkable,
} from './services/coding-agent';
import type {
  CodingAgentType,
  GenerateRequest,
  SessionIdentifier,
  ForkOptions,
  ContinueOptions,
} from './services/coding-agent';
import {
  LLMServiceFactory,
  registerLLMIpcHandlers,
  DEFAULT_LLM_CONFIG,
} from './services/llm';
import {
  RepresentationService,
  type RepresentationInput,
  type ImageTransformOptions,
  type SummaryTransformOptions,
  type AudioTransformOptions,
  type ILogger,
  type IIdGenerator,
} from './services/representation';

// Map to store terminal instances by ID
const terminalProcesses = new Map<string, pty.IPty>();

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

const createWindow = (): void => {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
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

    // Handle shell data - send to renderer via IPC with terminal ID
    ptyProcess.onData((data: string) => {
      // Don't log every piece of data - too verbose (logs every terminal output)
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
    } else {
      console.log('[Main] ⚠️ Terminal destroy requested but process not found', { terminalId });
    }
  });

  // Clean up all terminals when window closes
  win.on('closed', () => {
    console.log('[Main] Window closed');
    terminalProcesses.forEach((ptyProcess) => {
      ptyProcess.kill();
    });
    terminalProcesses.clear();
  });
};

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
// Recent Workspaces API handlers
// ============================================================================

ipcMain.handle(
  'workspace:track-recent',
  async (
    _event,
    path: string,
    name: string,
    gitInfo?: { branch?: string; remote?: string }
  ) => {
    try {
      await database.trackRecentWorkspace(path, name, gitInfo);
      return { success: true };
    } catch (error) {
      console.error('[Main] Error tracking recent workspace', { path, error });
      return { success: false, error: (error as Error).message };
    }
  }
);

ipcMain.handle('workspace:get-recent', async (_event, limit?: number) => {
  try {
    const workspaces = await database.getRecentWorkspaces(limit);
    return { success: true, data: workspaces };
  } catch (error) {
    console.error('[Main] Error getting recent workspaces', { error });
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('workspace:remove-recent', async (_event, path: string) => {
  try {
    await database.removeRecentWorkspace(path);
    return { success: true };
  } catch (error) {
    console.error('[Main] Error removing recent workspace', { path, error });
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('git:get-info', async (_event, workspacePath: string): Promise<{ success: boolean; data?: GitInfo; error?: string }> => {
  try {
    // Verify path exists and is a git repo
    if (!fs.existsSync(workspacePath)) {
      return { success: false, error: `Path does not exist: ${workspacePath}` };
    }

    // Get current branch
    let branch: string;
    try {
      branch = await runGitCommand(workspacePath, ['rev-parse', '--abbrev-ref', 'HEAD']);
    } catch {
      // Not a git repo or detached HEAD
      return { success: false, error: 'Not a git repository' };
    }

    // Get remote (if any)
    let remote: string | undefined;
    try {
      remote = await runGitCommand(workspacePath, ['config', '--get', `branch.${branch}.remote`]);
    } catch {
      // No remote configured
      remote = undefined;
    }

    // Get status (clean/dirty)
    let status: 'clean' | 'dirty' | 'unknown' = 'unknown';
    try {
      const statusOutput = await runGitCommand(workspacePath, ['status', '--porcelain']);
      status = statusOutput.length === 0 ? 'clean' : 'dirty';
    } catch {
      status = 'unknown';
    }

    // Get ahead/behind counts
    let ahead = 0;
    let behind = 0;
    if (remote) {
      try {
        const revList = await runGitCommand(workspacePath, [
          'rev-list',
          '--left-right',
          '--count',
          `${remote}/${branch}...HEAD`,
        ]);
        const [behindStr, aheadStr] = revList.split('\t');
        behind = parseInt(behindStr, 10) || 0;
        ahead = parseInt(aheadStr, 10) || 0;
      } catch {
        // Remote branch might not exist
      }
    }

    const gitInfo: GitInfo = {
      branch,
      remote,
      status,
      ahead,
      behind,
    };

    console.log('[Main] Git info retrieved', { workspacePath, gitInfo });
    return { success: true, data: gitInfo };
  } catch (error) {
    console.error('[Main] Error getting git info', { workspacePath, error });
    return { success: false, error: (error as Error).message };
  }
});

app.whenReady().then(async () => {
  console.log('[Main] App ready');

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
  console.log('[Main] App quitting, closing database, worktree manager, coding agents, LLM service, and representation service');
  DatabaseFactory.closeDatabase();
  WorktreeManagerFactory.closeManager();
  await CodingAgentFactory.disposeAll();
  await LLMServiceFactory.dispose();
  await representationService.dispose();
});


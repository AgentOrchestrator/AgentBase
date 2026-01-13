"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const pty = __importStar(require("node-pty"));
const path = __importStar(require("path"));
const database_1 = require("./database");
const worktree_1 = require("./worktree");
const ipc_1 = require("./worktree/ipc");
const coding_agent_1 = require("./services/coding-agent");
// Map to store terminal instances by ID
const terminalProcesses = new Map();
// Database instance
let database;
const createWindow = () => {
    const win = new electron_1.BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    // Load from Vite dev server in development, otherwise load from dist
    if (process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged) {
        const devServerPort = process.env.VITE_DEV_SERVER_PORT || '5173';
        const devServerUrl = `http://localhost:${devServerPort}`;
        console.log('[Main] Loading from dev server:', devServerUrl);
        win.loadURL(devServerUrl);
        // Open DevTools in development
        win.webContents.openDevTools();
    }
    else {
        win.loadFile(path.join(__dirname, './dist/index.html'));
    }
    // Track terminals being created to prevent race conditions
    const terminalsBeingCreated = new Set();
    const terminalCreationTimes = new Map();
    // Create a new terminal instance
    electron_1.ipcMain.on('terminal-create', (event, terminalId) => {
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
        // Don't use -i (interactive) or -l (login) flags as they can cause immediate exits
        // Just spawn the shell normally - node-pty handles the TTY connection
        const shellArgs = [];
        const ptyProcess = pty.spawn(shell, shellArgs, {
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
            }
        });
        // Add to map immediately after creation to prevent duplicates
        terminalProcesses.set(terminalId, ptyProcess);
        // Remove from "being created" set
        terminalsBeingCreated.delete(terminalId);
        // Log terminal creation for debugging
        console.log('[Main] ✅ Terminal created successfully', { terminalId, shell, shellArgs });
        // Handle shell data - send to renderer via IPC with terminal ID
        ptyProcess.onData((data) => {
            // Don't log every piece of data - too verbose (logs every terminal output)
            // Check if window is still valid before sending
            if (!win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
                win.webContents.send('terminal-data', { terminalId, data });
            }
        });
        // Handle shell exit
        ptyProcess.onExit((exitInfo) => {
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
    let lastResizeLog = {};
    electron_1.ipcMain.on('terminal-resize', (_event, { terminalId, cols, rows }) => {
        const ptyProcess = terminalProcesses.get(terminalId);
        if (ptyProcess) {
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
    electron_1.ipcMain.on('terminal-input', (_event, { terminalId, data }) => {
        // Don't log every input - too verbose (logs every keystroke)
        const ptyProcess = terminalProcesses.get(terminalId);
        if (ptyProcess) {
            ptyProcess.write(data);
        }
    });
    // Handle terminal destroy
    electron_1.ipcMain.on('terminal-destroy', (event, terminalId) => {
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
        }
        else {
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
electron_1.ipcMain.handle('canvas:save', async (_event, canvasId, state) => {
    try {
        await database.saveCanvas(canvasId, state);
        console.log('[Main] Canvas saved successfully', { canvasId });
        return { success: true };
    }
    catch (error) {
        console.error('[Main] Error saving canvas', { canvasId, error });
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('canvas:load', async (_event, canvasId) => {
    try {
        const canvas = await database.loadCanvas(canvasId);
        console.log('[Main] Canvas loaded', { canvasId, found: !!canvas });
        return { success: true, data: canvas };
    }
    catch (error) {
        console.error('[Main] Error loading canvas', { canvasId, error });
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('canvas:list', async () => {
    try {
        const canvases = await database.listCanvases();
        console.log('[Main] Listed canvases', { count: canvases.length });
        return { success: true, data: canvases };
    }
    catch (error) {
        console.error('[Main] Error listing canvases', { error });
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('canvas:delete', async (_event, canvasId) => {
    try {
        await database.deleteCanvas(canvasId);
        console.log('[Main] Canvas deleted', { canvasId });
        return { success: true };
    }
    catch (error) {
        console.error('[Main] Error deleting canvas', { canvasId, error });
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('canvas:get-current-id', async () => {
    try {
        const canvasId = await database.getCurrentCanvasId();
        console.log('[Main] Current canvas ID retrieved', { canvasId });
        return { success: true, data: canvasId };
    }
    catch (error) {
        console.error('[Main] Error getting current canvas ID', { error });
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('canvas:set-current-id', async (_event, canvasId) => {
    try {
        await database.setCurrentCanvasId(canvasId);
        console.log('[Main] Current canvas ID set', { canvasId });
        return { success: true };
    }
    catch (error) {
        console.error('[Main] Error setting current canvas ID', { canvasId, error });
        return { success: false, error: error.message };
    }
});
// Agent Status IPC handlers
electron_1.ipcMain.handle('agent-status:save', async (_event, agentId, state) => {
    try {
        await database.saveAgentStatus(agentId, state);
        console.log('[Main] Agent status saved', { agentId });
        return { success: true };
    }
    catch (error) {
        console.error('[Main] Error saving agent status', { agentId, error });
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('agent-status:load', async (_event, agentId) => {
    try {
        const state = await database.loadAgentStatus(agentId);
        console.log('[Main] Agent status loaded', { agentId, found: !!state });
        return { success: true, data: state };
    }
    catch (error) {
        console.error('[Main] Error loading agent status', { agentId, error });
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('agent-status:delete', async (_event, agentId) => {
    try {
        await database.deleteAgentStatus(agentId);
        console.log('[Main] Agent status deleted', { agentId });
        return { success: true };
    }
    catch (error) {
        console.error('[Main] Error deleting agent status', { agentId, error });
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('agent-status:load-all', async () => {
    try {
        const states = await database.loadAllAgentStatuses();
        console.log('[Main] Loaded all agent statuses', { count: states.length });
        return { success: true, data: states };
    }
    catch (error) {
        console.error('[Main] Error loading all agent statuses', { error });
        return { success: false, error: error.message };
    }
});
// ============================================
// Coding Agent IPC Handlers
// ============================================
electron_1.ipcMain.handle('coding-agent:generate', async (_event, agentType, request) => {
    try {
        const agentResult = await coding_agent_1.CodingAgentFactory.getAgent(agentType);
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
    }
    catch (error) {
        console.error('[Main] Error in coding-agent:generate', { agentType, error });
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('coding-agent:continue-session', async (_event, agentType, identifier, prompt, options) => {
    try {
        const agentResult = await coding_agent_1.CodingAgentFactory.getAgent(agentType);
        if (agentResult.success === false) {
            return { success: false, error: agentResult.error.message };
        }
        const agent = agentResult.data;
        if (!(0, coding_agent_1.isSessionResumable)(agent)) {
            return { success: false, error: `${agentType} does not support session resumption` };
        }
        const result = await agent.continueSession(identifier, prompt, options);
        if (result.success === false) {
            console.error('[Main] Error continuing session', { agentType, error: result.error });
            return { success: false, error: result.error.message };
        }
        console.log('[Main] Continued session', { agentType, identifier });
        return { success: true, data: result.data };
    }
    catch (error) {
        console.error('[Main] Error in coding-agent:continue-session', { agentType, error });
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('coding-agent:fork-session', async (_event, agentType, parentIdentifier, options) => {
    try {
        const agentResult = await coding_agent_1.CodingAgentFactory.getAgent(agentType);
        if (agentResult.success === false) {
            return { success: false, error: agentResult.error.message };
        }
        const agent = agentResult.data;
        if (!(0, coding_agent_1.isSessionForkable)(agent)) {
            return { success: false, error: `${agentType} does not support session forking` };
        }
        const result = await agent.forkSession(parentIdentifier, options);
        if (result.success === false) {
            console.error('[Main] Error forking session', { agentType, error: result.error });
            return { success: false, error: result.error.message };
        }
        console.log('[Main] Forked session', { agentType, newSessionId: result.data.id });
        return { success: true, data: result.data };
    }
    catch (error) {
        console.error('[Main] Error in coding-agent:fork-session', { agentType, error });
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('coding-agent:get-available', async () => {
    try {
        const available = await coding_agent_1.CodingAgentFactory.getAvailableAgents();
        console.log('[Main] Available coding agents', { agents: available });
        return { success: true, data: available };
    }
    catch (error) {
        console.error('[Main] Error getting available agents', { error });
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('coding-agent:get-capabilities', async (_event, agentType) => {
    try {
        const agentResult = await coding_agent_1.CodingAgentFactory.getAgent(agentType);
        if (agentResult.success === false) {
            return { success: false, error: agentResult.error.message };
        }
        const capabilities = agentResult.data.getCapabilities();
        console.log('[Main] Agent capabilities', { agentType, capabilities });
        return { success: true, data: capabilities };
    }
    catch (error) {
        console.error('[Main] Error getting capabilities', { agentType, error });
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('coding-agent:is-available', async (_event, agentType) => {
    try {
        const available = await coding_agent_1.CodingAgentFactory.isAgentAvailable(agentType);
        return { success: true, data: available };
    }
    catch (error) {
        console.error('[Main] Error checking agent availability', { agentType, error });
        return { success: false, error: error.message };
    }
});
electron_1.app.whenReady().then(async () => {
    console.log('[Main] App ready');
    // Initialize database
    try {
        database = await database_1.DatabaseFactory.getDatabase('sqlite');
        console.log('[Main] Database initialized successfully');
    }
    catch (error) {
        console.error('[Main] Error initializing database', error);
        // Continue without database - app should still function
    }
    // Initialize WorktreeManager
    try {
        const worktreeBaseDir = path.join(electron_1.app.getPath('userData'), 'worktrees');
        worktree_1.WorktreeManagerFactory.configure({
            baseWorktreeDirectory: worktreeBaseDir,
        });
        await worktree_1.WorktreeManagerFactory.getManager();
        (0, ipc_1.registerWorktreeIpcHandlers)();
        console.log('[Main] WorktreeManager initialized successfully');
    }
    catch (error) {
        console.error('[Main] Error initializing WorktreeManager', error);
        // Continue without worktree manager - app should still function
    }
    createWindow();
});
// Clean up on app quit
electron_1.app.on('will-quit', async () => {
    console.log('[Main] App quitting, closing database, worktree manager, and coding agents');
    database_1.DatabaseFactory.closeDatabase();
    worktree_1.WorktreeManagerFactory.closeManager();
    await coding_agent_1.CodingAgentFactory.disposeAll();
});

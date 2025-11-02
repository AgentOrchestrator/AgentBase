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
// Map to store terminal instances by ID
const terminalProcesses = new Map();
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
        win.loadURL('http://localhost:5173');
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
            win.webContents.send('terminal-data', { terminalId, data });
        });
        // Handle shell exit
        ptyProcess.onExit((exitInfo) => {
            console.log('[Main] Terminal exited', { terminalId, exitInfo });
            win.webContents.send('terminal-exit', {
                terminalId,
                code: exitInfo.exitCode,
                signal: exitInfo.signal
            });
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
electron_1.app.whenReady().then(() => {
    console.log('[Main] App ready');
    createWindow();
});

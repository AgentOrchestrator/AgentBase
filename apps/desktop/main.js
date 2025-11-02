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
    // Create a new terminal instance
    electron_1.ipcMain.on('terminal-create', (event, terminalId) => {
        // If terminal already exists, check if it's still alive
        const existingProcess = terminalProcesses.get(terminalId);
        if (existingProcess) {
            // Check if process is still running (pty processes don't have a direct way to check)
            // We'll try to write a null byte to check, but for now just return
            // The exit handler will clean it up, so we can recreate
            return;
        }
        const shell = process.platform === 'win32' ? 'cmd.exe' : process.env.SHELL || '/bin/bash';
        const shellArgs = process.platform === 'win32'
            ? []
            : ['-i']; // Use interactive shell to ensure it stays open
        const ptyProcess = pty.spawn(shell, shellArgs, {
            name: 'xterm-256color',
            cols: 80,
            rows: 30,
            cwd: process.env.HOME || process.cwd(),
            env: {
                ...process.env,
                TERM: 'xterm-256color',
                COLORTERM: 'truecolor'
            }
        });
        // Handle shell data - send to renderer via IPC with terminal ID
        ptyProcess.onData((data) => {
            win.webContents.send('terminal-data', { terminalId, data });
        });
        // Handle shell exit
        ptyProcess.onExit((exitInfo) => {
            win.webContents.send('terminal-exit', {
                terminalId,
                code: exitInfo.exitCode,
                signal: exitInfo.signal
            });
            // Remove from map when process exits so it can be recreated
            terminalProcesses.delete(terminalId);
        });
        terminalProcesses.set(terminalId, ptyProcess);
    });
    // Handle resize from renderer
    electron_1.ipcMain.on('terminal-resize', (_event, { terminalId, cols, rows }) => {
        const ptyProcess = terminalProcesses.get(terminalId);
        if (ptyProcess) {
            ptyProcess.resize(cols, rows);
        }
    });
    // Handle input from renderer
    electron_1.ipcMain.on('terminal-input', (_event, { terminalId, data }) => {
        const ptyProcess = terminalProcesses.get(terminalId);
        if (ptyProcess) {
            ptyProcess.write(data);
        }
    });
    // Handle terminal destroy
    electron_1.ipcMain.on('terminal-destroy', (_event, terminalId) => {
        const ptyProcess = terminalProcesses.get(terminalId);
        if (ptyProcess) {
            ptyProcess.kill();
            terminalProcesses.delete(terminalId);
        }
    });
    // Clean up all terminals when window closes
    win.on('closed', () => {
        terminalProcesses.forEach((ptyProcess) => {
            ptyProcess.kill();
        });
        terminalProcesses.clear();
    });
};
electron_1.app.whenReady().then(() => {
    createWindow();
});

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
    // Initialize and spawn shell
    const ptyProcess = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : process.env.SHELL || '/bin/bash', [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME || process.cwd(),
        env: process.env
    });
    // Handle shell data - send to renderer via IPC
    ptyProcess.onData((data) => {
        win.webContents.send('terminal-data', data);
    });
    // Handle shell exit
    ptyProcess.onExit((exitInfo) => {
        win.webContents.send('terminal-exit', { code: exitInfo.exitCode, signal: exitInfo.signal });
    });
    // Handle resize from renderer
    electron_1.ipcMain.on('terminal-resize', (_event, { cols, rows }) => {
        ptyProcess.resize(cols, rows);
    });
    // Handle input from renderer
    electron_1.ipcMain.on('terminal-input', (_event, data) => {
        ptyProcess.write(data);
    });
    // Get initial terminal size based on window size
    win.on('resize', () => {
        const { width, height } = win.getContentBounds();
        // Approximate cols/rows (rough calculation)
        const cols = Math.floor((width - 40) / 9);
        const rows = Math.floor((height - 40) / 17);
        ptyProcess.resize(Math.max(cols, 10), Math.max(rows, 10));
    });
};
electron_1.app.whenReady().then(() => {
    createWindow();
});

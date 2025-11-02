"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    onTerminalData: (callback) => {
        electron_1.ipcRenderer.on('terminal-data', (_event, data) => callback(data));
    },
    onTerminalExit: (callback) => {
        electron_1.ipcRenderer.on('terminal-exit', (_event, data) => callback(data));
    },
    sendTerminalInput: (data) => {
        electron_1.ipcRenderer.send('terminal-input', data);
    },
    sendTerminalResize: (cols, rows) => {
        electron_1.ipcRenderer.send('terminal-resize', { cols, rows });
    },
    removeAllListeners: (channel) => {
        electron_1.ipcRenderer.removeAllListeners(channel);
    }
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    createTerminal: (terminalId) => {
        electron_1.ipcRenderer.send('terminal-create', terminalId);
    },
    onTerminalData: (callback) => {
        electron_1.ipcRenderer.on('terminal-data', (_event, data) => callback(data));
    },
    onTerminalExit: (callback) => {
        electron_1.ipcRenderer.on('terminal-exit', (_event, data) => callback(data));
    },
    sendTerminalInput: (terminalId, data) => {
        electron_1.ipcRenderer.send('terminal-input', { terminalId, data });
    },
    sendTerminalResize: (terminalId, cols, rows) => {
        electron_1.ipcRenderer.send('terminal-resize', { terminalId, cols, rows });
    },
    destroyTerminal: (terminalId) => {
        electron_1.ipcRenderer.send('terminal-destroy', terminalId);
    },
    removeAllListeners: (channel) => {
        electron_1.ipcRenderer.removeAllListeners(channel);
    }
});

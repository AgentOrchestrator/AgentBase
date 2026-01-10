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
async function unwrapResponse(promise) {
    const response = await promise;
    if (!response.success) {
        throw new Error(response.error || 'Unknown error');
    }
    return response.data;
}
// Expose canvas persistence API
electron_1.contextBridge.exposeInMainWorld('canvasAPI', {
    saveCanvas: async (canvasId, state) => {
        await unwrapResponse(electron_1.ipcRenderer.invoke('canvas:save', canvasId, state));
    },
    loadCanvas: (canvasId) => unwrapResponse(electron_1.ipcRenderer.invoke('canvas:load', canvasId)),
    listCanvases: () => unwrapResponse(electron_1.ipcRenderer.invoke('canvas:list')),
    deleteCanvas: async (canvasId) => {
        await unwrapResponse(electron_1.ipcRenderer.invoke('canvas:delete', canvasId));
    },
    getCurrentCanvasId: () => unwrapResponse(electron_1.ipcRenderer.invoke('canvas:get-current-id')),
    setCurrentCanvasId: async (canvasId) => {
        await unwrapResponse(electron_1.ipcRenderer.invoke('canvas:set-current-id', canvasId));
    },
});

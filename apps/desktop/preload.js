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
// Expose worktree API
electron_1.contextBridge.exposeInMainWorld('worktreeAPI', {
    provision: (repoPath, branchName, options) => unwrapResponse(electron_1.ipcRenderer.invoke('worktree:provision', repoPath, branchName, options)),
    release: async (worktreeId, options) => {
        await unwrapResponse(electron_1.ipcRenderer.invoke('worktree:release', worktreeId, options));
    },
    get: (worktreeId) => unwrapResponse(electron_1.ipcRenderer.invoke('worktree:get', worktreeId)),
    list: (repoPath) => unwrapResponse(electron_1.ipcRenderer.invoke('worktree:list', repoPath)),
});
// Expose agent status API
electron_1.contextBridge.exposeInMainWorld('agentStatusAPI', {
    saveAgentStatus: async (agentId, state) => {
        await unwrapResponse(electron_1.ipcRenderer.invoke('agent-status:save', agentId, state));
    },
    loadAgentStatus: (agentId) => unwrapResponse(electron_1.ipcRenderer.invoke('agent-status:load', agentId)),
    deleteAgentStatus: async (agentId) => {
        await unwrapResponse(electron_1.ipcRenderer.invoke('agent-status:delete', agentId));
    },
    loadAllAgentStatuses: () => unwrapResponse(electron_1.ipcRenderer.invoke('agent-status:load-all')),
});
// Expose coding agent API
electron_1.contextBridge.exposeInMainWorld('codingAgentAPI', {
    generate: (agentType, request) => unwrapResponse(electron_1.ipcRenderer.invoke('coding-agent:generate', agentType, request)),
    continueSession: (agentType, identifier, prompt, options) => unwrapResponse(electron_1.ipcRenderer.invoke('coding-agent:continue-session', agentType, identifier, prompt, options)),
    forkSession: (agentType, parentIdentifier, options) => unwrapResponse(electron_1.ipcRenderer.invoke('coding-agent:fork-session', agentType, parentIdentifier, options)),
    getAvailableAgents: () => unwrapResponse(electron_1.ipcRenderer.invoke('coding-agent:get-available')),
    getCapabilities: (agentType) => unwrapResponse(electron_1.ipcRenderer.invoke('coding-agent:get-capabilities', agentType)),
    isAgentAvailable: (agentType) => unwrapResponse(electron_1.ipcRenderer.invoke('coding-agent:is-available', agentType)),
});

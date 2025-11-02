import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for the electron API
export interface ElectronAPI {
  createTerminal: (terminalId: string) => void;
  onTerminalData: (callback: (data: { terminalId: string; data: string }) => void) => void;
  onTerminalExit: (callback: (data: { terminalId: string; code: number; signal?: number }) => void) => void;
  sendTerminalInput: (terminalId: string, data: string) => void;
  sendTerminalResize: (terminalId: string, cols: number, rows: number) => void;
  destroyTerminal: (terminalId: string) => void;
  removeAllListeners: (channel: string) => void;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  createTerminal: (terminalId: string) => {
    ipcRenderer.send('terminal-create', terminalId);
  },
  onTerminalData: (callback: (data: { terminalId: string; data: string }) => void) => {
    ipcRenderer.on('terminal-data', (_event, data: { terminalId: string; data: string }) => callback(data));
  },
  onTerminalExit: (callback: (data: { terminalId: string; code: number; signal?: number }) => void) => {
    ipcRenderer.on('terminal-exit', (_event, data: { terminalId: string; code: number; signal?: number }) => callback(data));
  },
  sendTerminalInput: (terminalId: string, data: string) => {
    ipcRenderer.send('terminal-input', { terminalId, data });
  },
  sendTerminalResize: (terminalId: string, cols: number, rows: number) => {
    ipcRenderer.send('terminal-resize', { terminalId, cols, rows });
  },
  destroyTerminal: (terminalId: string) => {
    ipcRenderer.send('terminal-destroy', terminalId);
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
} as ElectronAPI);


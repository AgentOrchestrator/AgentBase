import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for the electron API
export interface ElectronAPI {
  onTerminalData: (callback: (data: string) => void) => void;
  onTerminalExit: (callback: (data: { code: number; signal?: number }) => void) => void;
  sendTerminalInput: (data: string) => void;
  sendTerminalResize: (cols: number, rows: number) => void;
  removeAllListeners: (channel: string) => void;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  onTerminalData: (callback: (data: string) => void) => {
    ipcRenderer.on('terminal-data', (_event, data: string) => callback(data));
  },
  onTerminalExit: (callback: (data: { code: number; signal?: number }) => void) => {
    ipcRenderer.on('terminal-exit', (_event, data: { code: number; signal?: number }) => callback(data));
  },
  sendTerminalInput: (data: string) => {
    ipcRenderer.send('terminal-input', data);
  },
  sendTerminalResize: (cols: number, rows: number) => {
    ipcRenderer.send('terminal-resize', { cols, rows });
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
} as ElectronAPI);


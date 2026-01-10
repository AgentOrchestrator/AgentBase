import { contextBridge, ipcRenderer } from 'electron';
import type { CanvasState, CanvasMetadata } from './types/database';

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

// Type definitions for the canvas API
export interface CanvasAPI {
  saveCanvas: (canvasId: string, state: CanvasState) => Promise<void>;
  loadCanvas: (canvasId: string) => Promise<CanvasState | null>;
  listCanvases: () => Promise<CanvasMetadata[]>;
  deleteCanvas: (canvasId: string) => Promise<void>;
  getCurrentCanvasId: () => Promise<string | null>;
  setCurrentCanvasId: (canvasId: string) => Promise<void>;
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

// Helper to unwrap IPC response
interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function unwrapResponse<T>(promise: Promise<IPCResponse<T>>): Promise<T> {
  const response = await promise;
  if (!response.success) {
    throw new Error(response.error || 'Unknown error');
  }
  return response.data as T;
}

// Expose canvas persistence API
contextBridge.exposeInMainWorld('canvasAPI', {
  saveCanvas: async (canvasId: string, state: CanvasState) => {
    await unwrapResponse(ipcRenderer.invoke('canvas:save', canvasId, state));
  },
  loadCanvas: (canvasId: string) =>
    unwrapResponse<CanvasState | null>(ipcRenderer.invoke('canvas:load', canvasId)),
  listCanvases: () =>
    unwrapResponse<CanvasMetadata[]>(ipcRenderer.invoke('canvas:list')),
  deleteCanvas: async (canvasId: string) => {
    await unwrapResponse(ipcRenderer.invoke('canvas:delete', canvasId));
  },
  getCurrentCanvasId: () =>
    unwrapResponse<string | null>(ipcRenderer.invoke('canvas:get-current-id')),
  setCurrentCanvasId: async (canvasId: string) => {
    await unwrapResponse(ipcRenderer.invoke('canvas:set-current-id', canvasId));
  },
} as CanvasAPI);

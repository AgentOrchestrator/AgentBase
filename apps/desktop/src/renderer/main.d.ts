export interface ElectronAPI {
  onTerminalData: (callback: (data: string) => void) => void;
  onTerminalExit: (callback: (data: { code: number; signal?: number }) => void) => void;
  sendTerminalInput: (data: string) => void;
  sendTerminalResize: (cols: number, rows: number) => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}


export interface ElectronAPI {
  createTerminal: (terminalId: string) => void;
  onTerminalData: (callback: (data: { terminalId: string; data: string }) => void) => void;
  onTerminalExit: (callback: (data: { terminalId: string; code: number; signal?: number }) => void) => void;
  sendTerminalInput: (terminalId: string, data: string) => void;
  sendTerminalResize: (terminalId: string, cols: number, rows: number) => void;
  destroyTerminal: (terminalId: string) => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}


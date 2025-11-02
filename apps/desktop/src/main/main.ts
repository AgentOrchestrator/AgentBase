import { app, BrowserWindow, ipcMain } from 'electron';
import * as pty from 'node-pty';
import * as path from 'path';

// Map to store terminal instances by ID
const terminalProcesses = new Map<string, pty.IPty>();

const createWindow = (): void => {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load from Vite dev server in development, otherwise load from dist
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    win.loadURL('http://localhost:5173');
    // Open DevTools in development
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, './dist/index.html'));
  }

  // Create a new terminal instance
  ipcMain.on('terminal-create', (event, terminalId: string) => {
    // If terminal already exists, check if it's still alive
    const existingProcess = terminalProcesses.get(terminalId);
    if (existingProcess) {
      // Check if process is still running (pty processes don't have a direct way to check)
      // We'll try to write a null byte to check, but for now just return
      // The exit handler will clean it up, so we can recreate
      return;
    }

    const shell = process.platform === 'win32' ? 'cmd.exe' : process.env.SHELL || '/bin/bash';
    const shellArgs = process.platform === 'win32' 
      ? [] 
      : ['-i']; // Use interactive shell to ensure it stays open

    const ptyProcess = pty.spawn(
      shell,
      shellArgs,
      {
        name: 'xterm-256color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME || process.cwd(),
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor'
        } as { [key: string]: string }
      }
    );

    // Handle shell data - send to renderer via IPC with terminal ID
    ptyProcess.onData((data: string) => {
      win.webContents.send('terminal-data', { terminalId, data });
    });

    // Handle shell exit
    ptyProcess.onExit((exitInfo: { exitCode: number; signal?: number }) => {
      win.webContents.send('terminal-exit', {
        terminalId,
        code: exitInfo.exitCode,
        signal: exitInfo.signal
      });
      // Remove from map when process exits so it can be recreated
      terminalProcesses.delete(terminalId);
    });

    terminalProcesses.set(terminalId, ptyProcess);
  });

  // Handle resize from renderer
  ipcMain.on('terminal-resize', (_event, { terminalId, cols, rows }: { terminalId: string; cols: number; rows: number }) => {
    const ptyProcess = terminalProcesses.get(terminalId);
    if (ptyProcess) {
      ptyProcess.resize(cols, rows);
    }
  });

  // Handle input from renderer
  ipcMain.on('terminal-input', (_event, { terminalId, data }: { terminalId: string; data: string }) => {
    const ptyProcess = terminalProcesses.get(terminalId);
    if (ptyProcess) {
      ptyProcess.write(data);
    }
  });

  // Handle terminal destroy
  ipcMain.on('terminal-destroy', (_event, terminalId: string) => {
    const ptyProcess = terminalProcesses.get(terminalId);
    if (ptyProcess) {
      ptyProcess.kill();
      terminalProcesses.delete(terminalId);
    }
  });

  // Clean up all terminals when window closes
  win.on('closed', () => {
    terminalProcesses.forEach((ptyProcess) => {
      ptyProcess.kill();
    });
    terminalProcesses.clear();
  });
};

app.whenReady().then(() => {
  createWindow();
});


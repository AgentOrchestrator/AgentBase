import { app, BrowserWindow, ipcMain } from 'electron';
import * as pty from 'node-pty';
import * as path from 'path';

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

  // Initialize and spawn shell
  const ptyProcess = pty.spawn(
    process.platform === 'win32' ? 'cmd.exe' : process.env.SHELL || '/bin/bash',
    [],
    {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.env.HOME || process.cwd(),
      env: process.env as { [key: string]: string }
    }
  );

  // Handle shell data - send to renderer via IPC
  ptyProcess.onData((data: string) => {
    win.webContents.send('terminal-data', data);
  });

  // Handle shell exit
  ptyProcess.onExit((exitInfo: { exitCode: number; signal?: number }) => {
    win.webContents.send('terminal-exit', { code: exitInfo.exitCode, signal: exitInfo.signal });
  });

  // Handle resize from renderer
  ipcMain.on('terminal-resize', (_event, { cols, rows }: { cols: number; rows: number }) => {
    ptyProcess.resize(cols, rows);
  });

  // Handle input from renderer
  ipcMain.on('terminal-input', (_event, data: string) => {
    ptyProcess.write(data);
  });

  // Get initial terminal size based on window size
  win.on('resize', () => {
    const { width, height } = win.getContentBounds();
    // Approximate cols/rows (rough calculation)
    const cols = Math.floor((width - 40) / 9);
    const rows = Math.floor((height - 40) / 17);
    ptyProcess.resize(Math.max(cols, 10), Math.max(rows, 10));
  });
};

app.whenReady().then(() => {
  createWindow();
});


import electron from 'electron';
import { TrayManager, DaemonStatus } from './tray-manager.js';
import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let trayManager: TrayManager | null = null;
let daemonProcess: any = null;

// Track daemon status based on log output
let currentStatus: DaemonStatus = DaemonStatus.UNAUTHENTICATED;
let authUrl: string | null = null;

function startDaemon() {
  console.log('Starting daemon process...');

  // Start the daemon as a child process
  const daemonPath = path.join(__dirname, 'index.js');

  daemonProcess = spawn('node', [daemonPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  // Monitor stdout for status changes
  daemonProcess.stdout.on('data', (data: Buffer) => {
    const output = data.toString();
    console.log(output);

    // Capture auth URL from daemon output
    const urlMatch = output.match(/Or copy this URL: (http[^\s]+)/);
    if (urlMatch && urlMatch[1]) {
      authUrl = urlMatch[1];
      console.log('[Electron] Captured auth URL:', authUrl);
    }

    // Update tray status based on daemon output
    if (output.includes('🔐 Authentication Required')) {
      updateTrayStatus(DaemonStatus.UNAUTHENTICATED);
    } else if (output.includes('⚠️') ||
               output.includes('Error') ||
               output.includes('failed')) {
      updateTrayStatus(DaemonStatus.ERROR);
    } else if (output.includes('[Periodic Sync]') ||
               output.includes('Processing chat histories') ||
               (output.includes('Total:') && output.includes('chat histories'))) {
      updateTrayStatus(DaemonStatus.SYNCING);
    } else if (output.includes('Upload complete') ||
               output.includes('No chat histories found')) {
      updateTrayStatus(DaemonStatus.IDLE);
    } else if (output.includes('✓ Using existing authentication session') ||
               output.includes('✓ Authentication successful') ||
               output.includes('✓ Authenticated as user:')) {
      // Only set to IDLE if we're not currently syncing
      if (currentStatus !== DaemonStatus.SYNCING) {
        updateTrayStatus(DaemonStatus.IDLE);
      }
    }
  });

  daemonProcess.stderr.on('data', (data: Buffer) => {
    console.error(data.toString());
    updateTrayStatus(DaemonStatus.ERROR);
  });

  daemonProcess.on('close', (code: number) => {
    console.log(`Daemon process exited with code ${code}`);
    if (code !== 0) {
      updateTrayStatus(DaemonStatus.ERROR);
    }
  });
}

function updateTrayStatus(status: DaemonStatus) {
  if (currentStatus !== status) {
    currentStatus = status;
    trayManager?.setStatus(status);
  }
}

function handleAuthenticate() {
  console.log('Opening authentication URL...');

  if (authUrl) {
    // Open the captured auth URL with device_id
    exec(`open "${authUrl}"`, (error) => {
      if (error) {
        console.error('Failed to open browser:', error);
      } else {
        console.log('[Electron] Opened browser for authentication');
      }
    });
  } else {
    // Fallback: open default daemon-auth page
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    exec(`open "${webUrl}/daemon-auth"`, (error) => {
      if (error) {
        console.error('Failed to open browser:', error);
      } else {
        console.log('[Electron] Opened browser for authentication (no device_id captured yet)');
      }
    });
  }
}

function handleSyncNow() {
  console.log('Sync now requested...');
  // For now, we rely on the periodic sync
  // In the future, we could send a signal to the daemon to trigger immediate sync
  updateTrayStatus(DaemonStatus.SYNCING);
}

function handleOpenDashboard() {
  console.log('Opening dashboard...');
  exec('open http://localhost:3000', (error) => {
    if (error) {
      console.error('Failed to open browser:', error);
    }
  });
}

electron.app.whenReady().then(() => {
  console.log('Electron app ready');

  // Hide dock icon - make this a menu bar only app
  if (process.platform === 'darwin' && electron.app.dock) {
    electron.app.dock.hide();
  }

  // Initialize tray
  trayManager = new TrayManager();
  trayManager.initialize();
  trayManager.setAuthenticateCallback(handleAuthenticate);
  trayManager.setSyncNowCallback(handleSyncNow);
  trayManager.setOpenDashboardCallback(handleOpenDashboard);

  // Start the daemon process
  startDaemon();
});

// Quit when all windows are closed (not applicable here, but good practice)
electron.app.on('window-all-closed', () => {
  // On macOS, keep the app running in the tray
  // Don't quit automatically
});

electron.app.on('before-quit', () => {
  console.log('Quitting application...');

  // Clean up tray
  if (trayManager) {
    trayManager.destroy();
    trayManager = null;
  }

  // Kill daemon process
  if (daemonProcess) {
    daemonProcess.kill();
    daemonProcess = null;
  }
});

// Handle app activation (macOS)
electron.app.on('activate', () => {
  // On macOS, re-create the tray if it was destroyed
  if (!trayManager) {
    trayManager = new TrayManager();
    trayManager.initialize();
    trayManager.setAuthenticateCallback(handleAuthenticate);
    trayManager.setSyncNowCallback(handleSyncNow);
    trayManager.setOpenDashboardCallback(handleOpenDashboard);
  }
});

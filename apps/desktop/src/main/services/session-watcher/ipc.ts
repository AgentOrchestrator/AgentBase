import type { CodingAgentType, SessionFileChangeEvent } from '@agent-orchestrator/shared';
import { type BrowserWindow, ipcMain } from 'electron';
import { createCodingAgent } from '../coding-agent';
import { SessionFileWatcher } from './SessionFileWatcher';

/**
 * IPC response wrapper for consistent error handling
 */
interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function successResponse<T>(data: T): IPCResponse<T> {
  return { success: true, data };
}

function errorResponse(error: string): IPCResponse<never> {
  return { success: false, error };
}

let sessionFileWatcher: SessionFileWatcher | null = null;

/**
 * Register IPC handlers for session file watching.
 * Must be called after BrowserWindow is created.
 *
 * @param win - The main BrowserWindow to send events to
 */
export function registerSessionWatcherIpcHandlers(win: BrowserWindow): void {
  // Initialize watcher
  sessionFileWatcher = new SessionFileWatcher({
    debounceMs: 300,
    maxDebounceMs: 1000,
  });

  sessionFileWatcher.initialize();

  // Forward change events to renderer
  sessionFileWatcher.on('change', (event: SessionFileChangeEvent) => {
    if (!win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send('session:file-changed', event);
    }
  });

  // Handle watch requests from renderer
  ipcMain.handle(
    'session-watcher:watch',
    async (_event, agentType: CodingAgentType): Promise<IPCResponse<void>> => {
      try {
        if (!sessionFileWatcher) {
          return errorResponse('SessionFileWatcher not initialized');
        }

        // Get data paths from the agent's chat history provider
        const agentResult = await createCodingAgent(agentType, {
          skipCliVerification: true,
        });

        if (!agentResult.success) {
          return errorResponse(agentResult.error.message);
        }

        const agent = agentResult.data;

        const dataPaths = agent.getDataPaths();
        sessionFileWatcher.watchAgent(agentType, dataPaths);

        console.log('[Main] Started session file watching', { agentType, dataPaths });
        return successResponse(undefined);
      } catch (error) {
        console.error('[Main] Error starting session watch', { agentType, error });
        return errorResponse((error as Error).message);
      }
    }
  );

  // Handle unwatch requests
  ipcMain.handle(
    'session-watcher:unwatch',
    async (_event, agentType: CodingAgentType): Promise<IPCResponse<void>> => {
      try {
        if (sessionFileWatcher) {
          sessionFileWatcher.unwatchAgent(agentType);
        }
        console.log('[Main] Stopped session file watching', { agentType });
        return successResponse(undefined);
      } catch (error) {
        console.error('[Main] Error stopping session watch', { agentType, error });
        return errorResponse((error as Error).message);
      }
    }
  );

  // Get watch status
  ipcMain.handle(
    'session-watcher:status',
    async (): Promise<
      IPCResponse<{
        isActive: boolean;
        watchedAgents: CodingAgentType[];
        watchedPaths: string[];
      }>
    > => {
      if (!sessionFileWatcher) {
        return successResponse({
          isActive: false,
          watchedAgents: [],
          watchedPaths: [],
        });
      }
      return successResponse(sessionFileWatcher.getWatchStatus());
    }
  );

  console.log('[Main] Session watcher IPC handlers registered');
}

/**
 * Dispose of the session watcher and clean up resources.
 * Should be called on app quit.
 */
export function disposeSessionWatcher(): void {
  if (sessionFileWatcher) {
    sessionFileWatcher.dispose();
    sessionFileWatcher = null;
  }
}

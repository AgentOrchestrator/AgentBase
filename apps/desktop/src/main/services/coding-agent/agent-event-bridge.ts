import { BrowserWindow, ipcMain } from 'electron';
import type { AgentEvent, AgentActionResponse } from '@agent-orchestrator/shared';

interface PendingAction {
  resolve: (response: AgentActionResponse) => void;
  reject: (error: Error) => void;
  abortHandler?: () => void;
}

const pendingActions = new Map<string, PendingAction>();

export function emitAgentEvent(event: AgentEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('coding-agent:event', event);
  }
}

export function awaitAgentActionResponse(
  actionId: string,
  signal?: AbortSignal
): Promise<AgentActionResponse> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Action response aborted'));
      return;
    }

    const pending: PendingAction = { resolve, reject };
    pendingActions.set(actionId, pending);

    if (signal) {
      const handleAbort = () => {
        pendingActions.delete(actionId);
        reject(new Error('Action response aborted'));
      };
      signal.addEventListener('abort', handleAbort, { once: true });
      pending.abortHandler = () => {
        signal.removeEventListener('abort', handleAbort);
      };
    }
  });
}

export function registerAgentActionHandlers(): void {
  ipcMain.handle('coding-agent:respond-to-action', async (_event, response: AgentActionResponse) => {
    const pending = pendingActions.get(response.actionId);
    if (!pending) {
      return { success: false, error: 'No pending action for response' };
    }

    pending.abortHandler?.();

    pendingActions.delete(response.actionId);
    pending.resolve(response);
    return { success: true };
  });
}

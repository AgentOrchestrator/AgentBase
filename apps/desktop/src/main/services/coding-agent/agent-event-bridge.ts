import type { AgentActionResponse, AgentEvent } from '@agent-orchestrator/shared';
import { BrowserWindow, ipcMain } from 'electron';

interface PendingAction {
  resolve: (response: AgentActionResponse) => void;
  reject: (error: Error) => void;
  abortHandler?: () => void;
}

const pendingActions = new Map<string, PendingAction>();

export function emitAgentEvent(event: AgentEvent): void {
  console.log('[agent-event-bridge] Emitting SDK agent event to renderer', {
    type: event.type,
    agentId: event.agentId,
    sessionId: event.sessionId,
    id: (event as { id?: string }).id,
  });
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
  ipcMain.handle(
    'coding-agent:respond-to-action',
    async (_event, response: AgentActionResponse) => {
      const pending = pendingActions.get(response.actionId);
      if (!pending) {
        return { success: false, error: 'No pending action for response' };
      }

      pending.abortHandler?.();

      pendingActions.delete(response.actionId);
      pending.resolve(response);
      return { success: true };
    }
  );
}

/**
 * IPC Canvas State Provider
 *
 * Provides access to canvas state for MCP tools by querying the renderer
 * process via IPC. Uses a request/response pattern with unique channel IDs
 * for each request to support concurrent operations.
 */

import * as crypto from 'node:crypto';
import type { BrowserWindow } from 'electron';
import { ipcMain } from 'electron';
import type {
  AgentSessionData,
  AgentSummary,
  CreateAgentParams,
  ICanvasStateProvider,
} from './interfaces';

/**
 * IPC Channel names for canvas state operations
 */
export const CANVAS_STATE_CHANNELS = {
  // Requests (main -> renderer)
  LIST_AGENTS_REQUEST: 'canvas-state:list-agents:request',
  CREATE_AGENT_REQUEST: 'canvas-state:create-agent:request',
  DELETE_AGENT_REQUEST: 'canvas-state:delete-agent:request',
  GET_AGENT_SESSION_REQUEST: 'canvas-state:get-agent-session:request',
  // Responses use dynamic channels: canvas-state:{operation}:response:{uuid}
} as const;

/**
 * Response wrapper for IPC canvas state operations
 */
interface IPCCanvasResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Timeout for IPC requests in milliseconds
 */
const IPC_TIMEOUT_MS = 30000;

/**
 * Implementation of ICanvasStateProvider that queries the renderer via IPC.
 *
 * Pattern:
 * 1. Main sends a request to renderer with a unique response channel
 * 2. Renderer processes the request and sends result to the response channel
 * 3. Main listens once on the response channel and resolves the promise
 *
 * @example
 * ```typescript
 * const provider = new IPCCanvasStateProvider(mainWindow);
 * const agents = await provider.listAgents();
 * ```
 */
export class IPCCanvasStateProvider implements ICanvasStateProvider {
  private window: BrowserWindow;

  constructor(window: BrowserWindow) {
    this.window = window;
  }

  /**
   * Send a request to the renderer and wait for a response.
   *
   * @param requestChannel - The channel to send the request on
   * @param payload - Optional payload to send with the request
   * @returns Promise that resolves with the response data
   */
  private async sendRequest<T>(requestChannel: string, payload?: unknown): Promise<T> {
    const requestId = crypto.randomUUID();
    const responseChannel = `${requestChannel}:response:${requestId}`;

    return new Promise<T>((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        ipcMain.removeHandler(responseChannel);
        reject(new Error(`IPC request timed out after ${IPC_TIMEOUT_MS}ms: ${requestChannel}`));
      }, IPC_TIMEOUT_MS);

      // Listen for response (one-time handler)
      ipcMain.handleOnce(responseChannel, async (_event, response: IPCCanvasResponse<T>) => {
        clearTimeout(timeoutId);

        if (!response.success) {
          reject(new Error(response.error || 'Unknown error from renderer'));
          return { success: true }; // Acknowledge receipt
        }

        resolve(response.data as T);
        return { success: true }; // Acknowledge receipt
      });

      // Send request to renderer
      if (this.window.isDestroyed() || !this.window.webContents) {
        clearTimeout(timeoutId);
        ipcMain.removeHandler(responseChannel);
        reject(new Error('BrowserWindow is destroyed or has no webContents'));
        return;
      }

      this.window.webContents.send(requestChannel, {
        requestId,
        responseChannel,
        payload,
      });
    });
  }

  /**
   * List all agents currently on the canvas
   */
  async listAgents(): Promise<AgentSummary[]> {
    console.log('[IPCCanvasStateProvider] listAgents: sending request to renderer');

    const agents = await this.sendRequest<AgentSummary[]>(
      CANVAS_STATE_CHANNELS.LIST_AGENTS_REQUEST
    );

    console.log('[IPCCanvasStateProvider] listAgents: received', {
      agentCount: agents.length,
    });

    return agents;
  }

  /**
   * Create a new agent on the canvas
   */
  async createAgent(params: CreateAgentParams): Promise<{ agentId: string }> {
    console.log('[IPCCanvasStateProvider] createAgent: sending request to renderer', {
      workspacePath: params.workspacePath,
      title: params.title,
      hasInitialPrompt: !!params.initialPrompt,
    });

    const result = await this.sendRequest<{ agentId: string }>(
      CANVAS_STATE_CHANNELS.CREATE_AGENT_REQUEST,
      params
    );

    console.log('[IPCCanvasStateProvider] createAgent: created', {
      agentId: result.agentId,
    });

    return result;
  }

  /**
   * Delete an agent from the canvas
   */
  async deleteAgent(agentId: string): Promise<void> {
    console.log('[IPCCanvasStateProvider] deleteAgent: sending request to renderer', {
      agentId,
    });

    await this.sendRequest<void>(CANVAS_STATE_CHANNELS.DELETE_AGENT_REQUEST, { agentId });

    console.log('[IPCCanvasStateProvider] deleteAgent: deleted', {
      agentId,
    });
  }

  /**
   * Get detailed session data for an agent
   */
  async getAgentSession(agentId: string, maxMessages = 10): Promise<AgentSessionData | null> {
    console.log('[IPCCanvasStateProvider] getAgentSession: sending request to renderer', {
      agentId,
      maxMessages,
    });

    const result = await this.sendRequest<AgentSessionData | null>(
      CANVAS_STATE_CHANNELS.GET_AGENT_SESSION_REQUEST,
      { agentId, maxMessages }
    );

    console.log('[IPCCanvasStateProvider] getAgentSession: received', {
      agentId,
      hasData: !!result,
      messageCount: result?.recentMessages.length ?? 0,
    });

    return result;
  }
}

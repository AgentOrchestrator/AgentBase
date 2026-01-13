import { contextBridge, ipcRenderer } from 'electron';
import type { CanvasState, CanvasMetadata } from './types/database';
import type {
  WorktreeInfo,
  WorktreeProvisionOptions,
  WorktreeReleaseOptions,
} from './types/worktree';
import type { CodingAgentState } from '../../types/coding-agent-status';
import type {
  CodingAgentType,
  AgentCapabilities,
  GenerateRequest,
  GenerateResponse,
  SessionIdentifier,
  SessionInfo,
  ForkOptions,
  ContinueOptions,
} from './services/coding-agent';
import type {
  ChatRequest,
  ChatResponse,
  VendorId,
  ModelInfo,
  LLMCapabilities,
} from './services/llm';

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

// Type definitions for the worktree API
export interface WorktreeAPI {
  provision: (
    repoPath: string,
    branchName: string,
    options?: WorktreeProvisionOptions
  ) => Promise<WorktreeInfo>;
  release: (worktreeId: string, options?: WorktreeReleaseOptions) => Promise<void>;
  get: (worktreeId: string) => Promise<WorktreeInfo | null>;
  list: (repoPath?: string) => Promise<WorktreeInfo[]>;
}

// Type definitions for the agent status API
export interface AgentStatusAPI {
  saveAgentStatus: (agentId: string, state: CodingAgentState) => Promise<void>;
  loadAgentStatus: (agentId: string) => Promise<CodingAgentState | null>;
  deleteAgentStatus: (agentId: string) => Promise<void>;
  loadAllAgentStatuses: () => Promise<CodingAgentState[]>;
}

// Type definitions for the LLM API
export interface LLMAPI {
  /** Generate a chat completion */
  chat: (request: ChatRequest) => Promise<ChatResponse>;

  /** Generate a chat completion with streaming */
  chatStream: (
    requestId: string,
    request: ChatRequest,
    onChunk: (chunk: string) => void
  ) => Promise<ChatResponse>;

  /** Chat with automatic tool execution */
  chatWithTools: (
    request: ChatRequest,
    maxIterations?: number
  ) => Promise<ChatResponse>;

  /** Store an API key in the keychain */
  setApiKey: (vendor: VendorId, apiKey: string) => Promise<void>;

  /** Delete an API key from the keychain */
  deleteApiKey: (vendor: VendorId) => Promise<void>;

  /** Check if an API key exists */
  hasApiKey: (vendor: VendorId) => Promise<boolean>;

  /** List vendors with stored API keys */
  listVendorsWithKeys: () => Promise<VendorId[]>;

  /** Get available models */
  getAvailableModels: () => Promise<ModelInfo[]>;

  /** Check if the service is configured */
  isConfigured: () => Promise<boolean>;

  /** Get service capabilities */
  getCapabilities: () => Promise<LLMCapabilities>;

  /** Subscribe to stream chunks (for use with chatStream) */
  onStreamChunk: (
    callback: (data: { requestId: string; chunk: string }) => void
  ) => () => void;
}

// Type definitions for the coding agent API
export interface CodingAgentAPI {
  /** Generate a one-off response */
  generate: (
    agentType: CodingAgentType,
    request: GenerateRequest
  ) => Promise<GenerateResponse>;

  /** Continue an existing session */
  continueSession: (
    agentType: CodingAgentType,
    identifier: SessionIdentifier,
    prompt: string,
    options?: ContinueOptions
  ) => Promise<GenerateResponse>;

  /** Fork an existing session */
  forkSession: (
    agentType: CodingAgentType,
    parentIdentifier: SessionIdentifier,
    options?: ForkOptions
  ) => Promise<SessionInfo>;

  /** Get list of available agent types */
  getAvailableAgents: () => Promise<CodingAgentType[]>;

  /** Get capabilities for a specific agent type */
  getCapabilities: (agentType: CodingAgentType) => Promise<AgentCapabilities>;

  /** Check if a specific agent is available */
  isAgentAvailable: (agentType: CodingAgentType) => Promise<boolean>;
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

// Expose worktree API
contextBridge.exposeInMainWorld('worktreeAPI', {
  provision: (
    repoPath: string,
    branchName: string,
    options?: WorktreeProvisionOptions
  ) =>
    unwrapResponse<WorktreeInfo>(
      ipcRenderer.invoke('worktree:provision', repoPath, branchName, options)
    ),
  release: async (worktreeId: string, options?: WorktreeReleaseOptions) => {
    await unwrapResponse(ipcRenderer.invoke('worktree:release', worktreeId, options));
  },
  get: (worktreeId: string) =>
    unwrapResponse<WorktreeInfo | null>(ipcRenderer.invoke('worktree:get', worktreeId)),
  list: (repoPath?: string) =>
    unwrapResponse<WorktreeInfo[]>(ipcRenderer.invoke('worktree:list', repoPath)),
} as WorktreeAPI);

// Expose agent status API
contextBridge.exposeInMainWorld('agentStatusAPI', {
  saveAgentStatus: async (agentId: string, state: CodingAgentState) => {
    await unwrapResponse(ipcRenderer.invoke('agent-status:save', agentId, state));
  },
  loadAgentStatus: (agentId: string) =>
    unwrapResponse<CodingAgentState | null>(
      ipcRenderer.invoke('agent-status:load', agentId)
    ),
  deleteAgentStatus: async (agentId: string) => {
    await unwrapResponse(ipcRenderer.invoke('agent-status:delete', agentId));
  },
  loadAllAgentStatuses: () =>
    unwrapResponse<CodingAgentState[]>(ipcRenderer.invoke('agent-status:load-all')),
} as AgentStatusAPI);

// Expose coding agent API
contextBridge.exposeInMainWorld('codingAgentAPI', {
  generate: (agentType: CodingAgentType, request: GenerateRequest) =>
    unwrapResponse<GenerateResponse>(
      ipcRenderer.invoke('coding-agent:generate', agentType, request)
    ),

  continueSession: (
    agentType: CodingAgentType,
    identifier: SessionIdentifier,
    prompt: string,
    options?: ContinueOptions
  ) =>
    unwrapResponse<GenerateResponse>(
      ipcRenderer.invoke('coding-agent:continue-session', agentType, identifier, prompt, options)
    ),

  forkSession: (
    agentType: CodingAgentType,
    parentIdentifier: SessionIdentifier,
    options?: ForkOptions
  ) =>
    unwrapResponse<SessionInfo>(
      ipcRenderer.invoke('coding-agent:fork-session', agentType, parentIdentifier, options)
    ),

  getAvailableAgents: () =>
    unwrapResponse<CodingAgentType[]>(ipcRenderer.invoke('coding-agent:get-available')),

  getCapabilities: (agentType: CodingAgentType) =>
    unwrapResponse<AgentCapabilities>(
      ipcRenderer.invoke('coding-agent:get-capabilities', agentType)
    ),

  isAgentAvailable: (agentType: CodingAgentType) =>
    unwrapResponse<boolean>(ipcRenderer.invoke('coding-agent:is-available', agentType)),
} as CodingAgentAPI);

// Expose LLM API
contextBridge.exposeInMainWorld('llmAPI', {
  chat: (request: ChatRequest) =>
    unwrapResponse<ChatResponse>(ipcRenderer.invoke('llm:chat', request)),

  chatStream: async (
    requestId: string,
    request: ChatRequest,
    onChunk: (chunk: string) => void
  ) => {
    // Set up chunk listener
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { requestId: string; chunk: string }
    ) => {
      if (data.requestId === requestId) {
        onChunk(data.chunk);
      }
    };
    ipcRenderer.on('llm:stream-chunk', handler);

    try {
      return await unwrapResponse<ChatResponse>(
        ipcRenderer.invoke('llm:chat-stream', requestId, request)
      );
    } finally {
      ipcRenderer.removeListener('llm:stream-chunk', handler);
    }
  },

  chatWithTools: (request: ChatRequest, maxIterations?: number) =>
    unwrapResponse<ChatResponse>(
      ipcRenderer.invoke('llm:chat-with-tools', request, maxIterations)
    ),

  setApiKey: async (vendor: VendorId, apiKey: string) => {
    await unwrapResponse(ipcRenderer.invoke('llm:set-api-key', vendor, apiKey));
  },

  deleteApiKey: async (vendor: VendorId) => {
    await unwrapResponse(ipcRenderer.invoke('llm:delete-api-key', vendor));
  },

  hasApiKey: (vendor: VendorId) =>
    unwrapResponse<boolean>(ipcRenderer.invoke('llm:has-api-key', vendor)),

  listVendorsWithKeys: () =>
    unwrapResponse<VendorId[]>(ipcRenderer.invoke('llm:list-vendors-with-keys')),

  getAvailableModels: () =>
    unwrapResponse<ModelInfo[]>(ipcRenderer.invoke('llm:get-available-models')),

  isConfigured: () =>
    unwrapResponse<boolean>(ipcRenderer.invoke('llm:is-configured')),

  getCapabilities: () =>
    unwrapResponse<LLMCapabilities>(ipcRenderer.invoke('llm:get-capabilities')),

  onStreamChunk: (
    callback: (data: { requestId: string; chunk: string }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { requestId: string; chunk: string }
    ) => callback(data);
    ipcRenderer.on('llm:stream-chunk', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('llm:stream-chunk', handler);
  },
} as LLMAPI);

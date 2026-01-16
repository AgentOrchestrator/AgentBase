import { contextBridge, ipcRenderer } from 'electron';
import type { CanvasState, CanvasMetadata } from './types/database';
import type {
  WorktreeInfo,
  WorktreeProvisionOptions,
  WorktreeReleaseOptions,
} from './types/worktree';
import type { CodingAgentState } from '../../types/coding-agent-status';
import type {
  GitInfo,
  TerminalSessionState,
  TerminalSessionAPI,
  SessionFileChangeEvent,
  SessionWatcherAPI,
  CodingAgentType as SharedCodingAgentType,
  RecentWorkspace,
  AddWorkspaceOptions,
  RecentWorkspacesAPI,
} from '@agent-orchestrator/shared';
import type {
  CodingAgentType,
  AgentCapabilities,
  GenerateRequest,
  GenerateResponse,
  SessionIdentifier,
  SessionSummary,
  SessionContent,
  SessionFilterOptions,
  MessageFilterOptions,
  ForkOptions,
  ContinueOptions,
  CodingAgentAPI,
} from './services/coding-agent';
import type {
  ChatRequest,
  ChatResponse,
  VendorId,
  ModelInfo,
  LLMCapabilities,
} from './services/llm';
import type {
  RepresentationType,
  RepresentationInput,
  RepresentationCapabilities,
  AnyRepresentationOutput,
  ImageRepresentationOutput,
  SummaryRepresentationOutput,
  AudioRepresentationOutput,
  ImageTransformOptions,
  SummaryTransformOptions,
  AudioTransformOptions,
} from './services/representation';

// Type definitions for the electron API
export interface ElectronAPI {
  createTerminal: (terminalId: string) => void;
  onTerminalData: (callback: (data: { terminalId: string; data: string }) => void) => void;
  onTerminalExit: (callback: (data: { terminalId: string; code: number; signal?: number }) => void) => void;
  sendTerminalInput: (terminalId: string, data: string) => void;
  sendTerminalResize: (terminalId: string, cols: number, rows: number) => void;
  destroyTerminal: (terminalId: string) => void;
  removeAllListeners: (channel: string) => void;
  getHomeDir: () => string;
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

// Type definitions for provider info returned by the API
export interface ProviderInfo {
  providerId: string;
  providerName: string;
  representationType: RepresentationType;
  capabilities: RepresentationCapabilities;
}

// Type definitions for the representation API
export interface RepresentationAPI {
  /** Get available representation types based on registered providers */
  getAvailableTypes: () => Promise<RepresentationType[]>;

  /** Transform using a specific provider */
  transform: (
    providerId: string,
    input: RepresentationInput
  ) => Promise<AnyRepresentationOutput>;

  /** Transform to image using the first available image provider */
  transformToImage: (
    input: RepresentationInput,
    options?: ImageTransformOptions
  ) => Promise<ImageRepresentationOutput>;

  /** Transform to summary using the first available summary provider */
  transformToSummary: (
    input: RepresentationInput,
    options?: SummaryTransformOptions
  ) => Promise<SummaryRepresentationOutput>;

  /** Transform to audio using the first available audio provider */
  transformToAudio: (
    input: RepresentationInput,
    options?: AudioTransformOptions
  ) => Promise<AudioRepresentationOutput>;

  /** Get all registered providers */
  getAllProviders: () => Promise<ProviderInfo[]>;
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
  },
  getHomeDir: () => ipcRenderer.sendSync('get-home-dir'),
} as ElectronAPI);

// Helper to unwrap IPC response (declared early for use in terminalSessionAPI)
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

// Expose terminal session API for state synchronization across renderer refreshes
contextBridge.exposeInMainWorld('terminalSessionAPI', {
  getTerminalSessionState: (terminalId: string) =>
    unwrapResponse<TerminalSessionState | null>(
      ipcRenderer.invoke('terminal-get-session-state', terminalId)
    ),
  setTerminalSessionState: async (terminalId: string, state: TerminalSessionState) => {
    await unwrapResponse(ipcRenderer.invoke('terminal-set-session-state', terminalId, state));
  },
  clearTerminalSessionState: async (terminalId: string) => {
    await unwrapResponse(ipcRenderer.invoke('terminal-clear-session-state', terminalId));
  },
  getTerminalBuffer: (terminalId: string) =>
    unwrapResponse<string>(ipcRenderer.invoke('terminal-get-buffer', terminalId)),
} as TerminalSessionAPI);

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

  generateStreaming: async (
    agentType: CodingAgentType,
    request: GenerateRequest,
    onChunk: (chunk: string) => void
  ) => {
    const requestId = globalThis.crypto.randomUUID();

    // Set up chunk listener
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { requestId: string; chunk: string }
    ) => {
      if (data.requestId === requestId) {
        onChunk(data.chunk);
      }
    };
    ipcRenderer.on('coding-agent:stream-chunk', handler);

    try {
      return await unwrapResponse<GenerateResponse>(
        ipcRenderer.invoke('coding-agent:generate-streaming', requestId, agentType, request)
      );
    } finally {
      ipcRenderer.removeListener('coding-agent:stream-chunk', handler);
    }
  },

  continueSession: (
    agentType: CodingAgentType,
    identifier: SessionIdentifier,
    prompt: string,
    options?: ContinueOptions
  ) =>
    unwrapResponse<GenerateResponse>(
      ipcRenderer.invoke('coding-agent:continue-session', agentType, identifier, prompt, options)
    ),

  continueSessionStreaming: async (
    agentType: CodingAgentType,
    identifier: SessionIdentifier,
    prompt: string,
    onChunk: (chunk: string) => void,
    options?: ContinueOptions
  ) => {
    const requestId = globalThis.crypto.randomUUID();

    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { requestId: string; chunk: string }
    ) => {
      if (data.requestId === requestId) {
        onChunk(data.chunk);
      }
    };
    ipcRenderer.on('coding-agent:stream-chunk', handler);

    try {
      return await unwrapResponse<GenerateResponse>(
        ipcRenderer.invoke(
          'coding-agent:continue-session-streaming',
          requestId,
          agentType,
          identifier,
          prompt,
          options
        )
      );
    } finally {
      ipcRenderer.removeListener('coding-agent:stream-chunk', handler);
    }
  },

  forkSession: (
    agentType: CodingAgentType,
    parentIdentifier: SessionIdentifier,
    options?: ForkOptions
  ) =>
    // Return Result type directly without unwrapping, allowing caller to handle errors explicitly
    ipcRenderer.invoke('coding-agent:fork-session', agentType, parentIdentifier, options),

  getAvailableAgents: () =>
    unwrapResponse<CodingAgentType[]>(ipcRenderer.invoke('coding-agent:get-available')),

  getCapabilities: (agentType: CodingAgentType) =>
    unwrapResponse<AgentCapabilities>(
      ipcRenderer.invoke('coding-agent:get-capabilities', agentType)
    ),

  isAgentAvailable: (agentType: CodingAgentType) =>
    unwrapResponse<boolean>(ipcRenderer.invoke('coding-agent:is-available', agentType)),

  listSessionSummaries: (agentType: CodingAgentType, filter?: SessionFilterOptions) =>
    unwrapResponse<SessionSummary[]>(
      ipcRenderer.invoke('coding-agent:list-session-summaries', agentType, filter)
    ),

  getSession: (agentType: CodingAgentType, sessionId: string, filter?: MessageFilterOptions) =>
    unwrapResponse<SessionContent | null>(
      ipcRenderer.invoke('coding-agent:get-session', agentType, sessionId, filter)
    ),

  onStreamChunk: (
    callback: (data: { requestId: string; chunk: string }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { requestId: string; chunk: string }
    ) => callback(data);
    ipcRenderer.on('coding-agent:stream-chunk', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('coding-agent:stream-chunk', handler);
  },
  onAgentEvent: (callback: (event: unknown) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: unknown
    ) => callback(data);
    ipcRenderer.on('coding-agent:event', handler);
    return () => ipcRenderer.removeListener('coding-agent:event', handler);
  },
  respondToAction: async (response) => {
    await unwrapResponse(ipcRenderer.invoke('coding-agent:respond-to-action', response));
  },
  getLatestSession: (agentType: CodingAgentType, workspacePath: string) =>
    unwrapResponse<{ id: string; updatedAt: string } | null>(
      ipcRenderer.invoke('coding-agent:get-latest-session', agentType, workspacePath)
    ),
  checkSessionActive: (agentType: CodingAgentType, sessionId: string, workspacePath: string) =>
    unwrapResponse<boolean>(
      ipcRenderer.invoke('coding-agent:check-session-active', agentType, sessionId, workspacePath)
    ),
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

// Expose representation API
contextBridge.exposeInMainWorld('representationAPI', {
  getAvailableTypes: () =>
    unwrapResponse<RepresentationType[]>(ipcRenderer.invoke('representation:get-available-types')),

  transform: (providerId: string, input: RepresentationInput) =>
    unwrapResponse<AnyRepresentationOutput>(
      ipcRenderer.invoke('representation:transform', providerId, input)
    ),

  transformToImage: (input: RepresentationInput, options?: ImageTransformOptions) =>
    unwrapResponse<ImageRepresentationOutput>(
      ipcRenderer.invoke('representation:transform-to-image', input, options)
    ),

  transformToSummary: (input: RepresentationInput, options?: SummaryTransformOptions) =>
    unwrapResponse<SummaryRepresentationOutput>(
      ipcRenderer.invoke('representation:transform-to-summary', input, options)
    ),

  transformToAudio: (input: RepresentationInput, options?: AudioTransformOptions) =>
    unwrapResponse<AudioRepresentationOutput>(
      ipcRenderer.invoke('representation:transform-to-audio', input, options)
    ),

  getAllProviders: () =>
    unwrapResponse<ProviderInfo[]>(ipcRenderer.invoke('representation:get-all-providers')),
} as RepresentationAPI);

// Editor application identifiers
export type EditorApp = 'vscode' | 'cursor' | 'zed' | 'sublime' | 'atom' | 'webstorm' | 'finder';

// Type definitions for the shell API
export interface ShellAPI {
  /** Open a directory with a specific editor application */
  openWithEditor: (directoryPath: string, editor: EditorApp) => Promise<void>;
  /** Get list of available editors on this system */
  getAvailableEditors: () => Promise<EditorApp[]>;
  /** Open a path in the system file manager */
  showInFolder: (path: string) => Promise<void>;
  /** Open a directory picker dialog */
  openDirectoryDialog: (options?: { title?: string; defaultPath?: string }) => Promise<string | null>;
}

// Expose shell API
contextBridge.exposeInMainWorld('shellAPI', {
  openWithEditor: async (directoryPath: string, editor: EditorApp) => {
    await unwrapResponse(ipcRenderer.invoke('shell:open-with-editor', directoryPath, editor));
  },
  getAvailableEditors: () =>
    unwrapResponse<EditorApp[]>(ipcRenderer.invoke('shell:get-available-editors')),
  showInFolder: async (path: string) => {
    await unwrapResponse(ipcRenderer.invoke('shell:show-in-folder', path));
  },
  openDirectoryDialog: (options?: { title?: string; defaultPath?: string }) =>
    unwrapResponse<string | null>(ipcRenderer.invoke('shell:open-directory-dialog', options)),
} as ShellAPI);

// Type definitions for the file API
export interface FileAPI {
  readFile: (filePath: string) => Promise<string>;
  exists: (filePath: string) => Promise<boolean>;
}

// Expose file API for debug mode
contextBridge.exposeInMainWorld('fileAPI', {
  readFile: (filePath: string) =>
    unwrapResponse<string>(ipcRenderer.invoke('file:read', filePath)),
  exists: async (filePath: string) => {
    const result = await ipcRenderer.invoke('file:exists', filePath);
    if (result.success) {
      return result.exists;
    }
    return false;
  },
} as FileAPI);

// Git info types
// Re-export GitInfo from shared package for backward compatibility
export type { GitInfo } from '@agent-orchestrator/shared';

// Type definitions for the git API
export interface GitAPI {
  /** Get git information - throws if not a git repository */
  getInfo: (workspacePath: string) => Promise<GitInfo>;
  /** List all local git branches for a workspace path */
  listBranches: (workspacePath: string) => Promise<string[] | null>;
  /** Create and checkout a new branch */
  createBranch: (workspacePath: string, branchName: string) => Promise<{ success: boolean; error?: string }>;
  /** Checkout an existing branch */
  checkoutBranch: (workspacePath: string, branchName: string) => Promise<{ success: boolean; error?: string }>;
  /** Get GitHub username via GitHub CLI */
  getGithubUsername: () => Promise<{ success: boolean; username?: string; error?: string }>;
}

// Expose git API
contextBridge.exposeInMainWorld('gitAPI', {
  getInfo: async (workspacePath: string): Promise<GitInfo> => {
    // This throws if not a git repo - let the error propagate
    return ipcRenderer.invoke('git:get-info-strict', workspacePath);
  },
  listBranches: async (workspacePath: string) => {
    try {
      return await unwrapResponse<string[]>(ipcRenderer.invoke('git:list-branches', workspacePath));
    } catch {
      // Return null if branches cannot be retrieved
      return null;
    }
  },
  createBranch: async (workspacePath: string, branchName: string) => {
    try {
      return await ipcRenderer.invoke('git:create-branch', workspacePath, branchName);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  checkoutBranch: async (workspacePath: string, branchName: string) => {
    try {
      return await ipcRenderer.invoke('git:checkout-branch', workspacePath, branchName);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  getGithubUsername: async () => {
    try {
      const response = await ipcRenderer.invoke('git:get-github-username');
      if (response.success && response.data) {
        return { success: true, username: response.data.username };
      }
      return { success: false, error: response.error || 'Failed to get GitHub username' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
} as GitAPI);

// Type definitions for the window API (custom titlebar controls)
export interface WindowAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
}

// Expose window control API for custom titlebar
contextBridge.exposeInMainWorld('windowAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
} as WindowAPI);

// Expose session watcher API for real-time sync between terminal and chat views
contextBridge.exposeInMainWorld('sessionWatcherAPI', {
  watch: async (agentType: SharedCodingAgentType) => {
    const result = await ipcRenderer.invoke('session-watcher:watch', agentType);
    if (!result.success) {
      throw new Error(result.error);
    }
  },
  unwatch: async (agentType: SharedCodingAgentType) => {
    const result = await ipcRenderer.invoke('session-watcher:unwatch', agentType);
    if (!result.success) {
      throw new Error(result.error);
    }
  },
  onSessionFileChanged: (callback: (event: SessionFileChangeEvent) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: SessionFileChangeEvent
    ) => callback(data);
    ipcRenderer.on('session:file-changed', handler);
    return () => ipcRenderer.removeListener('session:file-changed', handler);
  },
} as SessionWatcherAPI);

// Expose recent workspaces API for tracking recently opened workspace paths
contextBridge.exposeInMainWorld('recentWorkspacesAPI', {
  addWorkspace: async (workspacePath: string, options?: AddWorkspaceOptions) => {
    await unwrapResponse(ipcRenderer.invoke('recent-workspaces:add', workspacePath, options));
  },
  getRecentWorkspaces: (limit?: number) =>
    unwrapResponse<RecentWorkspace[]>(ipcRenderer.invoke('recent-workspaces:get', limit)),
  removeWorkspace: async (workspacePath: string) => {
    await unwrapResponse(ipcRenderer.invoke('recent-workspaces:remove', workspacePath));
  },
  clearAll: async () => {
    await unwrapResponse(ipcRenderer.invoke('recent-workspaces:clear'));
  },
  hasWorkspace: (workspacePath: string) =>
    unwrapResponse<boolean>(ipcRenderer.invoke('recent-workspaces:has', workspacePath)),
} as RecentWorkspacesAPI);

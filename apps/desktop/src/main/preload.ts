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

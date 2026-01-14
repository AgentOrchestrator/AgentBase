import type { CanvasState, CanvasMetadata } from '../main/types/database';
import type {
  CodingAgentType,
  AgentCapabilities,
  GenerateRequest,
  GenerateResponse,
  SessionIdentifier,
  SessionInfo,
  ForkOptions,
  ContinueOptions,
} from '../main/services/coding-agent';
import type {
  WorktreeInfo,
  WorktreeProvisionOptions,
  WorktreeReleaseOptions,
} from '../main/types/worktree';
import type { CodingAgentState } from '../../types/coding-agent-status';

export interface ElectronAPI {
  createTerminal: (terminalId: string) => void;
  onTerminalData: (callback: (data: { terminalId: string; data: string }) => void) => void;
  onTerminalExit: (callback: (data: { terminalId: string; code: number; signal?: number }) => void) => void;
  sendTerminalInput: (terminalId: string, data: string) => void;
  sendTerminalResize: (terminalId: string, cols: number, rows: number) => void;
  destroyTerminal: (terminalId: string) => void;
  removeAllListeners: (channel: string) => void;
}

export interface CanvasAPI {
  saveCanvas: (canvasId: string, state: CanvasState) => Promise<void>;
  loadCanvas: (canvasId: string) => Promise<CanvasState | null>;
  listCanvases: () => Promise<CanvasMetadata[]>;
  deleteCanvas: (canvasId: string) => Promise<void>;
  getCurrentCanvasId: () => Promise<string | null>;
  setCurrentCanvasId: (canvasId: string) => Promise<void>;
}

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

  /** Get the latest session for a workspace path */
  getLatestSession: (
    agentType: CodingAgentType,
    workspacePath: string
  ) => Promise<{ id: string; updatedAt: string } | null>;
}

export type EditorApp = 'vscode' | 'cursor' | 'zed' | 'sublime' | 'atom' | 'webstorm' | 'finder';

export interface ShellAPI {
  /** Open a directory with a specific editor application */
  openWithEditor: (directoryPath: string, editor: EditorApp) => Promise<void>;
  /** Get list of available editors on this system */
  getAvailableEditors: () => Promise<EditorApp[]>;
  /** Open a path in the system file manager */
  showInFolder: (path: string) => Promise<void>;
}

export interface WorktreeAPI {
  /** Create a new git worktree */
  provision: (
    repoPath: string,
    branchName: string,
    options?: WorktreeProvisionOptions
  ) => Promise<WorktreeInfo>;
  /** Remove a worktree */
  release: (worktreeId: string, options?: WorktreeReleaseOptions) => Promise<void>;
  /** Get worktree by ID */
  get: (worktreeId: string) => Promise<WorktreeInfo | null>;
  /** List worktrees, optionally filtered by repo */
  list: (repoPath?: string) => Promise<WorktreeInfo[]>;
}

export interface AgentStatusAPI {
  /** Save agent status */
  saveAgentStatus: (agentId: string, state: CodingAgentState) => Promise<void>;
  /** Load agent status */
  loadAgentStatus: (agentId: string) => Promise<CodingAgentState | null>;
  /** Delete agent status */
  deleteAgentStatus: (agentId: string) => Promise<void>;
  /** Load all agent statuses */
  loadAllAgentStatuses: () => Promise<CodingAgentState[]>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    canvasAPI?: CanvasAPI;
    codingAgentAPI?: CodingAgentAPI;
    shellAPI?: ShellAPI;
    worktreeAPI?: WorktreeAPI;
    agentStatusAPI?: AgentStatusAPI;
  }
}

export {};

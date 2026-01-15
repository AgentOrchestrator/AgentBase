/**
 * Type declarations for Electron IPC APIs on the Window object.
 *
 * Rule: *.d.ts files should only connect runtime objects to imported types,
 * never define domain types inline. All types are imported from shared package
 * or from the preload module.
 */

import type { CanvasState, CanvasMetadata } from '../main/types/database';
import type { CodingAgentAPI } from '../main/services/coding-agent';
import type {
  WorktreeInfo,
  WorktreeProvisionOptions,
  WorktreeReleaseOptions,
} from '../main/types/worktree';
import type { CodingAgentState } from '../../types/coding-agent-status';

// Re-export types from shared for consumers that import from this file
export type {
  ElectronAPI,
  EditorApp,
  ShellAPI,
  WorktreeAPI,
  AgentStatusAPI,
} from '@agent-orchestrator/shared';

// Desktop-specific CanvasAPI that uses concrete types from database module
// (Shared package uses Record<string, unknown> for flexibility)
export interface CanvasAPI {
  saveCanvas: (canvasId: string, state: CanvasState) => Promise<void>;
  loadCanvas: (canvasId: string) => Promise<CanvasState | null>;
  listCanvases: () => Promise<CanvasMetadata[]>;
  deleteCanvas: (canvasId: string) => Promise<void>;
  getCurrentCanvasId: () => Promise<string | null>;
  setCurrentCanvasId: (canvasId: string) => Promise<void>;
}

// Import types for Window interface declaration
import type {
  ElectronAPI,
  ShellAPI,
  WorktreeAPI,
  AgentStatusAPI,
} from '@agent-orchestrator/shared';

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

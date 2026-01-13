/**
 * Global Type Declarations
 *
 * Extends Window interface with Electron IPC APIs.
 */

import type { ElectronAPI, WorktreeAPI, CodingAgentAPI, AgentStatusAPI, LLMAPI, RepresentationAPI, ShellAPI } from '../main/preload';

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    worktreeAPI?: WorktreeAPI;
    codingAgentAPI?: CodingAgentAPI;
    agentStatusAPI?: AgentStatusAPI;
    llmAPI?: LLMAPI;
    representationAPI?: RepresentationAPI;
    shellAPI?: ShellAPI;
    canvasAPI?: import('../main/preload').CanvasAPI;
  }
}

export {};

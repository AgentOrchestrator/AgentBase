/**
 * Global Type Declarations
 *
 * Extends Window interface with Electron IPC APIs.
 */

import type { ElectronAPI, WorktreeAPI, AgentStatusAPI, LLMAPI, RepresentationAPI, GitAPI, ShellAPI } from '../main/preload';
import type { CodingAgentAPI } from '../main/services/coding-agent';
import type { SessionWatcherAPI } from '@agent-orchestrator/shared';

// Declare SVG module imports (Vite handles these as URLs)
declare module '*.svg' {
  const content: string;
  export default content;
}

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
    gitAPI?: GitAPI;
    sessionWatcherAPI?: SessionWatcherAPI;
  }
}

export {};

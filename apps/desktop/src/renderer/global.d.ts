/**
 * Global Type Declarations
 *
 * Extends Window interface with Electron IPC APIs.
 */

import type {
  ElectronAPI,
  WorktreeAPI,
  AgentStatusAPI,
  LLMAPI,
  RepresentationAPI,
  GitAPI,
  ShellAPI,
  SessionSummaryCacheAPI,
  CanvasStateRequestAPI,
} from '../main/preload';
import type {
  TerminalSessionAPI,
  SessionWatcherAPI,
  RecentWorkspacesAPI,
} from '@agent-orchestrator/shared';
import type { CodingAgentAPI } from '../main/services/coding-agent';

// SVG module declarations moved to vite-env.d.ts

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
    terminalSessionAPI?: TerminalSessionAPI;
    sessionWatcherAPI?: SessionWatcherAPI;
    recentWorkspacesAPI?: RecentWorkspacesAPI;
    sessionSummaryCacheAPI?: SessionSummaryCacheAPI;
    orchestratorAPI?: import('./features/action-pill/store/orchestratorPillTypes').OrchestratorAPI;
    canvasStateRequestAPI?: CanvasStateRequestAPI;
  }
}

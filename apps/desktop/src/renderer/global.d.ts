/**
 * Global Type Declarations
 *
 * Extends Window interface with Electron IPC APIs.
 */

import type { ElectronAPI, WorktreeAPI, CodingAgentAPI, AgentStatusAPI, LLMAPI, RepresentationAPI, GitAPI, RecentWorkspaceAPI } from '../main/preload';

// Extended ShellAPI with directory dialog (added for workspace selection)
interface ExtendedShellAPI {
  openWithEditor: (directoryPath: string, editor: string) => Promise<void>;
  getAvailableEditors: () => Promise<string[]>;
  showInFolder: (path: string) => Promise<void>;
  openDirectoryDialog: (options?: { title?: string; defaultPath?: string }) => Promise<string | null>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    worktreeAPI?: WorktreeAPI;
    codingAgentAPI?: CodingAgentAPI;
    agentStatusAPI?: AgentStatusAPI;
    llmAPI?: LLMAPI;
    representationAPI?: RepresentationAPI;
    shellAPI?: ExtendedShellAPI;
    canvasAPI?: import('../main/preload').CanvasAPI;
    gitAPI?: GitAPI;
    recentWorkspaceAPI?: RecentWorkspaceAPI;
  }
}

export {};

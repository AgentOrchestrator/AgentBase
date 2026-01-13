/**
 * Mock Service Factories
 *
 * Mock factory functions for testing node components in isolation.
 * All services are no-ops that can be spied on.
 */

import type { AgentType, CodingAgentStatusInfo, StatusChangeListener } from '../../../../types/coding-agent-status';
import type { WorktreeInfo } from '../../../main/types/worktree';
import type { ServiceFactories } from '../../context/NodeServicesRegistry';
import type {
  ITerminalService,
  IWorkspaceService,
  IAgentService,
  GitInfo,
} from '../../context/node-services';

/**
 * Create a mock terminal service
 */
function createMockTerminalService(
  nodeId: string,
  terminalId: string
): ITerminalService {
  let isCreated = false;
  const dataListeners = new Set<(data: string) => void>();
  const exitListeners = new Set<(code: number, signal?: number) => void>();

  return {
    nodeId,
    terminalId,
    initialize: async () => {},
    dispose: async () => {
      isCreated = false;
      dataListeners.clear();
      exitListeners.clear();
    },
    create: async () => {
      isCreated = true;
    },
    destroy: async () => {
      isCreated = false;
    },
    restart: async () => {
      isCreated = true;
    },
    write: () => {},
    resize: () => {},
    onData: (callback) => {
      dataListeners.add(callback);
      return () => dataListeners.delete(callback);
    },
    onExit: (callback) => {
      exitListeners.add(callback);
      return () => exitListeners.delete(callback);
    },
    isRunning: () => isCreated,
  };
}

/**
 * Create a mock workspace service
 */
function createMockWorkspaceService(
  nodeId: string,
  workspacePath?: string
): IWorkspaceService {
  let currentPath = workspacePath || null;

  return {
    nodeId,
    get workspacePath() {
      return currentPath;
    },
    initialize: async () => {},
    dispose: async () => {},
    setWorkspacePath: (path) => {
      currentPath = path;
    },
    getWorkspacePath: () => currentPath,
    provisionWorktree: async (branchName) => {
      const worktree: WorktreeInfo = {
        id: `mock-worktree-${Date.now()}`,
        repoPath: currentPath || '/mock/repo',
        worktreePath: `/mock/worktrees/${branchName}`,
        branchName,
        status: 'active',
        provisionedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        agentId: nodeId,
      };
      return worktree;
    },
    releaseWorktree: async () => {},
    getActiveWorktree: async () => null,
    getProjectType: async () => null,
    getGitInfo: async (): Promise<GitInfo | null> => null,
  };
}

/**
 * Create a mock agent service
 */
function createMockAgentService(
  nodeId: string,
  agentId: string,
  agentType: AgentType,
  _terminalService: ITerminalService,
  _workspacePath?: string
): IAgentService {
  let autoStart = false;
  let currentStatus: CodingAgentStatusInfo = {
    status: 'idle',
    startedAt: Date.now(),
  };
  const statusListeners = new Set<StatusChangeListener>();

  return {
    nodeId,
    agentId,
    agentType,
    initialize: async () => {},
    dispose: async () => {
      statusListeners.clear();
    },
    start: async () => {
      currentStatus = { status: 'running', startedAt: Date.now() };
    },
    stop: async () => {
      currentStatus = { status: 'idle', startedAt: Date.now() };
    },
    getStatus: () => currentStatus,
    updateStatus: (status, context) => {
      const oldStatus = currentStatus;
      currentStatus = { status, startedAt: Date.now(), ...context };
      for (const listener of statusListeners) {
        listener(agentId, oldStatus, currentStatus);
      }
    },
    onStatusChange: (listener) => {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    isAutoStartEnabled: () => autoStart,
    setAutoStart: (enabled) => {
      autoStart = enabled;
    },
    getCliCommand: () => {
      const commands: Record<AgentType, string> = {
        claude_code: 'claude',
        cursor: 'cursor',
        codex: 'codex',
        windsurf: 'windsurf',
        vscode: 'code',
        factory: 'factory',
        other: '',
      };
      return commands[agentType] || '';
    },
  };
}

/**
 * Create mock service factories for testing
 */
export function createMockServiceFactories(): ServiceFactories {
  return {
    createTerminalService: createMockTerminalService,
    createWorkspaceService: createMockWorkspaceService,
    createAgentService: createMockAgentService,
  };
}

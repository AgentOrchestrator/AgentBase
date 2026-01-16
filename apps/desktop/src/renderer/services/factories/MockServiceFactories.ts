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
  IConversationService,
  MessagesLoadedListener,
  ErrorListener,
  GitInfo,
} from '../../context/node-services';
import type {
  GenerateResponse,
  StreamCallback,
  SessionInfo,
  CodingAgentSessionContent,
  MessageFilterOptions,
  AgentAdapterEventType,
  AgentEventHandler,
} from '../../context/node-services/coding-agent-adapter';
import type { CodingAgentMessage } from '@agent-orchestrator/shared';

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
  let workspacePath: string | null = _workspacePath || null;
  let currentStatus: CodingAgentStatusInfo = {
    status: 'idle',
    startedAt: Date.now(),
  };
  const statusListeners = new Set<StatusChangeListener>();
  const eventListeners = new Map<AgentAdapterEventType, Set<AgentEventHandler<AgentAdapterEventType>>>();

  // Mock response for generation methods
  const mockResponse: GenerateResponse = {
    content: 'Mock response from agent',
    sessionId: 'mock-session-id',
  };

  return {
    nodeId,
    agentId,
    agentType,
    get workspacePath() {
      return workspacePath;
    },
    initialize: async () => {},
    dispose: async () => {
      statusListeners.clear();
      eventListeners.clear();
    },
    start: async (_sessionId?: string, _initialPrompt?: string) => {
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
    setWorkspace: async (path: string) => {
      workspacePath = path;
    },
    // Generation methods
    sendMessage: async (_prompt: string): Promise<GenerateResponse> => {
      return mockResponse;
    },
    sendMessageStreaming: async (_prompt: string, onChunk: StreamCallback): Promise<GenerateResponse> => {
      onChunk('Mock ');
      onChunk('streaming ');
      onChunk('response');
      return mockResponse;
    },
    resumeSession: async (_sessionId: string, _prompt: string): Promise<GenerateResponse> => {
      return mockResponse;
    },
    resumeSessionStreaming: async (
      _sessionId: string,
      _prompt: string,
      onChunk: StreamCallback
    ): Promise<GenerateResponse> => {
      onChunk('Mock ');
      onChunk('resumed ');
      onChunk('response');
      return mockResponse;
    },
    // Session queries
    getSession: async (
      _sessionId: string,
      _filter?: MessageFilterOptions
    ): Promise<CodingAgentSessionContent | null> => {
      return {
        id: 'mock-session-id',
        agentType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 2,
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Mock user message',
            timestamp: new Date().toISOString(),
          },
          {
            id: 'msg-2',
            role: 'assistant',
            content: 'Mock assistant response',
            timestamp: new Date().toISOString(),
          },
        ],
      };
    },
    isSessionActive: async (_sessionId: string): Promise<boolean> => {
      return true;
    },
    getLatestSession: async (): Promise<SessionInfo | null> => {
      return {
        id: 'mock-session-id',
        agentType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },
    // Events
    onAgentEvent: <T extends AgentAdapterEventType>(
      type: T,
      handler: AgentEventHandler<T>
    ): (() => void) => {
      if (!eventListeners.has(type)) {
        eventListeners.set(type, new Set());
      }
      const handlers = eventListeners.get(type)!;
      handlers.add(handler as unknown as AgentEventHandler<AgentAdapterEventType>);
      return () => handlers.delete(handler as unknown as AgentEventHandler<AgentAdapterEventType>);
    },
  };
}

/**
 * Create a mock conversation service
 */
function createMockConversationService(
  nodeId: string,
  sessionId: string,
  agentType: string
): IConversationService {
  let messages: CodingAgentMessage[] = [];
  let isLoading = false;
  let error: string | null = null;

  const messagesListeners = new Set<MessagesLoadedListener>();
  const errorListeners = new Set<ErrorListener>();

  // Generate mock messages
  const mockMessages: CodingAgentMessage[] = [
    {
      id: 'mock-msg-1',
      role: 'user',
      content: 'Hello, can you help me with a coding task?',
      timestamp: new Date(Date.now() - 60000).toISOString(),
    },
    {
      id: 'mock-msg-2',
      role: 'assistant',
      content: 'Of course! I\'d be happy to help. What would you like to work on?',
      timestamp: new Date(Date.now() - 30000).toISOString(),
    },
  ];

  return {
    nodeId,
    sessionId,
    agentType,
    initialize: async () => {},
    dispose: async () => {
      messages = [];
      error = null;
      messagesListeners.clear();
      errorListeners.clear();
    },
    loadSession: async () => {
      isLoading = true;
      // Simulate async load
      await new Promise((resolve) => setTimeout(resolve, 100));
      messages = mockMessages;
      isLoading = false;
      for (const listener of messagesListeners) {
        listener(messages);
      }
    },
    getMessages: () => messages,
    isLoading: () => isLoading,
    getError: () => error,
    onMessagesLoaded: (listener) => {
      messagesListeners.add(listener);
      return () => messagesListeners.delete(listener);
    },
    onError: (listener) => {
      errorListeners.add(listener);
      return () => errorListeners.delete(listener);
    },
    refresh: async () => {
      messages = [];
      error = null;
      isLoading = true;
      await new Promise((resolve) => setTimeout(resolve, 100));
      messages = mockMessages;
      isLoading = false;
      for (const listener of messagesListeners) {
        listener(messages);
      }
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
    createConversationService: createMockConversationService,
  };
}

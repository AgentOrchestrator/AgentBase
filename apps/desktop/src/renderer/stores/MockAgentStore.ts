/**
 * Mock Agent Store Implementation
 *
 * Provides hardcoded mock data for development and testing.
 * Implements IAgentStore interface for seamless swapping with real implementation.
 */

import type {
  IAgentStore,
  AgentChangeListener,
  AllAgentsChangeListener,
} from './IAgentStore';
import type { AgentNodeData } from '../types/agent-node';
import {
  createDefaultAgentTitle,
  createPercentageProgress,
  createTodoListProgress,
} from '../types/agent-node';

/**
 * Mock agent data showcasing different states
 */
function createMockAgents(): AgentNodeData[] {
  return [
    {
      agentId: 'agent-001',
      terminalId: 'terminal-mock-001',
      agentType: 'claude_code',
      status: 'running',
      statusInfo: {
        status: 'running',
        startedAt: Date.now() - 30000,
      },
      title: createDefaultAgentTitle('Implementing Auth Feature'),
      summary: 'Adding JWT-based authentication with refresh token support',
      progress: createTodoListProgress(
        [
          { content: 'Set up auth middleware', completed: true },
          { content: 'Implement login endpoint', completed: true },
          {
            content: 'Add refresh token logic',
            completed: false,
            activeForm: 'Adding refresh token logic',
          },
          { content: 'Write unit tests', completed: false },
          { content: 'Update documentation', completed: false },
        ],
        'Auth Implementation'
      ),
      attachments: [
        {
          type: 'linear-issue',
          id: 'issue-123',
          identifier: 'ENG-456',
          title: 'Add JWT authentication to API',
          url: 'https://linear.app/team/issue/ENG-456',
          state: { name: 'In Progress', color: '#f59e0b' },
          priority: 2,
        },
      ],
      activeView: 'overview',
      workspacePath: '/Users/dev/projects/api-server',
    },
    {
      agentId: 'agent-002',
      terminalId: 'terminal-mock-002',
      agentType: 'cursor',
      status: 'thinking',
      statusInfo: {
        status: 'thinking',
        startedAt: Date.now() - 5000,
        subagentName: 'Plan Agent',
      },
      title: createDefaultAgentTitle('Database Migration'),
      summary: 'Planning schema changes for user preferences table',
      progress: createPercentageProgress(35, 'Planning phase'),
      attachments: [],
      activeView: 'overview',
      workspacePath: '/Users/dev/projects/database-service',
    },
    {
      agentId: 'agent-003',
      terminalId: 'terminal-mock-003',
      agentType: 'claude_code',
      status: 'executing_tool',
      statusInfo: {
        status: 'executing_tool',
        toolName: 'Bash',
        toolType: 'bash',
        startedAt: Date.now() - 2000,
      },
      title: { value: 'Running Tests', isManuallySet: true },
      summary: 'Executing test suite for auth module',
      progress: createPercentageProgress(78, 'Test execution'),
      attachments: [],
      activeView: 'terminal',
      workspacePath: '/Users/dev/projects/api-server',
    },
    {
      agentId: 'agent-004',
      terminalId: 'terminal-mock-004',
      agentType: 'claude_code',
      status: 'completed',
      statusInfo: {
        status: 'completed',
        startedAt: Date.now() - 120000,
      },
      title: createDefaultAgentTitle('Code Review Complete'),
      summary: 'Reviewed PR #234 - Added suggestions for error handling',
      progress: createTodoListProgress(
        [
          { content: 'Review code changes', completed: true },
          { content: 'Check test coverage', completed: true },
          { content: 'Add review comments', completed: true },
          { content: 'Approve PR', completed: true },
        ],
        'Review Tasks'
      ),
      attachments: [],
      activeView: 'overview',
      workspacePath: '/Users/dev/projects/frontend-app',
    },
    {
      agentId: 'agent-005',
      terminalId: 'terminal-mock-005',
      agentType: 'cursor',
      status: 'error',
      statusInfo: {
        status: 'error',
        errorMessage: 'Build failed: TypeScript compilation error',
        startedAt: Date.now() - 60000,
      },
      title: createDefaultAgentTitle('Build Failed'),
      summary: 'TypeScript compilation failed with 3 errors',
      progress: null,
      attachments: [],
      activeView: 'overview',
      workspacePath: '/Users/dev/projects/shared-lib',
    },
  ];
}

/**
 * Mock implementation of IAgentStore
 */
export class MockAgentStore implements IAgentStore {
  private agents: Map<string, AgentNodeData>;
  private listeners: Map<string, Set<AgentChangeListener>>;
  private allListeners: Set<AllAgentsChangeListener>;

  constructor() {
    this.agents = new Map();
    this.listeners = new Map();
    this.allListeners = new Set();

    // Initialize with mock data
    const mockAgents = createMockAgents();
    for (const agent of mockAgents) {
      this.agents.set(agent.agentId, agent);
    }
  }

  getAgent(agentId: string): AgentNodeData | null {
    return this.agents.get(agentId) ?? null;
  }

  getAllAgents(): AgentNodeData[] {
    return Array.from(this.agents.values());
  }

  subscribe(agentId: string, listener: AgentChangeListener): () => void {
    if (!this.listeners.has(agentId)) {
      this.listeners.set(agentId, new Set());
    }
    this.listeners.get(agentId)!.add(listener);

    // Return unsubscribe function
    return () => {
      const agentListeners = this.listeners.get(agentId);
      if (agentListeners) {
        agentListeners.delete(listener);
        if (agentListeners.size === 0) {
          this.listeners.delete(agentId);
        }
      }
    };
  }

  subscribeAll(listener: AllAgentsChangeListener): () => void {
    this.allListeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.allListeners.delete(listener);
    };
  }

  /**
   * Notify listeners of agent changes (for internal use)
   */
  private notifyListeners(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    // Notify specific agent listeners
    const agentListeners = this.listeners.get(agentId);
    if (agentListeners) {
      for (const listener of agentListeners) {
        listener(agent);
      }
    }

    // Notify all-agents listeners
    const allAgents = this.getAllAgents();
    for (const listener of this.allListeners) {
      listener(allAgents);
    }
  }
}

/**
 * Agent State Types
 *
 * Central type definitions for all agent state.
 * This is THE source of truth for understanding what state an agent can have.
 */

import type { AgentType, CodingAgentStatus } from '../../../../types/coding-agent-status';
import type { GitInfo } from '@agent-orchestrator/shared';
import type { AgentNodeData } from '../../types/agent-node';

// =============================================================================
// Workspace State
// =============================================================================

export type WorkspaceSource = 'attachment' | 'inherited' | 'manual' | null;

export interface WorkspaceState {
  /** The resolved workspace path */
  path: string | null;
  /** How the workspace was obtained */
  source: WorkspaceSource;
  /** Git repository info (branch, remote, status) */
  gitInfo: GitInfo | null;
  /** Whether git info is currently loading */
  isLoadingGit: boolean;
}

// =============================================================================
// Session State
// =============================================================================

export type SessionReadiness = 'idle' | 'ready';

export interface SessionState {
  /** Explicit session ID for agent runs */
  id: string | null;
  /** Whether a session is ready to use */
  readiness: SessionReadiness;
}

// =============================================================================
// Agent Config (immutable after init)
// =============================================================================

export interface AgentConfig {
  /** React Flow node ID */
  nodeId: string;
  /** Unique agent identifier */
  agentId: string;
  /** Terminal ID for the embedded terminal */
  terminalId: string;
  /** Agent type (claude_code, cursor, etc.) */
  agentType: AgentType;
  /** Timestamp when agent was created (for session matching) */
  createdAt: number | undefined;
  /** Initial prompt to send to the agent */
  initialPrompt: string | undefined;
}

// =============================================================================
// Agent Actions
// =============================================================================

export interface AgentActions {
  /** Set the workspace path (creates attachment) */
  setWorkspace: (path: string) => void;
  /** Dispatch node deletion */
  deleteNode: () => void;
}

// =============================================================================
// Complete Agent State
// =============================================================================

/**
 * AgentState - The complete state for a single agent node.
 *
 * This is the single source of truth for all agent state.
 * When you need to understand what an agent's state is, look here.
 */
export interface AgentState {
  // ---------------------------------------------------------------------------
  // Core Identity & Config
  // ---------------------------------------------------------------------------
  /** Immutable configuration set at initialization */
  config: AgentConfig;

  // ---------------------------------------------------------------------------
  // Runtime State
  // ---------------------------------------------------------------------------
  /** Current agent status */
  status: CodingAgentStatus;
  /** Whether the agent state is fully initialized */
  isInitialized: boolean;

  // ---------------------------------------------------------------------------
  // Workspace
  // ---------------------------------------------------------------------------
  /** Workspace-related state (path, git, worktree) */
  workspace: WorkspaceState;

  // ---------------------------------------------------------------------------
  // Session
  // ---------------------------------------------------------------------------
  /** Session matching state */
  session: SessionState;

  // ---------------------------------------------------------------------------
  // Node Data (synced with React Flow)
  // ---------------------------------------------------------------------------
  /** The full node data (for compatibility) */
  nodeData: AgentNodeData;

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  /** Actions to mutate agent state */
  actions: AgentActions;
}

// =============================================================================
// Hook Input
// =============================================================================

export interface UseAgentStateInput {
  /** React Flow node ID */
  nodeId: string;
  /** Initial node data from React Flow */
  initialNodeData: AgentNodeData;
  // Note: agentService removed - permission events now handled globally by SharedEventDispatcher
}

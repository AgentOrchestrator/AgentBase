/**
 * useAgentState - Central hook for agent state management
 *
 * This is THE single source of truth for agent state.
 * When debugging or understanding agent behavior, start here.
 */

export type {
  AgentActions,
  AgentConfig,
  AgentState,
  SessionReadiness,
  SessionState,
  UseAgentStateInput,
  WorkspaceSource,
  WorkspaceState,
} from './types';
export { useAgentState } from './useAgentState';

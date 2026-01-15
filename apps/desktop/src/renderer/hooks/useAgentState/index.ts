/**
 * useAgentState - Central hook for agent state management
 *
 * This is THE single source of truth for agent state.
 * When debugging or understanding agent behavior, start here.
 */

export { useAgentState } from './useAgentState';
export type {
  AgentState,
  UseAgentStateInput,
  WorkspaceState,
  WorkspaceSource,
  SessionState,
  SessionReadiness,
  AgentConfig,
  AgentActions,
  CodingAgentAPI,
  SessionSummary,
  SessionContent,
  CodingAgentMessage,
} from './types';

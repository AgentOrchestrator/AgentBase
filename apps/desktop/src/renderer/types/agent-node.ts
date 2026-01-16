/**
 * Agent Node Type Definitions
 *
 * Re-exports all agent node types from @agent-orchestrator/shared.
 * This file is kept for backwards compatibility with existing imports.
 */

export type {
  // Progress types
  BaseProgress,
  PercentageProgress,
  TodoItem,
  TodoListProgress,
  AgentProgress,
  // Title types
  AgentTitle,
  // View types
  AgentNodeView,
  AgentChatMessage,
  // Main node data
  AgentNodeData,
} from '@agent-orchestrator/shared';

export {
  // Type guards
  isPercentageProgress,
  isTodoListProgress,
  // Helper functions
  createDefaultAgentTitle,
  createPercentageProgress,
  createTodoListProgress,
  getTodoListCompletionPercent,
} from '@agent-orchestrator/shared';

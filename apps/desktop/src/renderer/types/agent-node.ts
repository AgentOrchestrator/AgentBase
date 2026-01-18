/**
 * Agent Node Type Definitions
 *
 * Re-exports all agent node types from @agent-orchestrator/shared.
 * This file is kept for backwards compatibility with existing imports.
 */

export type {
  AgentChatMessage,
  // Main node data
  AgentNodeData,
  // View types
  AgentNodeView,
  AgentProgress,
  // Title types
  AgentTitle,
  // Progress types
  BaseProgress,
  PercentageProgress,
  TodoItem,
  TodoListProgress,
} from '@agent-orchestrator/shared';

export {
  // Helper functions
  createDefaultAgentTitle,
  createPercentageProgress,
  createTodoListProgress,
  getTodoListCompletionPercent,
  // Type guards
  isPercentageProgress,
  isTodoListProgress,
} from '@agent-orchestrator/shared';

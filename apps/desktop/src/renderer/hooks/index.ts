export { useCanvasPersistence } from './useCanvasPersistence';
export { useSessionFileWatcher } from './useSessionFileWatcher';
export { useAutoTitleFromSession } from './useAutoTitleFromSession';
export { useAutoSummaryFromSession } from './useAutoSummaryFromSession';
export { useAutoLastUserMessageFromSession } from './useAutoLastUserMessageFromSession';
export * from './canvasConverters';
export {
  useAgentHierarchy,
  type AgentHierarchy,
  type AgentHierarchyEntry,
  type UseAgentHierarchyReturn,
} from './useAgentHierarchy';

// =============================================================================
// useAgentState - THE SINGLE SOURCE OF TRUTH for agent state
// =============================================================================
export {
  useAgentState,
  type AgentState,
  type UseAgentStateInput,
  type WorkspaceState,
  type SessionState,
  type AgentConfig,
  type AgentActions,
  type WorkspaceSource,
} from './useAgentState';

// =============================================================================
// Canvas UI State Hooks
// =============================================================================

export { useFolderLock, type UseFolderLockReturn } from './useFolderLock';

export {
  useFolderHighlight,
  applyHighlightStylesToNodes,
  type UseFolderHighlightReturn,
} from './useFolderHighlight';

export { useSidebarState, type UseSidebarStateReturn } from './useSidebarState';

export { usePillState, type UsePillStateReturn } from './usePillState';

export {
  useCanvasDrop,
  type UseCanvasDropReturn,
  type UseCanvasDropOptions,
  type LinearIssue,
} from './useCanvasDrop';

// =============================================================================
// Fork Modal Hook - Manages fork modal UI state and operations
// =============================================================================
export { useForkModal } from './useForkModal';
export type {
  ForkModalData,
  ForkConfirmResult,
  ForkConfirmError,
  UseForkModalReturn,
  UseForkModalInput,
} from './useForkModal';

// =============================================================================
// Canvas Actions Hook - Node creation actions for canvas
// =============================================================================
export { useCanvasActions } from './useCanvasActions';
export type { UseCanvasActionsReturn, UseCanvasActionsInput } from './useCanvasActions';

// =============================================================================
// Linear Integration Hook - Linear API and state management
// =============================================================================
export { useLinear } from './useLinear';
export type { UseLinearReturn } from './useLinear';
// Re-export Linear types from the store for convenience
export type {
  LinearIssue as LinearIssueType,
  LinearProject as LinearProjectType,
  LinearMilestone as LinearMilestoneType,
  LinearWorkflowState as LinearWorkflowStateType,
  MilestoneOption as LinearMilestoneOption,
  LinearFilterState,
} from '../stores/ILinearStore';

// =============================================================================
// View Mode Hook - Terminal/Chat view coordination
// =============================================================================
export { useAgentViewMode } from './useAgentViewMode';
export type { UseAgentViewModeInput, UseAgentViewModeReturn } from './useAgentViewMode';

// =============================================================================
// Preloaded Chat Messages Hook - Background message loading for fast view switch
// =============================================================================
export { usePreloadedChatMessages } from './usePreloadedChatMessages';
export type {
  UsePreloadedChatMessagesOptions,
  UsePreloadedChatMessagesReturn,
} from './usePreloadedChatMessages';

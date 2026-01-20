export * from './canvasConverters';
export {
  type AgentHierarchy,
  type AgentHierarchyEntry,
  type UseAgentHierarchyReturn,
  useAgentHierarchy,
} from './useAgentHierarchy';
// =============================================================================
// useAgentState - THE SINGLE SOURCE OF TRUTH for agent state
// =============================================================================
export {
  type AgentActions,
  type AgentConfig,
  type AgentState,
  type SessionState,
  type UseAgentStateInput,
  useAgentState,
  type WorkspaceSource,
  type WorkspaceState,
} from './useAgentState';
// =============================================================================
// Auto-Fork Hook - LocalStorage-persisted auto-fork setting
// =============================================================================
export { type UseAutoForkReturn, useAutoFork } from './useAutoFork';
export { useAutoTitleFromSession } from './useAutoTitleFromSession';
export { useCanvasPersistence } from './useCanvasPersistence';
// =============================================================================
// Canvas UI State Hook - Modal and overlay states
// =============================================================================
export { type UseCanvasUIStateReturn, useCanvasUIState } from './useCanvasUIState';
// =============================================================================
// Context Menu Hook - Right-click menu state
// =============================================================================
export {
  type ContextMenuPosition,
  type UseContextMenuReturn,
  useContextMenu,
} from './useContextMenu';
// =============================================================================
// GitHub User Hook - GitHub username fetching
// =============================================================================
export { type UseGithubUserReturn, useGithubUser } from './useGithubUser';
// =============================================================================
// Keyboard Modifiers Hook - Drag/shift key tracking
// =============================================================================
export { type UseKeyboardModifiersReturn, useKeyboardModifiers } from './useKeyboardModifiers';
// =============================================================================
// Linear Panel Hook - Linear panel collapse and resize
// =============================================================================
export {
  type UseLinearPanelInput,
  type UseLinearPanelReturn,
  useLinearPanel,
} from './useLinearPanel';
// =============================================================================
// Pending Agent Hook - Pending agent creation state
// =============================================================================
export {
  type PendingAgentPosition,
  type UsePendingAgentReturn,
  usePendingAgent,
} from './usePendingAgent';
export { useSessionFileWatcher } from './useSessionFileWatcher';

// =============================================================================
// Canvas UI State Hooks
// =============================================================================

// Re-export Linear types from the store for convenience
export type {
  LinearFilterState,
  LinearIssue as LinearIssueType,
  LinearMilestone as LinearMilestoneType,
  LinearProject as LinearProjectType,
  LinearWorkflowState as LinearWorkflowStateType,
  MilestoneOption as LinearMilestoneOption,
} from '../stores/ILinearStore';
export type { UseAgentViewModeInput, UseAgentViewModeReturn } from './useAgentViewMode';
// =============================================================================
// View Mode Hook - Terminal/Chat view coordination
// =============================================================================
export { useAgentViewMode } from './useAgentViewMode';
export type { UseCanvasActionsInput, UseCanvasActionsReturn } from './useCanvasActions';
// =============================================================================
// Canvas Actions Hook - Node creation actions for canvas
// =============================================================================
export { useCanvasActions } from './useCanvasActions';
export {
  type LinearIssue,
  type UseCanvasDropOptions,
  type UseCanvasDropReturn,
  useCanvasDrop,
} from './useCanvasDrop';
export type {
  UseChatMessagesOptions,
  UseChatMessagesReturn,
} from './useChatMessages';
// =============================================================================
// Chat Messages Hook - Unified message loading, file watching, and sending
// =============================================================================
export { useChatMessages } from './useChatMessages';
export {
  applyHighlightStylesToNodes,
  type UseFolderHighlightReturn,
  useFolderHighlight,
} from './useFolderHighlight';
export { type UseFolderLockReturn, useFolderLock } from './useFolderLock';
export type {
  ForkConfirmError,
  ForkConfirmResult,
  ForkModalData,
  UseForkModalInput,
  UseForkModalReturn,
} from './useForkModal';
// =============================================================================
// Fork Modal Hook - Manages fork modal UI state and operations
// =============================================================================
export { useForkModal } from './useForkModal';
export type { UseLinearReturn } from './useLinear';
// =============================================================================
// Linear Integration Hook - Linear API and state management
// =============================================================================
export { useLinear } from './useLinear';
export { type UsePillStateReturn, usePillState } from './usePillState';
export type {
  SessionOverviewState,
  UseSessionOverviewOptions,
  UseSessionOverviewReturn,
} from './useSessionOverview';

// =============================================================================
// Session Overview Hook - Unified session data management
// =============================================================================
export { useSessionOverview } from './useSessionOverview';
export { type UseSidebarStateReturn, useSidebarState } from './useSidebarState';

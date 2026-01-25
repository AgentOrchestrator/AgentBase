export type {
  UseCanvasActionsInput,
  UseCanvasActionsReturn,
} from '../features/canvas/hooks/useCanvasActions';
export { useCanvasActions } from '../features/canvas/hooks/useCanvasActions';
export {
  type LinearIssue,
  type UseCanvasDropOptions,
  type UseCanvasDropReturn,
  useCanvasDrop,
} from '../features/canvas/hooks/useCanvasDrop';
// =============================================================================
// Canvas Hooks - Re-exported from features/canvas/hooks
// =============================================================================
export {
  type CanvasPersistenceStore,
  useCanvasPersistenceStore,
} from '../features/canvas/hooks/useCanvasPersistenceStore';
export {
  type UseCanvasUIStateReturn,
  useCanvasUIState,
} from '../features/canvas/hooks/useCanvasUIState';
export {
  type ContextMenuPosition,
  type UseContextMenuReturn,
  useContextMenu,
} from '../features/canvas/hooks/useContextMenu';
export type {
  ForkConfirmError,
  ForkConfirmResult,
  ForkModalData,
  MessagePreview,
  UseForkModalInput,
  UseForkModalReturn,
} from '../features/canvas/hooks/useForkModal';
export { useForkModal } from '../features/canvas/hooks/useForkModal';
export {
  type UseKeyboardModifiersReturn,
  useKeyboardModifiers,
} from '../features/canvas/hooks/useKeyboardModifiers';
// NOTE: useNodeOperations is no longer exported publicly.
// It's used internally by Canvas.tsx for operations like highlighting.
// Child components should use useNodeActions() from NodeActionsContext instead.
export {
  type PendingAgentPosition,
  type UsePendingAgentReturn,
  usePendingAgent,
} from '../features/canvas/hooks/usePendingAgent';
export {
  type PillStore,
  type UsePillStateReturn,
  usePillState,
  usePillStore,
} from '../features/issues-pill/usePillState';
export type { UseLinearReturn } from '../features/linear/hooks/useLinear';
// =============================================================================
// Linear Integration Hook - Linear API and state management
// =============================================================================
export { useLinear } from '../features/linear/hooks/useLinear';
// =============================================================================
// Linear Panel Hook - Linear panel collapse and resize
// =============================================================================
export {
  type LinearPanelStore,
  type UseLinearPanelInput,
  type UseLinearPanelReturn,
  useLinearPanel,
  useLinearPanelStore,
} from '../features/linear/hooks/useLinearPanel';
export {
  type AgentHierarchy,
  type AgentHierarchyEntry,
  type UseAgentHierarchyReturn,
  useAgentHierarchy,
} from '../features/sidebar/hooks/useAgentHierarchy';
export {
  applyHighlightStylesToNodes,
  type FolderHighlightStore,
  type UseFolderHighlightReturn,
  useFolderHighlight,
  useFolderHighlightStore,
} from '../features/sidebar/hooks/useFolderHighlight';
export { type UseFolderLockReturn, useFolderLock } from '../features/sidebar/hooks/useFolderLock';
export {
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  type SidebarStore,
  type UseSidebarStateReturn,
  useSidebarState,
} from '../features/sidebar/hooks/useSidebarState';
// =============================================================================
// Re-export Linear types from the store for convenience
// =============================================================================
export type {
  LinearFilterState,
  LinearIssue as LinearIssueType,
  LinearMilestone as LinearMilestoneType,
  LinearProject as LinearProjectType,
  LinearWorkflowState as LinearWorkflowStateType,
  MilestoneOption as LinearMilestoneOption,
} from '../stores/ILinearStore';
export * from './canvasConverters';
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
export type { UseAgentViewModeInput, UseAgentViewModeReturn } from './useAgentViewMode';
// =============================================================================
// View Mode Hook - Terminal/Chat view coordination
// =============================================================================
export { useAgentViewMode } from './useAgentViewMode';
// =============================================================================
// Auto-Fork Hook - LocalStorage-persisted auto-fork setting
// =============================================================================
export { type UseAutoForkReturn, useAutoFork } from './useAutoFork';
export { useAutoTitleFromSession } from './useAutoTitleFromSession';
export type {
  UseChatMessagesOptions,
  UseChatMessagesReturn,
} from './useChatMessages';
// =============================================================================
// Chat Messages Hook - Unified message loading, file watching, and sending
// =============================================================================
export { useChatMessages } from './useChatMessages';
// =============================================================================
// GitHub User Hook - GitHub username fetching
// =============================================================================
export { type UseGithubUserReturn, useGithubUser } from './useGithubUser';
export { useSessionFileWatcher } from './useSessionFileWatcher';
export type {
  SessionOverviewState,
  UseSessionOverviewOptions,
  UseSessionOverviewReturn,
} from './useSessionOverview';
// =============================================================================
// Session Overview Hook - Unified session data management
// =============================================================================
export { useSessionOverview } from './useSessionOverview';
// =============================================================================
// Worktree Config Hook - Worktree configuration state for New Agent Modal
// =============================================================================
export { useWorktreeConfigState, type WorktreeConfigStore } from './useWorktreeConfigState';

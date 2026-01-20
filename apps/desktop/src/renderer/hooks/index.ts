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
export { useCanvasPersistence } from '../features/canvas/hooks/useCanvasPersistence';
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
  UseForkModalInput,
  UseForkModalReturn,
} from '../features/canvas/hooks/useForkModal';
export { useForkModal } from '../features/canvas/hooks/useForkModal';
export {
  type UseKeyboardModifiersReturn,
  useKeyboardModifiers,
} from '../features/canvas/hooks/useKeyboardModifiers';
export {
  type PendingAgentPosition,
  type UsePendingAgentReturn,
  usePendingAgent,
} from '../features/canvas/hooks/usePendingAgent';
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
export {
  applyHighlightStylesToNodes,
  type UseFolderHighlightReturn,
  useFolderHighlight,
} from './useFolderHighlight';
export { type UseFolderLockReturn, useFolderLock } from './useFolderLock';
// =============================================================================
// GitHub User Hook - GitHub username fetching
// =============================================================================
export { type UseGithubUserReturn, useGithubUser } from './useGithubUser';
export type { UseLinearReturn } from './useLinear';
// =============================================================================
// Linear Integration Hook - Linear API and state management
// =============================================================================
export { useLinear } from './useLinear';
// =============================================================================
// Linear Panel Hook - Linear panel collapse and resize
// =============================================================================
export {
  type UseLinearPanelInput,
  type UseLinearPanelReturn,
  useLinearPanel,
} from './useLinearPanel';
export { type UsePillStateReturn, usePillState } from './usePillState';
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
export { type UseSidebarStateReturn, useSidebarState } from './useSidebarState';

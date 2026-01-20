/**
 * Sidebar Hooks
 *
 * Hooks for managing sidebar state and functionality.
 * State hooks use Zustand stores for global state management.
 */

export {
  type AgentHierarchy,
  type AgentHierarchyEntry,
  type UseAgentHierarchyReturn,
  useAgentHierarchy,
} from './useAgentHierarchy';
export {
  applyHighlightStylesToNodes,
  type FolderHighlightStore,
  type UseFolderHighlightReturn,
  useFolderHighlight,
  useFolderHighlightStore,
} from './useFolderHighlight';

export { type UseFolderLockReturn, useFolderLock } from './useFolderLock';
export {
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  type SidebarStore,
  type UseSidebarStateReturn,
  useSidebarState,
} from './useSidebarState';

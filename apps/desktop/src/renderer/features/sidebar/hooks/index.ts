/**
 * Sidebar Hooks
 *
 * Hooks for managing sidebar state and functionality.
 */

export {
  type AgentHierarchy,
  type AgentHierarchyEntry,
  type UseAgentHierarchyReturn,
  useAgentHierarchy,
} from './useAgentHierarchy';
export {
  applyHighlightStylesToNodes,
  type UseFolderHighlightReturn,
  useFolderHighlight,
} from './useFolderHighlight';

export { type UseFolderLockReturn, useFolderLock } from './useFolderLock';
export {
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  type UseSidebarStateReturn,
  useSidebarState,
} from './useSidebarState';

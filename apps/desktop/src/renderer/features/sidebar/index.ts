/**
 * Sidebar Feature
 *
 * Contains the sidebar UI for agent hierarchy navigation,
 * folder management, and Linear issues integration.
 */

export {
  AgentHierarchySection,
  type AgentHierarchySectionProps,
} from './components/AgentHierarchySection';
export { BranchItem, type BranchItemProps } from './components/BranchItem';
export { FolderItem, type FolderItemProps } from './components/FolderItem';
export { LinearIssuesPanel, type LinearIssuesPanelProps } from './components/LinearIssuesPanel';
export { SidebarHeader, type SidebarHeaderProps } from './components/SidebarHeader';
// Hooks
export {
  type AgentHierarchy,
  type AgentHierarchyEntry,
  applyHighlightStylesToNodes,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  type UseAgentHierarchyReturn,
  type UseFolderHighlightReturn,
  type UseFolderLockReturn,
  type UseSidebarStateReturn,
  useAgentHierarchy,
  useFolderHighlight,
  useFolderLock,
  useSidebarState,
} from './hooks';
// Components
export { Sidebar, type SidebarProps } from './Sidebar';

/**
 * Sidebar Feature Component
 *
 * Displays the canvas sidebar with:
 * - User info header
 * - Agent hierarchy (projects -> branches -> agents)
 * - Folder lock/highlight controls
 * - Linear issues panel (when connected)
 */
import type {
  AgentHierarchy,
  LinearIssue,
  UseFolderHighlightReturn,
  UseFolderLockReturn,
  UseLinearPanelReturn,
  UseLinearReturn,
  UseSidebarStateReturn,
} from '../../hooks';
import { AgentHierarchySection } from './components/AgentHierarchySection';
import { LinearIssuesPanel } from './components/LinearIssuesPanel';
import { SidebarHeader } from './components/SidebarHeader';

export interface SidebarProps {
  /** Sidebar state from useSidebarState hook */
  sidebar: UseSidebarStateReturn;
  /** GitHub user info */
  githubUser: {
    username: string | null;
    error: string | null;
  };
  /** Agent hierarchy data organized by project -> branch -> agents */
  agentHierarchy: AgentHierarchy;
  /** Map of project names to their folder paths */
  folderPathMap: Record<string, string | undefined>;
  /** Folder lock state and actions */
  folderLock: UseFolderLockReturn;
  /** Folder highlight state and actions */
  folderHighlight: UseFolderHighlightReturn;
  /** Linear integration state */
  linear: UseLinearReturn;
  /** Linear panel collapse/resize state */
  linearPanel: UseLinearPanelReturn;
  /** Whether any agents exist on the canvas */
  hasAgents: boolean;
  /** Handler for Linear issue drag start */
  onIssueDragStart: (event: React.DragEvent, issue: LinearIssue) => void;
  /** Handler for Linear issue click */
  onIssueClick: (issueId: string) => void;
}

export function Sidebar({
  sidebar,
  githubUser,
  agentHierarchy,
  folderPathMap,
  folderLock,
  folderHighlight,
  linear,
  linearPanel,
  hasAgents,
  onIssueDragStart,
  onIssueClick,
}: SidebarProps) {
  return (
    <>
      <div
        className={`canvas-sidebar ${sidebar.isSidebarCollapsed ? 'collapsed' : ''} ${linearPanel.isResizing ? 'resizing' : ''}`}
        style={{ width: sidebar.isSidebarCollapsed ? 0 : `${sidebar.sidebarWidth}px` }}
      >
        <SidebarHeader
          username={githubUser.username}
          error={githubUser.error}
          onToggle={sidebar.toggleSidebar}
        />

        {!sidebar.isSidebarCollapsed && (
          <div className="sidebar-content">
            {hasAgents && (
              <AgentHierarchySection
                hierarchy={agentHierarchy}
                folderPathMap={folderPathMap}
                collapsedProjects={sidebar.collapsedProjects}
                collapsedBranches={sidebar.collapsedBranches}
                onToggleProject={sidebar.toggleProject}
                onToggleBranch={sidebar.toggleBranch}
                folderLock={folderLock}
                folderHighlight={folderHighlight}
              />
            )}

            {linear.isConnected && (
              <LinearIssuesPanel
                linear={linear}
                linearPanel={linearPanel}
                onIssueDragStart={onIssueDragStart}
                onIssueClick={onIssueClick}
              />
            )}
          </div>
        )}
      </div>

      {/* Resize Handle */}
      {!sidebar.isSidebarCollapsed && (
        <div className="sidebar-resize-handle" onMouseDown={linearPanel.handleResizeStart} />
      )}
    </>
  );
}

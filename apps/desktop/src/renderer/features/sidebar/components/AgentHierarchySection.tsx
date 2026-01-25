/**
 * Agent Hierarchy Section Component
 *
 * Displays the project -> branch -> agent hierarchy with
 * collapsible folders and lock/highlight functionality.
 */
import type { AgentHierarchy, UseFolderHighlightReturn, UseFolderLockReturn } from '../../../hooks';
import { BranchItem } from './BranchItem';
import { FolderItem } from './FolderItem';

export interface AgentHierarchySectionProps {
  hierarchy: AgentHierarchy;
  folderPathMap: Record<string, string | undefined>;
  collapsedProjects: Set<string>;
  collapsedBranches: Set<string>;
  onToggleProject: (projectName: string) => void;
  onToggleBranch: (branchKey: string) => void;
  folderLock: UseFolderLockReturn;
  folderHighlight: UseFolderHighlightReturn;
}

export function AgentHierarchySection({
  hierarchy,
  folderPathMap,
  collapsedProjects,
  collapsedBranches,
  onToggleProject,
  onToggleBranch,
  folderLock,
  folderHighlight,
}: AgentHierarchySectionProps) {
  return (
    <div className="sidebar-section">
      {Object.entries(hierarchy).map(([projectName, branches]) => {
        const isProjectCollapsed = collapsedProjects.has(projectName);
        const projectPath = folderPathMap[projectName];
        const isLocked = folderLock.lockedFolderPath === projectPath;
        const isHovered = folderLock.hoveredFolderPath === projectPath;
        const showLock = isLocked || (isHovered && !isLocked);
        // No highlight when project has no folder path (valid UI state)
        const highlightColor = projectPath ? folderHighlight.getHighlightColor(projectPath) : null;

        return (
          <div
            key={projectName}
            className="sidebar-folder"
            onMouseEnter={() => folderLock.setHoveredFolderPath(projectPath || null)}
            onMouseLeave={() => folderLock.setHoveredFolderPath(null)}
          >
            <FolderItem
              name={projectName}
              isCollapsed={isProjectCollapsed}
              isLocked={isLocked}
              showLock={showLock}
              highlightColor={highlightColor}
              folderPath={projectPath}
              onToggle={() => onToggleProject(projectName)}
              onLockToggle={() => {
                if (isLocked) {
                  folderLock.setLockedFolderPath(null);
                } else if (projectPath) {
                  folderLock.setLockedFolderPath(projectPath);
                }
              }}
            />

            {!isProjectCollapsed && (
              <div className="sidebar-folder-content">
                {Object.entries(branches).map(([branchName, agents]) => {
                  const branchKey = `${projectName}:${branchName}`;
                  const isBranchCollapsed = collapsedBranches.has(branchKey);

                  return (
                    <BranchItem
                      key={branchKey}
                      branchName={branchName}
                      agents={agents}
                      isCollapsed={isBranchCollapsed}
                      onToggle={() => onToggleBranch(branchKey)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

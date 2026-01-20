/**
 * Branch Item Component
 *
 * Displays a collapsible git branch with its agents.
 */
import type { AgentHierarchyEntry } from '../../../hooks';

export interface BranchItemProps {
  branchName: string;
  agents: AgentHierarchyEntry[];
  isCollapsed: boolean;
  onToggle: () => void;
}

export function BranchItem({ branchName, agents, isCollapsed, onToggle }: BranchItemProps) {
  return (
    <div className="sidebar-folder nested">
      <button className="sidebar-folder-header" onClick={onToggle}>
        <span className={`sidebar-folder-icon ${isCollapsed ? 'collapsed' : 'expanded'}`}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </span>
        <BranchIcon />
        <span className="sidebar-folder-name">{branchName}</span>
      </button>
      {!isCollapsed && (
        <div className="sidebar-folder-content">
          {agents.map((agent) => (
            <div key={agent.nodeId} className="sidebar-item">
              <span>{agent.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BranchIcon() {
  return (
    <svg
      className="sidebar-branch-svg"
      width="14"
      height="14"
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="160"
        cy="96"
        r="48"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="32"
      />
      <circle
        cx="160"
        cy="416"
        r="48"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="32"
      />
      <line
        x1="160"
        y1="368"
        x2="160"
        y2="144"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="32"
      />
      <circle
        cx="352"
        cy="160"
        r="48"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="32"
      />
      <path
        d="M352,208c0,128-192,48-192,160"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="32"
      />
    </svg>
  );
}

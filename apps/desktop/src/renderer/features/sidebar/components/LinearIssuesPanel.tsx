/**
 * Linear Issues Panel Component
 *
 * Displays Linear issues with filtering and drag-drop support.
 */
import type { LinearIssue, UseLinearPanelReturn, UseLinearReturn } from '../../../hooks';

export interface LinearIssuesPanelProps {
  linear: UseLinearReturn;
  linearPanel: UseLinearPanelReturn;
  onIssueDragStart: (event: React.DragEvent, issue: LinearIssue) => void;
  onIssueClick: (issueId: string) => void;
}

export function LinearIssuesPanel({
  linear,
  linearPanel,
  onIssueDragStart,
  onIssueClick,
}: LinearIssuesPanelProps) {
  return (
    <div className="sidebar-linear-issues-container">
      <div
        className="sidebar-linear-issues-header"
        onClick={linearPanel.toggleCollapsed}
        style={{ cursor: 'pointer' }}
      >
        <span
          className={`sidebar-linear-issues-chevron ${linearPanel.isCollapsed ? 'collapsed' : 'expanded'}`}
        >
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
        <h3 className="sidebar-linear-issues-title">Linear</h3>
      </div>

      {!linearPanel.isCollapsed && (
        <>
          <LinearFilters linear={linear} />
          <LinearIssuesList
            linear={linear}
            onIssueDragStart={onIssueDragStart}
            onIssueClick={onIssueClick}
          />
        </>
      )}
    </div>
  );
}

interface LinearFiltersProps {
  linear: UseLinearReturn;
}

function LinearFilters({ linear }: LinearFiltersProps) {
  return (
    <div className="sidebar-linear-issues-filters">
      <div className="sidebar-linear-issues-filter">
        <select
          id="sidebar-issues-filter-project"
          className="sidebar-issues-select"
          value={linear.selectedProjectId}
          onChange={(event) => linear.setFilter('selectedProjectId', event.target.value)}
        >
          <option value="all">All projects</option>
          {linear.hasUnassignedProject && <option value="none">No project</option>}
          {linear.projectOptions.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sidebar-linear-issues-filter">
        <select
          id="sidebar-issues-filter-milestone"
          className="sidebar-issues-select"
          value={linear.selectedMilestoneId}
          onChange={(event) => linear.setFilter('selectedMilestoneId', event.target.value)}
        >
          <option value="all">All milestones</option>
          {linear.hasUnassignedMilestone && <option value="none">No milestone</option>}
          {linear.visibleMilestoneOptions.map((milestone) => (
            <option key={milestone.id} value={milestone.id}>
              {milestone.label}
            </option>
          ))}
        </select>
      </div>
      <div className="sidebar-linear-issues-filter">
        <select
          id="sidebar-issues-filter-status"
          className="sidebar-issues-select"
          value={linear.selectedStatusId}
          onChange={(event) => linear.setFilter('selectedStatusId', event.target.value)}
        >
          <option value="all">All statuses</option>
          {linear.statusOptions.map((state) => (
            <option key={state.id} value={state.id}>
              {state.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

interface LinearIssuesListProps {
  linear: UseLinearReturn;
  onIssueDragStart: (event: React.DragEvent, issue: LinearIssue) => void;
  onIssueClick: (issueId: string) => void;
}

function LinearIssuesList({ linear, onIssueDragStart, onIssueClick }: LinearIssuesListProps) {
  if (linear.isLoading) {
    return <div className="sidebar-linear-issues-loading">Loading issues...</div>;
  }

  if (linear.filteredIssues.length === 0) {
    return (
      <div className="sidebar-linear-issues-empty">
        {linear.issues.length === 0 ? 'No open issues found' : 'No issues match these filters'}
      </div>
    );
  }

  return (
    <div className="sidebar-linear-issues-list">
      {linear.filteredIssues.map((issue: LinearIssue) => (
        <IssueCard
          key={issue.id}
          issue={issue}
          onDragStart={onIssueDragStart}
          onClick={onIssueClick}
        />
      ))}
    </div>
  );
}

interface IssueCardProps {
  issue: LinearIssue;
  onDragStart: (event: React.DragEvent, issue: LinearIssue) => void;
  onClick: (issueId: string) => void;
}

function IssueCard({ issue, onDragStart, onClick }: IssueCardProps) {
  const projectLabel = issue.project?.name;
  const milestoneLabel = issue.projectMilestone?.name;

  return (
    <div
      className="sidebar-issue-card"
      draggable
      onDragStart={(e) => onDragStart(e, issue)}
      onClick={() => onClick(issue.id)}
    >
      <div className="sidebar-issue-header">
        <span className="sidebar-issue-identifier">{issue.identifier}</span>
        <span className="sidebar-issue-status" style={{ backgroundColor: issue.state.color }}>
          {issue.state.name}
        </span>
      </div>
      <div className="sidebar-issue-title">{issue.title}</div>
      {(projectLabel || milestoneLabel) && (
        <div className="sidebar-issue-meta">
          {projectLabel && <span>Project: {projectLabel}</span>}
          {projectLabel && milestoneLabel && <span className="sidebar-issue-meta-sep">|</span>}
          {milestoneLabel && <span>Milestone: {milestoneLabel}</span>}
        </div>
      )}
      {issue.assignee && (
        <div className="sidebar-issue-assignee">
          {issue.assignee.avatarUrl && (
            <img
              src={issue.assignee.avatarUrl}
              alt={issue.assignee.name}
              className="sidebar-assignee-avatar"
            />
          )}
          <span className="sidebar-assignee-name">{issue.assignee.name}</span>
        </div>
      )}
      <div className="sidebar-issue-priority">
        Priority:{' '}
        {issue.priority === 0
          ? 'None'
          : issue.priority === 1
            ? 'Urgent'
            : issue.priority === 2
              ? 'High'
              : issue.priority === 3
                ? 'Medium'
                : 'Low'}
      </div>
    </div>
  );
}

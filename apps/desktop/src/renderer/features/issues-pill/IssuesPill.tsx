/**
 * Issues Pill Component
 *
 * A floating, expandable pill that displays Linear issues.
 * Features smooth animation when expanding/collapsing.
 *
 * NOTE: This component was previously commented out in Canvas.tsx.
 * Set `enabled={true}` to re-enable it.
 */

import type { LinearIssue as LinearIssueType } from '../../stores/ILinearStore';
import type { UseLinearReturn } from '../linear';
import type { UsePillStateReturn } from './usePillState';

export interface IssuesPillProps {
  /** Whether the pill is enabled (set to false to hide) */
  enabled?: boolean;
  /** Linear integration state */
  linear: UseLinearReturn;
  /** Pill animation state */
  pill: UsePillStateReturn;
  /** Handler for issue drag start */
  onIssueDragStart?: (e: React.DragEvent, issue: LinearIssueType) => void;
}

export function IssuesPill({ enabled = false, linear, pill, onIssueDragStart }: IssuesPillProps) {
  if (!enabled || !linear.isConnected) {
    return null;
  }

  return (
    <div
      onClick={!pill.isPillSquare ? pill.togglePill : undefined}
      className={`issues-pill ${!pill.isPillSquare ? 'cursor-pointer' : 'cursor-default'} ${
        pill.isPillExpanded ? 'expanded' : ''
      } ${pill.isPillSquare ? 'square' : ''}`}
      style={{
        borderRadius: pill.isPillSquare ? '24px' : '20px',
      }}
    >
      {!pill.isPillSquare ? (
        <CollapsedPillContent isTextVisible={pill.isTextVisible} />
      ) : pill.showPillContent ? (
        <ExpandedPillContent linear={linear} pill={pill} onIssueDragStart={onIssueDragStart} />
      ) : null}
    </div>
  );
}

function CollapsedPillContent({ isTextVisible }: { isTextVisible: boolean }) {
  return <div className={`pill-text ${isTextVisible ? 'visible' : ''}`}>View Issues...</div>;
}

interface ExpandedPillContentProps {
  linear: UseLinearReturn;
  pill: UsePillStateReturn;
  onIssueDragStart?: (e: React.DragEvent, issue: LinearIssueType) => void;
}

function ExpandedPillContent({ linear, pill, onIssueDragStart }: ExpandedPillContentProps) {
  return (
    <div className="pill-content-wrapper" onClick={(e) => e.stopPropagation()}>
      {/* Collapse nozzle at top */}
      <div
        className={`collapse-nozzle ${pill.isContentVisible ? 'visible' : ''}`}
        onClick={pill.collapsePill}
        title="Collapse issues"
      />

      {/* Issues list */}
      <div className={`issues-list ${pill.isContentVisible ? 'visible' : ''}`}>
        <IssuesToolbar linear={linear} />
        <IssuesList linear={linear} onIssueDragStart={onIssueDragStart} />
      </div>
    </div>
  );
}

function IssuesToolbar({ linear }: { linear: UseLinearReturn }) {
  return (
    <div className="issues-toolbar">
      <div className="issues-workspace">
        <span className="issues-workspace-label">Workspace</span>
        <span className="issues-workspace-name">
          {linear.workspaceName || (linear.isLoading ? 'Loading...' : 'Unknown')}
        </span>
      </div>
      <div className="issues-filters">
        <div className="issues-filter">
          <label htmlFor="issues-filter-project">Project</label>
          <select
            id="issues-filter-project"
            className="issues-select"
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
        <div className="issues-filter">
          <label htmlFor="issues-filter-milestone">Milestone</label>
          <select
            id="issues-filter-milestone"
            className="issues-select"
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
        <div className="issues-filter">
          <label htmlFor="issues-filter-status">Status</label>
          <select
            id="issues-filter-status"
            className="issues-select"
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
    </div>
  );
}

interface IssuesListProps {
  linear: UseLinearReturn;
  onIssueDragStart?: (e: React.DragEvent, issue: LinearIssueType) => void;
}

function IssuesList({ linear, onIssueDragStart }: IssuesListProps) {
  if (linear.isLoading) {
    return <div className="loading-state">Loading issues...</div>;
  }

  if (linear.filteredIssues.length === 0) {
    return (
      <div className="empty-state">
        {linear.issues.length === 0 ? 'No open issues found' : 'No issues match these filters'}
      </div>
    );
  }

  return (
    <>
      {linear.filteredIssues.map((issue: LinearIssueType) => (
        <IssueCard key={issue.id} issue={issue} onDragStart={onIssueDragStart} />
      ))}
    </>
  );
}

interface IssueCardProps {
  issue: LinearIssueType;
  onDragStart?: (e: React.DragEvent, issue: LinearIssueType) => void;
}

function IssueCard({ issue, onDragStart }: IssueCardProps) {
  const projectLabel = issue.project?.name;
  const milestoneLabel = issue.projectMilestone?.name;

  return (
    <div
      className="issue-card"
      draggable
      onDragStart={onDragStart ? (e) => onDragStart(e, issue) : undefined}
    >
      <div className="issue-header">
        <span className="issue-identifier">{issue.identifier}</span>
        <span className="issue-status" style={{ backgroundColor: issue.state.color }}>
          {issue.state.name}
        </span>
      </div>
      <div className="issue-title">{issue.title}</div>
      {(projectLabel || milestoneLabel) && (
        <div className="issue-meta">
          {projectLabel && <span>Project: {projectLabel}</span>}
          {projectLabel && milestoneLabel && <span className="issue-meta-sep">|</span>}
          {milestoneLabel && <span>Milestone: {milestoneLabel}</span>}
        </div>
      )}
      {issue.assignee && (
        <div className="issue-assignee">
          {issue.assignee.avatarUrl && (
            <img
              src={issue.assignee.avatarUrl}
              alt={issue.assignee.name}
              className="assignee-avatar"
            />
          )}
          <span className="assignee-name">{issue.assignee.name}</span>
        </div>
      )}
      <div className="issue-priority">
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

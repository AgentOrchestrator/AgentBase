import { useCallback, useEffect, useRef, useState } from 'react';
import InteractiveMarkdown from './InteractiveMarkdown';
import './IssueDetailsModal.css';

interface IssueDetailsModalProps {
  issueId: string;
  onClose: () => void;
}

interface IssueDetails {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  state: {
    id: string;
    name: string;
    color: string;
  };
  priority: number;
  estimate?: number;
  assignee?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
  labels?: {
    nodes: Array<{
      id: string;
      name: string;
      color: string;
    }>;
  };
  createdAt: string;
  updatedAt: string;
  url: string;
}

interface WorkflowState {
  id: string;
  name: string;
  color: string;
  type: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

const priorityLabels = ['None', 'Urgent', 'High', 'Medium', 'Low'];
const estimateOptions = [0, 1, 2, 3, 5, 8, 13, 21];

function IssueDetailsModal({ issueId, onClose }: IssueDetailsModalProps) {
  const [issue, setIssue] = useState<IssueDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflowStates, setWorkflowStates] = useState<WorkflowState[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [updating, setUpdating] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState('');
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch issue details
  useEffect(() => {
    const fetchIssueDetails = async () => {
      const apiKey = localStorage.getItem('linear_api_key');
      if (!apiKey) {
        setError('Linear API key not found');
        setLoading(false);
        return;
      }

      try {
        const query = `
          query($id: String!) {
            issue(id: $id) {
              id
              identifier
              title
              description
              state {
                id
                name
                color
              }
              priority
              estimate
              assignee {
                id
                name
                email
                avatarUrl
              }
              labels {
                nodes {
                  id
                  name
                  color
                }
              }
              createdAt
              updatedAt
              url
              team {
                id
                states {
                  nodes {
                    id
                    name
                    color
                    type
                  }
                }
                members {
                  nodes {
                    id
                    name
                    email
                    avatarUrl
                  }
                }
              }
            }
          }
        `;

        const response = await fetch('https://api.linear.app/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: apiKey,
          },
          body: JSON.stringify({
            query,
            variables: { id: issueId },
          }),
        });

        const data = await response.json();
        if (data.errors) {
          throw new Error(data.errors[0]?.message || 'Failed to fetch issue');
        }

        if (data.data?.issue) {
          setIssue(data.data.issue);
          setWorkflowStates(data.data.issue.team?.states?.nodes || []);
          setTeamMembers(data.data.issue.team?.members?.nodes || []);
        } else {
          throw new Error('Issue not found');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load issue');
      } finally {
        setLoading(false);
      }
    };

    fetchIssueDetails();
  }, [issueId]);

  // Sync description value when issue loads
  useEffect(() => {
    if (issue) {
      setDescriptionValue(issue.description || '');
    }
  }, [issue]);

  const updateIssue = useCallback(
    async (updates: {
      stateId?: string;
      priority?: number;
      estimate?: number;
      assigneeId?: string | null;
      description?: string;
    }) => {
      const apiKey = localStorage.getItem('linear_api_key');
      if (!apiKey || !issue) return;

      setUpdating(true);
      try {
        const mutation = `
        mutation($id: String!, $input: IssueUpdateInput!) {
          issueUpdate(id: $id, input: $input) {
            success
            issue {
              id
              state {
                id
                name
                color
              }
              priority
              estimate
              assignee {
                id
                name
                email
                avatarUrl
              }
            }
          }
        }
      `;

        const response = await fetch('https://api.linear.app/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: apiKey,
          },
          body: JSON.stringify({
            query: mutation,
            variables: {
              id: issue.id,
              input: updates,
            },
          }),
        });

        const data = await response.json();
        if (data.errors) {
          throw new Error(data.errors[0]?.message || 'Failed to update issue');
        }

        if (data.data?.issueUpdate?.success && data.data.issueUpdate.issue) {
          // Update local state with new values
          setIssue((prev) =>
            prev
              ? {
                  ...prev,
                  state: data.data.issueUpdate.issue.state,
                  priority: data.data.issueUpdate.issue.priority,
                  estimate: data.data.issueUpdate.issue.estimate,
                  assignee: data.data.issueUpdate.issue.assignee,
                  description:
                    updates.description !== undefined ? updates.description : prev.description,
                }
              : null
          );
        }
      } catch (err) {
        console.error('Failed to update issue:', err);
        setError(err instanceof Error ? err.message : 'Failed to update issue');
      } finally {
        setUpdating(false);
      }
    },
    [issue]
  );

  const handleStateChange = (stateId: string) => {
    updateIssue({ stateId });
  };

  const handlePriorityChange = (priority: number) => {
    updateIssue({ priority });
  };

  const handleEstimateChange = (estimate: number) => {
    updateIssue({ estimate });
  };

  const handleAssigneeChange = (assigneeId: string) => {
    updateIssue({ assigneeId: assigneeId === 'unassigned' ? null : assigneeId });
  };

  const handleSaveDescription = async () => {
    await updateIssue({ description: descriptionValue });
    setEditingDescription(false);
  };

  const handleCancelDescriptionEdit = () => {
    setDescriptionValue(issue?.description || '');
    setEditingDescription(false);
  };

  const handleDescriptionChange = useCallback(
    (newContent: string) => {
      setDescriptionValue(newContent);

      // Update local state immediately
      setIssue((prev) => (prev ? { ...prev, description: newContent } : null));

      // Debounce the API call
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      autoSaveTimeoutRef.current = setTimeout(() => {
        updateIssue({ description: newContent });
      }, 1000); // 1 second delay
    },
    [updateIssue]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (loading) {
    return (
      <div className="issue-details-overlay" onClick={onClose}>
        <div className="issue-details-modal" onClick={(e) => e.stopPropagation()}>
          <div className="issue-details-loading">Loading issue details...</div>
        </div>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="issue-details-overlay" onClick={onClose}>
        <div className="issue-details-modal" onClick={(e) => e.stopPropagation()}>
          <div className="issue-details-error">{error || 'Issue not found'}</div>
          <button onClick={onClose} className="issue-details-close-button">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="issue-details-overlay" onClick={onClose}>
      <div className="issue-details-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="issue-details-header">
          <div className="issue-details-identifier">
            <span className="issue-id-badge">{issue.identifier}</span>
            <a
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              className="issue-external-link"
              onClick={(e) => e.stopPropagation()}
            >
              Open in Linear ↗
            </a>
          </div>
          <button className="issue-details-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="issue-details-content">
          {/* Title */}
          <h2 className="issue-details-title">{issue.title}</h2>

          {/* Description */}
          <div className="issue-details-section">
            <div className="description-header">
              <h3 className="issue-details-section-title">Description</h3>
              {!editingDescription && (
                <button
                  onClick={() => setEditingDescription(true)}
                  className="description-edit-button"
                  disabled={updating}
                >
                  Edit
                </button>
              )}
            </div>
            {editingDescription ? (
              <div className="description-edit-container">
                <textarea
                  value={descriptionValue}
                  onChange={(e) => setDescriptionValue(e.target.value)}
                  className="description-textarea"
                  rows={8}
                  placeholder="Add a description..."
                />
                <div className="description-actions">
                  <button
                    onClick={handleSaveDescription}
                    className="description-save-button"
                    disabled={updating}
                  >
                    {updating ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancelDescriptionEdit}
                    className="description-cancel-button"
                    disabled={updating}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="issue-details-description"
                onClick={(e) => {
                  // Only trigger edit mode if clicking on the container itself or text
                  const target = e.target as HTMLElement;
                  const isInteractive =
                    target.tagName === 'INPUT' ||
                    target.tagName === 'A' ||
                    target.closest('input') ||
                    target.closest('a');

                  if (!isInteractive) {
                    setEditingDescription(true);
                  }
                }}
              >
                {issue.description ? (
                  <InteractiveMarkdown
                    content={issue.description}
                    onContentChange={handleDescriptionChange}
                  />
                ) : (
                  <span className="description-placeholder">
                    No description provided. Click to add one.
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Properties Grid */}
          <div className="issue-details-properties">
            {/* Status */}
            <div className="issue-property">
              <label className="issue-property-label">Status</label>
              <select
                value={issue.state.id}
                onChange={(e) => handleStateChange(e.target.value)}
                disabled={updating}
                className="issue-property-select"
              >
                {workflowStates.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.name}
                  </option>
                ))}
              </select>
              <div
                className="issue-status-indicator"
                style={{ backgroundColor: issue.state.color }}
              />
            </div>

            {/* Priority */}
            <div className="issue-property">
              <label className="issue-property-label">Priority</label>
              <select
                value={issue.priority}
                onChange={(e) => handlePriorityChange(Number(e.target.value))}
                disabled={updating}
                className="issue-property-select"
              >
                {priorityLabels.map((label, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: Static array with stable indices
                  <option key={index} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Estimate */}
            <div className="issue-property">
              <label className="issue-property-label">Estimate (points)</label>
              <select
                value={issue.estimate || 0}
                onChange={(e) => handleEstimateChange(Number(e.target.value))}
                disabled={updating}
                className="issue-property-select"
              >
                {estimateOptions.map((points) => (
                  <option key={points} value={points}>
                    {points === 0 ? 'None' : points}
                  </option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div className="issue-property">
              <label className="issue-property-label">Assignee</label>
              <select
                value={issue.assignee?.id || 'unassigned'}
                onChange={(e) => handleAssigneeChange(e.target.value)}
                disabled={updating}
                className="issue-property-select"
              >
                <option value="unassigned">Unassigned</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Assignee Display */}
          {issue.assignee && (
            <div className="issue-assignee-display">
              {issue.assignee.avatarUrl && (
                <img
                  src={issue.assignee.avatarUrl}
                  alt={issue.assignee.name}
                  className="assignee-avatar-large"
                />
              )}
              <div className="assignee-info">
                <div className="assignee-name-large">{issue.assignee.name}</div>
                <div className="assignee-email">{issue.assignee.email}</div>
              </div>
            </div>
          )}

          {/* Labels */}
          {issue.labels && issue.labels.nodes.length > 0 && (
            <div className="issue-details-section">
              <h3 className="issue-details-section-title">Labels</h3>
              <div className="issue-labels">
                {issue.labels.nodes.map((label) => (
                  <span
                    key={label.id}
                    className="issue-label"
                    style={{ backgroundColor: label.color }}
                  >
                    {label.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="issue-details-metadata">
            <div className="metadata-item">
              <span className="metadata-label">Created:</span>
              <span className="metadata-value">
                {new Date(issue.createdAt).toLocaleDateString()} at{' '}
                {new Date(issue.createdAt).toLocaleTimeString()}
              </span>
            </div>
            <div className="metadata-item">
              <span className="metadata-label">Updated:</span>
              <span className="metadata-value">
                {new Date(issue.updatedAt).toLocaleDateString()} at{' '}
                {new Date(issue.updatedAt).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {updating && <div className="issue-updating-indicator">Updating...</div>}
        </div>
      </div>
    </div>
  );
}

export default IssueDetailsModal;

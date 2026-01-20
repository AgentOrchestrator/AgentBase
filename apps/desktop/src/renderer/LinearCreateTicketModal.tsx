import { useCallback, useEffect, useState } from 'react';
import './LinearCreateTicketModal.css';

interface LinearCreateTicketModalProps {
  onClose: () => void;
  onSuccess?: (issue: { id: string; identifier: string; title: string; url: string }) => void;
}

interface LinearTeam {
  id: string;
  name: string;
  states: {
    nodes: Array<{
      id: string;
      name: string;
      color: string;
      type: string;
    }>;
  };
  members: {
    nodes: Array<{
      id: string;
      name: string;
      email: string;
      avatarUrl?: string;
    }>;
  };
  labels: {
    nodes: Array<{
      id: string;
      name: string;
      color: string;
    }>;
  };
}

interface LinearProject {
  id: string;
  name: string;
  milestones: {
    nodes: Array<{
      id: string;
      name: string;
    }>;
  };
}

const priorityOptions = [
  { value: 0, label: 'No priority' },
  { value: 1, label: 'Urgent' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Low' },
];

const estimateOptions = [
  { value: 0, label: 'No estimate' },
  { value: 1, label: '1 point' },
  { value: 2, label: '2 points' },
  { value: 3, label: '3 points' },
  { value: 5, label: '5 points' },
  { value: 8, label: '8 points' },
  { value: 13, label: '13 points' },
  { value: 21, label: '21 points' },
];

function LinearCreateTicketModal({ onClose, onSuccess }: LinearCreateTicketModalProps) {
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [teamId, setTeamId] = useState('');
  const [stateId, setStateId] = useState('');
  const [priority, setPriority] = useState(0);
  const [estimate, setEstimate] = useState(0);
  const [assigneeId, setAssigneeId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [labelIds, setLabelIds] = useState<string[]>([]);

  // Data state
  const [teams, setTeams] = useState<LinearTeam[]>([]);
  const [projects, setProjects] = useState<LinearProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch teams and projects on mount
  useEffect(() => {
    const fetchData = async () => {
      const apiKey = localStorage.getItem('linear_api_key');
      if (!apiKey) {
        setError('Linear API key not found');
        setLoading(false);
        return;
      }

      try {
        // Fetch teams with their states, members, and labels
        const teamsQuery = `
          query {
            teams {
              nodes {
                id
                name
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
                labels {
                  nodes {
                    id
                    name
                    color
                  }
                }
              }
            }
          }
        `;

        const projectsQuery = `
          query {
            projects(first: 100) {
              nodes {
                id
                name
                milestones {
                  nodes {
                    id
                    name
                  }
                }
              }
            }
          }
        `;

        const [teamsResponse, projectsResponse] = await Promise.all([
          fetch('https://api.linear.app/graphql', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: apiKey,
            },
            body: JSON.stringify({ query: teamsQuery }),
          }),
          fetch('https://api.linear.app/graphql', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: apiKey,
            },
            body: JSON.stringify({ query: projectsQuery }),
          }),
        ]);

        const teamsData = await teamsResponse.json();
        const projectsData = await projectsResponse.json();

        if (teamsData.errors) {
          throw new Error(teamsData.errors[0]?.message || 'Failed to fetch teams');
        }

        if (projectsData.errors) {
          throw new Error(projectsData.errors[0]?.message || 'Failed to fetch projects');
        }

        const fetchedTeams = teamsData.data?.teams?.nodes || [];
        const fetchedProjects = projectsData.data?.projects?.nodes || [];

        setTeams(fetchedTeams);
        setProjects(fetchedProjects);

        // Set default team if available
        if (fetchedTeams.length > 0) {
          const defaultTeam = fetchedTeams[0];
          setTeamId(defaultTeam.id);

          // Set default state to first "backlog" or "unstarted" state, or first state
          const defaultState =
            defaultTeam.states.nodes.find(
              (s: { type: string }) => s.type === 'backlog' || s.type === 'unstarted'
            ) || defaultTeam.states.nodes[0];
          if (defaultState) {
            setStateId(defaultState.id);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Get current team data
  const currentTeam = teams.find((t) => t.id === teamId);
  const currentProject = projects.find((p) => p.id === projectId);

  // Handle team change - reset team-specific selections
  const handleTeamChange = useCallback((newTeamId: string) => {
    setTeamId(newTeamId);
    setStateId('');
    setAssigneeId('');
    setLabelIds([]);
  }, []);

  // Handle project change - reset milestone
  const handleProjectChange = useCallback((newProjectId: string) => {
    setProjectId(newProjectId);
    setMilestoneId('');
  }, []);

  // Handle label toggle
  const handleLabelToggle = useCallback((labelId: string) => {
    setLabelIds((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  }, []);

  // Create ticket
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (!teamId) {
      setError('Team is required');
      return;
    }

    const apiKey = localStorage.getItem('linear_api_key');
    if (!apiKey) {
      setError('Linear API key not found');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const mutation = `
        mutation CreateIssue($input: IssueCreateInput!) {
          issueCreate(input: $input) {
            success
            issue {
              id
              identifier
              title
              url
            }
          }
        }
      `;

      const input: Record<string, unknown> = {
        teamId,
        title: title.trim(),
      };

      if (description.trim()) {
        input.description = description.trim();
      }

      if (stateId) {
        input.stateId = stateId;
      }

      if (priority > 0) {
        input.priority = priority;
      }

      if (estimate > 0) {
        input.estimate = estimate;
      }

      if (assigneeId) {
        input.assigneeId = assigneeId;
      }

      if (projectId) {
        input.projectId = projectId;
      }

      if (milestoneId) {
        input.projectMilestoneId = milestoneId;
      }

      if (labelIds.length > 0) {
        input.labelIds = labelIds;
      }

      const response = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: apiKey,
        },
        body: JSON.stringify({
          query: mutation,
          variables: { input },
        }),
      });

      const data = await response.json();

      if (data.errors) {
        throw new Error(data.errors[0]?.message || 'Failed to create issue');
      }

      if (!data.data?.issueCreate?.success) {
        throw new Error('Failed to create issue');
      }

      const createdIssue = data.data.issueCreate.issue;

      if (onSuccess) {
        onSuccess(createdIssue);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create issue');
    } finally {
      setCreating(false);
    }
  };

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
      <div className="linear-create-overlay" onClick={onClose}>
        <div className="linear-create-modal" onClick={(e) => e.stopPropagation()}>
          <div className="linear-create-loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="linear-create-overlay" onClick={onClose}>
      <div className="linear-create-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="linear-create-header">
          <h2 className="linear-create-title">Create Issue</h2>
          <button className="linear-create-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Content */}
        <form className="linear-create-content" onSubmit={handleSubmit}>
          {error && <div className="linear-create-error">{error}</div>}

          {/* Title */}
          <div className="linear-create-field">
            <label className="linear-create-label" htmlFor="issue-title">
              Title <span className="linear-create-required">*</span>
            </label>
            <input
              id="issue-title"
              type="text"
              className="linear-create-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Issue title"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="linear-create-field">
            <label className="linear-create-label" htmlFor="issue-description">
              Description
            </label>
            <textarea
              id="issue-description"
              className="linear-create-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows={4}
            />
          </div>

          {/* Properties Grid */}
          <div className="linear-create-properties">
            {/* Team */}
            <div className="linear-create-property">
              <label className="linear-create-property-label" htmlFor="issue-team">
                Team <span className="linear-create-required">*</span>
              </label>
              <select
                id="issue-team"
                className="linear-create-select"
                value={teamId}
                onChange={(e) => handleTeamChange(e.target.value)}
              >
                <option value="">Select team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="linear-create-property">
              <label className="linear-create-property-label" htmlFor="issue-status">
                Status
              </label>
              <select
                id="issue-status"
                className="linear-create-select"
                value={stateId}
                onChange={(e) => setStateId(e.target.value)}
                disabled={!currentTeam}
              >
                <option value="">Select status</option>
                {currentTeam?.states.nodes.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div className="linear-create-property">
              <label className="linear-create-property-label" htmlFor="issue-priority">
                Priority
              </label>
              <select
                id="issue-priority"
                className="linear-create-select"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
              >
                {priorityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Estimate */}
            <div className="linear-create-property">
              <label className="linear-create-property-label" htmlFor="issue-estimate">
                Estimate
              </label>
              <select
                id="issue-estimate"
                className="linear-create-select"
                value={estimate}
                onChange={(e) => setEstimate(Number(e.target.value))}
              >
                {estimateOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div className="linear-create-property">
              <label className="linear-create-property-label" htmlFor="issue-assignee">
                Assignee
              </label>
              <select
                id="issue-assignee"
                className="linear-create-select"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                disabled={!currentTeam}
              >
                <option value="">Unassigned</option>
                {currentTeam?.members.nodes.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Project */}
            <div className="linear-create-property">
              <label className="linear-create-property-label" htmlFor="issue-project">
                Project
              </label>
              <select
                id="issue-project"
                className="linear-create-select"
                value={projectId}
                onChange={(e) => handleProjectChange(e.target.value)}
              >
                <option value="">No project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Milestone */}
            {currentProject && currentProject.milestones.nodes.length > 0 && (
              <div className="linear-create-property">
                <label className="linear-create-property-label" htmlFor="issue-milestone">
                  Milestone
                </label>
                <select
                  id="issue-milestone"
                  className="linear-create-select"
                  value={milestoneId}
                  onChange={(e) => setMilestoneId(e.target.value)}
                >
                  <option value="">No milestone</option>
                  {currentProject.milestones.nodes.map((milestone) => (
                    <option key={milestone.id} value={milestone.id}>
                      {milestone.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Labels */}
          {currentTeam && currentTeam.labels.nodes.length > 0 && (
            <div className="linear-create-field">
              <label className="linear-create-label">Labels</label>
              <div className="linear-create-labels">
                {currentTeam.labels.nodes.map((label) => (
                  <button
                    key={label.id}
                    type="button"
                    className={`linear-create-label-chip ${labelIds.includes(label.id) ? 'selected' : ''}`}
                    style={{
                      borderColor: label.color,
                      backgroundColor: labelIds.includes(label.id) ? label.color : 'transparent',
                    }}
                    onClick={() => handleLabelToggle(label.id)}
                  >
                    {label.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="linear-create-actions">
            <button
              type="button"
              className="linear-create-cancel-button"
              onClick={onClose}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="linear-create-submit-button"
              disabled={creating || !title.trim() || !teamId}
            >
              {creating ? 'Creating...' : 'Create Issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LinearCreateTicketModal;

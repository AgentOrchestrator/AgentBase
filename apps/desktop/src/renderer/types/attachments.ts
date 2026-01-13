/**
 * Abstract attachment system for terminal nodes
 * Supports multiple types of data attachments (Linear issues, workspace metadata, etc.)
 */

/**
 * Base attachment interface that all attachment types must extend
 */
export interface BaseAttachment {
  /** Discriminator field for type-safe unions */
  type: string;
  /** Unique identifier for this attachment */
  id: string;
  /** Optional metadata for extension */
  metadata?: Record<string, any>;
}

/**
 * Linear issue attachment - represents a Linear issue attached to a terminal
 */
export interface LinearIssueAttachment extends BaseAttachment {
  type: 'linear-issue';
  /** Linear issue identifier (e.g., "ENG-123") */
  identifier: string;
  /** Issue title */
  title: string;
  /** URL to the issue in Linear */
  url: string;
  /** Optional: Issue state information */
  state?: {
    name: string;
    color: string;
  };
  /** Optional: Priority level (0=none, 1=urgent, 2=high, 3=medium, 4=low) */
  priority?: number;
  /** Optional: Assignee information */
  assignee?: {
    name: string;
    avatarUrl?: string;
  };
}

/**
 * Workspace metadata attachment - represents workspace information attached to a terminal
 */
export interface WorkspaceMetadataAttachment extends BaseAttachment {
  type: 'workspace-metadata';
  /** Workspace path */
  path: string;
  /** Optional: Workspace name */
  name?: string;
  /** Optional: Workspace description */
  description?: string;
  /** Optional: Git repository information */
  git?: {
    branch?: string;
    remote?: string;
    status?: string;
  };
  /** Optional: Project type (e.g., "node", "python", "rust") */
  projectType?: string;
}

/**
 * Union type of all supported attachment types
 * Add new attachment types here as they are implemented
 */
export type TerminalAttachment = LinearIssueAttachment | WorkspaceMetadataAttachment;

/**
 * Type guard to check if an attachment is a Linear issue
 */
export function isLinearIssueAttachment(
  attachment: TerminalAttachment
): attachment is LinearIssueAttachment {
  return attachment.type === 'linear-issue';
}

/**
 * Type guard to check if an attachment is workspace metadata
 */
export function isWorkspaceMetadataAttachment(
  attachment: TerminalAttachment
): attachment is WorkspaceMetadataAttachment {
  return attachment.type === 'workspace-metadata';
}

/**
 * Helper function to create a Linear issue attachment from issue data
 */
export function createLinearIssueAttachment(issue: {
  id: string;
  identifier: string;
  title: string;
  state?: { name: string; color: string };
  priority?: number;
  assignee?: { name: string; avatarUrl?: string };
}): LinearIssueAttachment {
  return {
    type: 'linear-issue',
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    url: `https://linear.app/issue/${issue.identifier}`,
    state: issue.state,
    priority: issue.priority,
    assignee: issue.assignee,
  };
}

/**
 * Helper function to create a workspace metadata attachment
 */
export function createWorkspaceMetadataAttachment(workspace: {
  path: string;
  name?: string;
  description?: string;
  git?: {
    branch?: string;
    remote?: string;
    status?: string;
  };
  projectType?: string;
}): WorkspaceMetadataAttachment {
  return {
    type: 'workspace-metadata',
    id: `workspace-${workspace.path}`,
    path: workspace.path,
    name: workspace.name,
    description: workspace.description,
    git: workspace.git,
    projectType: workspace.projectType,
  };
}

/**
 * Abstract attachment system for terminal nodes
 * Supports multiple types of data attachments (Linear issues, etc.)
 *
 * NOTE: Workspace metadata is stored directly in AgentNodeData.workspacePath,
 * not as an attachment. This ensures a single source of truth for workspace state.
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
  metadata?: Record<string, unknown>;
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
 * Union type of all supported attachment types
 * Add new attachment types here as they are implemented
 */
export type TerminalAttachment = LinearIssueAttachment;

/**
 * Type guard to check if an attachment is a Linear issue
 */
export function isLinearIssueAttachment(
  attachment: TerminalAttachment
): attachment is LinearIssueAttachment {
  return attachment.type === 'linear-issue';
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

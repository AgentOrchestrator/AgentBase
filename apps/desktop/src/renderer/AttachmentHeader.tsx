import React from 'react';
import {
  TerminalAttachment,
  isLinearIssueAttachment,
  isWorkspaceMetadataAttachment,
} from './types/attachments';

interface AttachmentHeaderProps {
  attachment: TerminalAttachment;
  onDetailsClick?: () => void;
}

/**
 * Renders a Linear issue attachment in the terminal header
 */
function LinearIssueHeader({ attachment, onDetailsClick }: {
  attachment: Extract<TerminalAttachment, { type: 'linear-issue' }>;
  onDetailsClick?: () => void;
}) {
  return (
    <div className="terminal-node-header">
      <div
        className="issue-link"
        onClick={(e) => {
          e.stopPropagation();
          onDetailsClick?.();
        }}
        style={{ cursor: onDetailsClick ? 'pointer' : 'default' }}
      >
        <span className="issue-id">{attachment.identifier}</span>
        <span className="issue-title">{attachment.title}</span>
      </div>
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="issue-external-link-icon"
        onClick={(e) => e.stopPropagation()}
        title="Open in Linear"
      >
        ↗
      </a>
    </div>
  );
}

/**
 * Renders a workspace metadata attachment in the terminal header
 */
function WorkspaceMetadataHeader({ attachment }: {
  attachment: Extract<TerminalAttachment, { type: 'workspace-metadata' }>;
}) {
  return (
    <div className="terminal-node-header workspace-header">
      <div className="workspace-info">
        <span className="workspace-icon">📁</span>
        <span className="workspace-name">
          {attachment.name || attachment.path.split('/').pop() || 'Workspace'}
        </span>
        {attachment.git?.branch && (
          <span className="git-branch">
            <span className="git-icon">🌿</span>
            {attachment.git.branch}
          </span>
        )}
      </div>
      {attachment.projectType && (
        <span className="project-type-badge" title={`Project type: ${attachment.projectType}`}>
          {attachment.projectType}
        </span>
      )}
    </div>
  );
}

/**
 * Main attachment header component that renders the appropriate header based on attachment type
 */
export default function AttachmentHeader({ attachment, onDetailsClick }: AttachmentHeaderProps) {
  if (isLinearIssueAttachment(attachment)) {
    return <LinearIssueHeader attachment={attachment} onDetailsClick={onDetailsClick} />;
  }

  if (isWorkspaceMetadataAttachment(attachment)) {
    return <WorkspaceMetadataHeader attachment={attachment} />;
  }

  // Fallback for unknown attachment types
  return (
    <div className="terminal-node-header unknown-attachment">
      <span>Unknown attachment type: {attachment.type}</span>
    </div>
  );
}

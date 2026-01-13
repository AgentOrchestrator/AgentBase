import {
  TerminalAttachment,
  BaseAttachment,
  isLinearIssueAttachment,
  isWorkspaceMetadataAttachment,
} from './types/attachments';
import type { GitInfo } from '../main/preload';

interface AttachmentHeaderProps {
  attachment: TerminalAttachment;
  onDetailsClick?: () => void;
  /** Whether this workspace is inherited from a parent node */
  isInherited?: boolean;
  /** Live git info (overrides attachment.git if provided) */
  gitInfo?: GitInfo | null;
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
function WorkspaceMetadataHeader({ attachment, isInherited, gitInfo }: {
  attachment: Extract<TerminalAttachment, { type: 'workspace-metadata' }>;
  isInherited?: boolean;
  gitInfo?: GitInfo | null;
}) {
  // Use live gitInfo if provided, otherwise fall back to attachment.git
  const branch = gitInfo?.branch || attachment.git?.branch;
  const status = gitInfo?.status;

  return (
    <div className={`terminal-node-header workspace-header ${isInherited ? 'inherited' : ''}`}>
      <div className="workspace-info">
        <span className="workspace-icon">📁</span>
        <span className="workspace-name">
          {attachment.name || attachment.path.split('/').pop() || 'Workspace'}
        </span>
        {isInherited && (
          <span className="inherited-badge" title="Inherited from parent workspace">↑</span>
        )}
        {branch && (
          <span className="git-branch">
            <span className="git-icon">🌿</span>
            {branch}
            {status === 'dirty' && (
              <span className="git-dirty" title="Uncommitted changes">●</span>
            )}
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
export default function AttachmentHeader({ attachment, onDetailsClick, isInherited, gitInfo }: AttachmentHeaderProps) {
  if (isLinearIssueAttachment(attachment)) {
    return <LinearIssueHeader attachment={attachment} onDetailsClick={onDetailsClick} />;
  }

  if (isWorkspaceMetadataAttachment(attachment)) {
    return <WorkspaceMetadataHeader attachment={attachment} isInherited={isInherited} gitInfo={gitInfo} />;
  }

  // Fallback for unknown attachment types
  return (
    <div className="terminal-node-header unknown-attachment">
      <span>Unknown attachment type: {(attachment as BaseAttachment).type}</span>
    </div>
  );
}

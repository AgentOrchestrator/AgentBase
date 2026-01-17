import { isLinearIssueAttachment, type TerminalAttachment } from './types/attachments';

interface AttachmentHeaderProps {
  attachment: TerminalAttachment;
  onDetailsClick?: () => void;
}

/**
 * Renders a Linear issue attachment in the terminal header
 */
function LinearIssueHeader({
  attachment,
  onDetailsClick,
}: {
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
 * Main attachment header component that renders the appropriate header based on attachment type
 *
 * NOTE: Workspace metadata is no longer an attachment type.
 * Workspace info is stored directly in AgentNodeData.workspacePath and displayed
 * in the frame label, not as an attachment header.
 */
export default function AttachmentHeader({ attachment, onDetailsClick }: AttachmentHeaderProps) {
  if (isLinearIssueAttachment(attachment)) {
    return <LinearIssueHeader attachment={attachment} onDetailsClick={onDetailsClick} />;
  }

  // Fallback for unknown attachment types (shouldn't happen with current types)
  return null;
}

/**
 * MessagePreviewPanel
 *
 * Displays a scrollable list of messages for fork context preview.
 * Allows users to click any message to set it as the cutoff point.
 */

import type { MessagePreview } from '../hooks';
import './MessagePreviewPanel.css';

export interface MessagePreviewPanelProps {
  /** List of messages to display */
  messages: MessagePreview[];
  /** Currently selected cutoff message ID */
  cutoffMessageId: string | null;
  /** Original target message ID (from text selection) */
  originalTargetMessageId?: string | null;
  /** Callback when user clicks a message to change cutoff */
  onCutoffChange: (messageId: string) => void;
  /** Whether messages are loading */
  isLoading?: boolean;
}

export function MessagePreviewPanel({
  messages,
  cutoffMessageId,
  originalTargetMessageId,
  onCutoffChange,
  isLoading = false,
}: MessagePreviewPanelProps) {
  if (isLoading) {
    return (
      <div className="message-preview-panel">
        <div className="message-preview-loading">Loading messages...</div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="message-preview-panel">
        <div className="message-preview-empty">No messages in session</div>
      </div>
    );
  }

  // Find the cutoff index
  const cutoffIndex = cutoffMessageId
    ? messages.findIndex((m) => m.id === cutoffMessageId)
    : messages.length - 1;

  // Count included messages
  const includedCount = cutoffIndex + 1;
  const totalCount = messages.length;

  return (
    <div className="message-preview-panel">
      <div className="message-preview-header">
        <span className="message-preview-count">
          {includedCount} of {totalCount} messages will be included
        </span>
      </div>
      <div className="message-preview-list">
        {messages.map((message, index) => {
          const isIncluded = index <= cutoffIndex;
          const isCutoff = message.id === cutoffMessageId;
          const isOriginalTarget = message.id === originalTargetMessageId;

          return (
            <div
              key={message.id}
              className={`message-preview-item ${isIncluded ? 'included' : 'excluded'} ${isCutoff ? 'cutoff' : ''} ${message.role}`}
              onClick={() => onCutoffChange(message.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onCutoffChange(message.id);
                }
              }}
            >
              <div className="message-preview-role">{message.role === 'user' ? '👤' : '🤖'}</div>
              <div className="message-preview-content">
                <span className="message-preview-text">{message.preview}</span>
                {isOriginalTarget && (
                  <span className="message-preview-original-badge" title="Original selection point">
                    ●
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

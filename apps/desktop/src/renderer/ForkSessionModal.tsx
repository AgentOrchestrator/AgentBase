/**
 * Fork Session Modal
 *
 * Simple modal that appears when user drags to fork an AgentNode.
 * Collects fork title which is used to name the git branch.
 * Includes branch selection (defaults to parent's branch) and optional context preview.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { MessagePreviewPanel } from './components/MessagePreviewPanel';
import type { MessagePreview } from './hooks/useForkModal';
import './ForkSessionModal.css';

interface ForkSessionModalProps {
  /** Called when user confirms the fork */
  onConfirm: (title: string, baseBranch?: string) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Whether the fork operation is in progress */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Messages for context preview (null = not loaded) */
  messages?: MessagePreview[] | null;
  /** Whether messages are loading */
  isLoadingMessages?: boolean;
  /** Callback to load messages */
  onLoadMessages?: () => void;
  /** Currently selected cutoff message ID */
  cutoffMessageId?: string | null;
  /** Original target message ID (from text selection) */
  originalTargetMessageId?: string | null;
  /** Callback when cutoff changes */
  onCutoffChange?: (messageId: string) => void;
  /** Available branches for selection */
  branches?: string[];
  /** Whether branches are loading */
  isLoadingBranches?: boolean;
  /** Currently selected base branch (defaults to parent's branch) */
  selectedBranch?: string | null;
  /** Parent's current branch (used as default) */
  parentBranch?: string | null;
  /** Callback when branch selection changes */
  onBranchChange?: (branch: string) => void;
}

function ForkSessionModal({
  onConfirm,
  onCancel,
  isLoading = false,
  error = null,
  messages = null,
  isLoadingMessages = false,
  onLoadMessages,
  cutoffMessageId = null,
  originalTargetMessageId = null,
  onCutoffChange,
}: ForkSessionModalProps) {
  const [title, setTitle] = useState('');
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.focus();
      setTitle('');
    }
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(
    (e?: React.FormEvent | React.MouseEvent) => {
      e?.preventDefault();
      if (title.trim() && !isLoading) {
        onConfirm(title.trim());
      }
    },
    [title, isLoading, onConfirm]
  );

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onCancel, isLoading]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (!isLoading) {
          onCancel();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onCancel, isLoading]);

  return (
    <div className="fork-modal-overlay" onClick={isLoading ? undefined : onCancel}>
      <div
        className="fork-modal-container"
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="fork-modal-header">
          <div className="fork-modal-header-left">
            <span className="fork-modal-title">Fork Agent Session</span>
          </div>
          <div className="fork-modal-header-right">
            <button className="fork-modal-window-control" onClick={onCancel} disabled={isLoading}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <form className="fork-modal-content" onSubmit={handleSubmit}>
          <input
            ref={titleInputRef}
            type="text"
            className="fork-modal-title-input"
            placeholder="Fork name (e.g., implement-feature-x)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isLoading}
            autoFocus
            required
            onKeyDown={(e) => {
              // Enter: Submit
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
                return;
              }
              // Tab: Submit
              if (e.key === 'Tab') {
                e.preventDefault();
                handleSubmit(e);
                return;
              }
            }}
          />

          {/* Context Preview Section */}
          {onLoadMessages && (
            <div className="fork-modal-preview-section">
              <button
                type="button"
                className="fork-modal-preview-toggle"
                onClick={() => {
                  if (!isPreviewExpanded && !messages) {
                    onLoadMessages();
                  }
                  setIsPreviewExpanded(!isPreviewExpanded);
                }}
                disabled={isLoading}
              >
                {isPreviewExpanded ? '▼' : '▶'} Preview Context
              </button>

              {isPreviewExpanded && (
                <div className="fork-modal-preview-content">
                  {messages && onCutoffChange ? (
                    <MessagePreviewPanel
                      messages={messages}
                      cutoffMessageId={cutoffMessageId}
                      originalTargetMessageId={originalTargetMessageId}
                      onCutoffChange={onCutoffChange}
                      isLoading={isLoadingMessages}
                    />
                  ) : isLoadingMessages ? (
                    <div className="fork-modal-preview-loading">Loading messages...</div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {error && <div className="fork-modal-error">{error}</div>}
        </form>

        {/* Bottom Bar */}
        <div className="fork-modal-footer">
          <button
            type="button"
            className="fork-modal-create-btn"
            onClick={handleSubmit}
            disabled={!title.trim() || isLoading}
          >
            {isLoading ? 'Creating fork...' : 'Create fork'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ForkSessionModal;

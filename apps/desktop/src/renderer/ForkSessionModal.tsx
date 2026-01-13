/**
 * Fork Session Modal
 *
 * Simple modal that appears when user drags to fork an AgentNode.
 * Collects fork title which is used to name the git branch.
 */

import { useState, useEffect, useCallback } from 'react';
import './ForkSessionModal.css';

interface ForkSessionModalProps {
  /** Called when user confirms the fork */
  onConfirm: (title: string) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Whether the fork operation is in progress */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
}

function ForkSessionModal({
  onConfirm,
  onCancel,
  isLoading = false,
  error = null,
}: ForkSessionModalProps) {
  const [title, setTitle] = useState('');

  // Handle form submission
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
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

  return (
    <div className="fork-modal-overlay" onClick={isLoading ? undefined : onCancel}>
      <div className="fork-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="fork-modal-header">
          <h2 className="fork-modal-title">Fork Agent Session</h2>
          <button
            className="fork-modal-close"
            onClick={onCancel}
            disabled={isLoading}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <form className="fork-modal-content" onSubmit={handleSubmit}>
          <p className="fork-modal-description">
            Create a new agent in an isolated git worktree with the same session context.
          </p>

          <div className="fork-modal-field">
            <label htmlFor="fork-title" className="fork-modal-label">
              Fork Title
            </label>
            <input
              id="fork-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., implement-feature-x"
              className="fork-modal-input"
              disabled={isLoading}
              autoFocus
              required
            />
            <span className="fork-modal-hint">
              This will be used as the git branch name
            </span>
          </div>

          {/* Error message */}
          {error && <div className="fork-modal-error">{error}</div>}

          {/* Actions */}
          <div className="fork-modal-actions">
            <button
              type="button"
              className="fork-modal-button fork-modal-button-cancel"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="fork-modal-button fork-modal-button-confirm"
              disabled={!title.trim() || isLoading}
            >
              {isLoading ? 'Creating Fork...' : 'Create Fork'}
            </button>
          </div>
        </form>

        {/* Loading overlay */}
        {isLoading && (
          <div className="fork-modal-loading">
            <div className="fork-modal-spinner" />
            <span>Creating worktree and forking session...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ForkSessionModal;

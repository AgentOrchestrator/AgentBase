import { useEffect } from 'react';
import './BranchSwitchWarningDialog.css';

interface BranchSwitchWarningDialogProps {
  isOpen: boolean;
  onCancel: () => void;
}

export function BranchSwitchWarningDialog({ isOpen, onCancel }: BranchSwitchWarningDialogProps) {
  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="branch-switch-warning-overlay" onClick={onCancel}>
      <div className="branch-switch-warning-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="branch-switch-warning-header">
          <h3>Cannot Switch Branch</h3>
        </div>
        <div className="branch-switch-warning-content">
          <p>
            You have uncommitted changes. Please commit or discard your changes before switching
            branches.
          </p>
        </div>
        <div className="branch-switch-warning-footer">
          <button className="branch-switch-warning-cancel-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

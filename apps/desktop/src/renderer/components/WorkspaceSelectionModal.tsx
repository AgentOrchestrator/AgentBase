import { useState } from 'react';
import type { RecentWorkspaceEntry } from '../../main/preload';
import '../WorkspaceSelectionModal.css';

export interface WorkspaceSelectionModalProps {
  isOpen: boolean;
  recentWorkspaces: RecentWorkspaceEntry[];
  onSelect: (workspacePath: string) => void;
  onCancel: () => void;
  onBrowse: () => Promise<string | null>;
}

/**
 * Pure presentation component for workspace selection.
 * Receives data and callbacks via props - no business logic.
 */
export function WorkspaceSelectionModal({
  isOpen,
  recentWorkspaces,
  onSelect,
  onCancel,
  onBrowse,
}: WorkspaceSelectionModalProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  if (!isOpen) return null;

  const handleBrowse = async () => {
    setIsSelecting(true);
    try {
      const path = await onBrowse();
      if (path) {
        setSelectedPath(path);
      }
    } finally {
      setIsSelecting(false);
    }
  };

  const handleConfirm = () => {
    if (selectedPath) {
      onSelect(selectedPath);
    }
  };

  return (
    <div className="workspace-modal-overlay" onClick={onCancel}>
      <div className="workspace-modal" onClick={(e) => e.stopPropagation()}>
        <div className="workspace-modal-header">
          <h3>Select Workspace</h3>
          <button className="close-button" onClick={onCancel}>×</button>
        </div>

        <div className="workspace-modal-content">
          {/* Recent workspaces section */}
          {recentWorkspaces.length > 0 && (
            <div className="recent-workspaces-section">
              <h4>Recent Workspaces</h4>
              <div className="recent-workspaces-list">
                {recentWorkspaces.map((ws) => (
                  <button
                    key={ws.path}
                    className={`recent-workspace-item ${selectedPath === ws.path ? 'selected' : ''}`}
                    onClick={() => setSelectedPath(ws.path)}
                  >
                    <div className="workspace-name">{ws.name}</div>
                    <div className="workspace-path">{ws.path}</div>
                    {ws.git?.branch && (
                      <div className="workspace-git">{ws.git.branch}</div>
                    )}
                  </button>
                ))}
              </div>
              <div className="section-divider">OR</div>
            </div>
          )}

          <p>Browse or enter a workspace path:</p>

          <div className="workspace-path-input">
            <input
              type="text"
              value={selectedPath || ''}
              onChange={(e) => setSelectedPath(e.target.value)}
              placeholder="/path/to/workspace"
            />
            <button onClick={handleBrowse} disabled={isSelecting}>
              Browse...
            </button>
          </div>
        </div>

        <div className="workspace-modal-footer">
          <button className="cancel-button" onClick={onCancel}>Cancel</button>
          <button
            className="confirm-button"
            onClick={handleConfirm}
            disabled={!selectedPath}
          >
            Select
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import '../WorkspaceSelectionModal.css';

export interface WorkspaceSelectionModalProps {
  isOpen: boolean;
  onSelect: (workspacePath: string) => void;
  onCancel: () => void;
}

export function WorkspaceSelectionModal({
  isOpen,
  onSelect,
  onCancel,
}: WorkspaceSelectionModalProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  if (!isOpen) return null;

  const handleBrowse = async () => {
    setIsSelecting(true);
    try {
      // Debug: log what's in shellAPI
      console.log('[WorkspaceSelectionModal] shellAPI:', window.shellAPI);
      console.log('[WorkspaceSelectionModal] shellAPI keys:', window.shellAPI ? Object.keys(window.shellAPI) : 'undefined');

      if (!window.shellAPI?.openDirectoryDialog) {
        throw new Error('openDirectoryDialog not available in shellAPI');
      }

      const path = await window.shellAPI.openDirectoryDialog({
        title: 'Select Workspace Directory',
      });
      if (path) {
        setSelectedPath(path);
      }
    } catch (err) {
      console.error('[WorkspaceSelectionModal] Failed to open directory dialog:', err);
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
          <p>This agent node requires a workspace. Please select a directory:</p>

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

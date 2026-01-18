import { useEffect, useState } from 'react';
import '../WorkspaceSelectionModal.css';

export interface WorkspaceSelectionModalProps {
  isOpen: boolean;
  onSelect: (workspacePath: string) => void;
  onCancel: () => void;
  initialPath?: string | null;
}

export function WorkspaceSelectionModal({
  isOpen,
  onSelect,
  onCancel,
  initialPath,
}: WorkspaceSelectionModalProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(initialPath || null);
  const [isSelecting, setIsSelecting] = useState(false);

  // Update selectedPath when initialPath changes (e.g., when modal opens with a new initial path)
  useEffect(() => {
    if (initialPath && isOpen) {
      setSelectedPath(initialPath);
    }
  }, [initialPath, isOpen]);

  if (!isOpen) return null;

  const handleBrowse = async () => {
    setIsSelecting(true);
    try {
      // Debug: log what's in shellAPI
      console.log('[WorkspaceSelectionModal] shellAPI:', window.shellAPI);
      console.log(
        '[WorkspaceSelectionModal] shellAPI keys:',
        window.shellAPI ? Object.keys(window.shellAPI) : 'undefined'
      );

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
        </div>

        <div className="workspace-modal-content">
          <div className="workspace-path-input">
            <input
              type="text"
              value={selectedPath || ''}
              onChange={(e) => setSelectedPath(e.target.value)}
              placeholder="/path/to/workspace"
            />
            <button onClick={handleBrowse} disabled={isSelecting} className="browse-button">
              <svg width="16" height="16" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M64,192V120a40,40,0,0,1,40-40h75.89a40,40,0,0,1,22.19,6.72l27.84,18.56A40,40,0,0,0,252.11,112H408a40,40,0,0,1,40,40v40"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="32"
                />
                <path
                  d="M479.9,226.55,463.68,392a40,40,0,0,1-39.93,40H88.25a40,40,0,0,1-39.93-40L32.1,226.55A32,32,0,0,1,64,192h384.1A32,32,0,0,1,479.9,226.55Z"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="32"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="workspace-modal-footer">
          <button className="cancel-button" onClick={onCancel}>
            Cancel
          </button>
          <button className="confirm-button" onClick={handleConfirm} disabled={!selectedPath}>
            Select
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * WorktreeConfigSection Component
 *
 * Renders the worktree configuration UI in the New Agent Modal.
 * Reads from and writes to the useWorktreeConfigState Zustand store.
 */

import { useWorktreeConfigState } from '../hooks/useWorktreeConfigState';

interface WorktreeConfigSectionProps {
  /** Current workspace path (used to compute parent directory) */
  workspacePath: string | null;
}

export function WorktreeConfigSection({ workspacePath }: WorktreeConfigSectionProps) {
  const config = useWorktreeConfigState();

  if (!workspacePath) return null;

  // Handle both Unix (/) and Windows (\) path separators
  const pathSeparator = workspacePath.includes('\\') ? '\\' : '/';
  const parentDir = workspacePath.split(/[\\/]/).slice(0, -1).join(pathSeparator);

  return (
    <div className="worktree-config-section">
      <label className="new-agent-modal-checkbox-label worktree-config-checkbox">
        <input
          type="checkbox"
          className="new-agent-modal-checkbox"
          checked={config.enabled}
          onChange={(e) => config.setEnabled(e.target.checked)}
        />
        <span className="new-agent-modal-checkbox-text">Worktree</span>
      </label>

      {config.enabled && (
        <div className="worktree-config-fields">
          <div className="worktree-config-field">
            <label className="worktree-config-label">Branch</label>
            <input
              type="text"
              className="worktree-config-input"
              value={config.branchName}
              onChange={(e) => config.setBranchName(e.target.value)}
              placeholder="feature/branch-name"
            />
          </div>
          <div className="worktree-config-field">
            <label className="worktree-config-label">Folder</label>
            <input
              type="text"
              className="worktree-config-input"
              value={config.folderName}
              onChange={(e) => config.setFolderName(e.target.value)}
              placeholder="folder-name"
            />
          </div>
          <div className="worktree-config-path">
            <span className="worktree-config-path-prefix">
              {parentDir}
              {pathSeparator}
            </span>
            <span className="worktree-config-path-folder">
              {config.folderName || 'folder-name'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

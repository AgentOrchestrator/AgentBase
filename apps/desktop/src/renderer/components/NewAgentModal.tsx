import React, { useState, useEffect, useRef } from 'react';
import './NewAgentModal.css';

interface NewAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    title: string;
    description: string;
    workspacePath?: string;
    todo?: string;
    priority?: string;
    assignee?: string;
    project?: string;
    labels?: string[];
  }) => void;
  initialPosition?: { x: number; y: number };
  initialWorkspacePath?: string | null;
}

export function NewAgentModal({
  isOpen,
  onClose,
  onCreate,
  initialPosition,
  initialWorkspacePath,
}: NewAgentModalProps) {
  const [description, setDescription] = useState('');
  const [workspacePath, setWorkspacePath] = useState<string | null>(initialWorkspacePath || null);
  const [gitInfo, setGitInfo] = useState<{ branch: string | null } | null>(null);
  const [isLoadingGit, setIsLoadingGit] = useState(false);
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const branchDropdownRef = useRef<HTMLDivElement>(null);

  // Update workspace path when initialWorkspacePath changes
  useEffect(() => {
    if (initialWorkspacePath) {
      setWorkspacePath(initialWorkspacePath);
    }
  }, [initialWorkspacePath]);

  // Fetch git info when workspace path changes
  useEffect(() => {
    if (!workspacePath) {
      setGitInfo(null);
      return;
    }

    setIsLoadingGit(true);
    window.gitAPI?.getInfo(workspacePath)
      .then((info) => {
        setGitInfo({ branch: info?.branch || null });
        setIsLoadingGit(false);
      })
      .catch(() => {
        setGitInfo(null);
        setIsLoadingGit(false);
      });
  }, [workspacePath]);

  // Focus description input when modal opens
  useEffect(() => {
    if (isOpen && descriptionInputRef.current) {
      descriptionInputRef.current.focus();
      setDescription('');
      // Keep workspace path from initialWorkspacePath
      if (initialWorkspacePath) {
        setWorkspacePath(initialWorkspacePath);
      }
    }
  }, [isOpen, initialWorkspacePath]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
      // Close branch dropdown if clicking outside
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target as Node)) {
        setIsBranchDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Fetch branches when dropdown opens
  useEffect(() => {
    if (isBranchDropdownOpen && workspacePath) {
      setIsLoadingBranches(true);
      window.gitAPI?.listBranches(workspacePath)
        .then((branchList) => {
          setBranches(branchList || []);
          setIsLoadingBranches(false);
        })
        .catch(() => {
          setBranches([]);
          setIsLoadingBranches(false);
        });
    }
  }, [isBranchDropdownOpen, workspacePath]);

  const handleBrowseFolder = async () => {
    setIsSelectingFolder(true);
    try {
      if (!window.shellAPI?.openDirectoryDialog) {
        throw new Error('openDirectoryDialog not available in shellAPI');
      }

      const path = await window.shellAPI.openDirectoryDialog({
        title: 'Select Workspace Directory',
      });
      if (path) {
        setWorkspacePath(path);
        // Git info will be fetched automatically via useEffect
      }
    } catch (err) {
      console.error('[NewAgentModal] Failed to open directory dialog:', err);
    } finally {
      setIsSelectingFolder(false);
    }
  };

  // Get folder name (last segment of path)
  const getFolderName = (path: string | null): string => {
    if (!path) return 'No folder selected';
    return path.split('/').pop() || 'Workspace';
  };

  const handleCreate = () => {
    onCreate({
      title: description.trim() || 'New Agent',
      description: description.trim(),
      workspacePath: workspacePath || undefined,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="new-agent-modal-overlay" onClick={onClose}>
      <div
        className="new-agent-modal-container"
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="new-agent-modal-header">
          <div className="new-agent-modal-header-left">
            <div 
              className="new-agent-modal-folder-wrapper"
              onClick={handleBrowseFolder}
              style={{ cursor: 'pointer' }}
              title="Click to select folder"
            >
              <div className="new-agent-modal-folder-icon">
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
              </div>
              <span className="new-agent-modal-folder-path">
                {getFolderName(workspacePath)}
              </span>
            </div>
            {gitInfo?.branch && (
              <div 
                className="new-agent-modal-branch-wrapper"
                ref={branchDropdownRef}
                style={{ position: 'relative' }}
              >
                <div
                  onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <svg
                    className="new-agent-modal-branch-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 512 512"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle
                      cx="160"
                      cy="96"
                      r="48"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="32"
                    />
                    <circle
                      cx="160"
                      cy="416"
                      r="48"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="32"
                    />
                    <line
                      x1="160"
                      y1="368"
                      x2="160"
                      y2="144"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="32"
                    />
                    <circle
                      cx="352"
                      cy="160"
                      r="48"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="32"
                    />
                    <line
                      x1="352"
                      y1="112"
                      x2="352"
                      y2="208"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="32"
                    />
                    <path
                      d="M352,208c0,128-192,48-192,160"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="32"
                    />
                  </svg>
                  <span className="new-agent-modal-branch">{gitInfo.branch}</span>
                </div>
                {isBranchDropdownOpen && (
                  <div className="new-agent-modal-branch-dropdown">
                    <div
                      className="new-agent-modal-branch-dropdown-item"
                      onClick={() => {
                        // TODO: Implement new branch creation
                        setIsBranchDropdownOpen(false);
                      }}
                    >
                      New branch
                    </div>
                    <div
                      className="new-agent-modal-branch-dropdown-item"
                      onClick={() => {
                        // TODO: Implement new branch from existing branch
                        setIsBranchDropdownOpen(false);
                      }}
                    >
                      New branch from
                    </div>
                    <div className="new-agent-modal-branch-dropdown-divider" />
                    {isLoadingBranches ? (
                      <div className="new-agent-modal-branch-dropdown-item">Loading...</div>
                    ) : branches.length === 0 ? (
                      <div className="new-agent-modal-branch-dropdown-item">No branches found</div>
                    ) : (
                      branches
                        .filter((branch) => branch !== gitInfo.branch) // Exclude current branch
                        .slice(0, 3) // Show only 3 most recent
                        .map((branch) => (
                          <div
                            key={branch}
                            className="new-agent-modal-branch-dropdown-item"
                            onClick={() => {
                              // TODO: Implement branch switching
                              setIsBranchDropdownOpen(false);
                            }}
                          >
                            {branch}
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="new-agent-modal-header-right">
            <button className="new-agent-modal-window-control" onClick={onClose}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="new-agent-modal-content">
          <textarea
            ref={descriptionInputRef}
            className="new-agent-modal-description-input"
            placeholder="Create a new agent"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleCreate();
              }
            }}
            rows={6}
          />
        </div>

        {/* Bottom Bar */}
        <div className="new-agent-modal-footer">
          <button
            className="new-agent-modal-create-btn"
            onClick={handleCreate}
          >
            Start agent
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './NewAgentModal.css';
import { worktreeService } from '../services/WorktreeService';
import type { WorktreeInfo } from '../../main/types/worktree';
import { CheckoutConflictModal } from './CheckoutConflictModal';

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
  autoCreateWorktree?: boolean;
}

export function NewAgentModal({
  isOpen,
  onClose,
  onCreate,
  initialPosition,
  initialWorkspacePath,
  autoCreateWorktree = false,
}: NewAgentModalProps) {
  const [description, setDescription] = useState('');
  const [workspacePath, setWorkspacePath] = useState<string | null>(initialWorkspacePath || null);
  const [gitInfo, setGitInfo] = useState<{ branch: string | null } | null>(null);
  const [isLoadingGit, setIsLoadingGit] = useState(false);
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isCreatingNewBranch, setIsCreatingNewBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [worktreeInfo, setWorktreeInfo] = useState<WorktreeInfo | null>(null);
  const [isCreatingWorktree, setIsCreatingWorktree] = useState(false);
  const [originalWorkspacePath, setOriginalWorkspacePath] = useState<string | null>(null);
  const [selectedBranchIndex, setSelectedBranchIndex] = useState<number | null>(null);
  const [checkoutConflictFiles, setCheckoutConflictFiles] = useState<string[]>([]);
  const [showCheckoutConflictModal, setShowCheckoutConflictModal] = useState(false);
  const [pendingCheckoutBranch, setPendingCheckoutBranch] = useState<string | null>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const branchDropdownRef = useRef<HTMLDivElement>(null);
  const newBranchInputRef = useRef<HTMLInputElement>(null);
  const handleCreateWorktreeRef = useRef<() => void>(() => {});

  // Update workspace path when initialWorkspacePath changes
  useEffect(() => {
    if (initialWorkspacePath) {
      setWorkspacePath(initialWorkspacePath);
      setOriginalWorkspacePath(initialWorkspacePath);
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
      setIsCreatingNewBranch(false);
      setNewBranchName('');
      setWorktreeInfo(null);
      setOriginalWorkspacePath(null);
      setSelectedBranchIndex(null);
      setShowCheckoutConflictModal(false);
      setCheckoutConflictFiles([]);
      setPendingCheckoutBranch(null);
      // Keep workspace path from initialWorkspacePath
      if (initialWorkspacePath) {
        setWorkspacePath(initialWorkspacePath);
        setOriginalWorkspacePath(initialWorkspacePath);
      }
    }
  }, [isOpen, initialWorkspacePath]);

  // Focus new branch input when entering new branch mode
  useEffect(() => {
    if (isCreatingNewBranch && newBranchInputRef.current) {
      newBranchInputRef.current.focus();
    }
  }, [isCreatingNewBranch]);

  // Handle Escape key and Command+F for branch cycling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      // Command+F (Mac) or Ctrl+F (Windows/Linux) to cycle through branches
      if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
        // Only cycle if we have branches and a workspace path
        if (workspacePath && branches.length > 0) {
          event.preventDefault();
          const availableBranches = branches.filter((branch) => branch !== gitInfo?.branch);
          if (availableBranches.length > 0) {
            setSelectedBranchIndex((prev) => {
              if (prev === null) {
                return 0;
              }
              return (prev + 1) % availableBranches.length;
            });
          }
        }
      }

      // Command+E (Mac) or Ctrl+E (Windows/Linux) to create new branch
      if ((event.metaKey || event.ctrlKey) && event.key === 'e') {
        if (workspacePath && gitInfo?.branch) {
          event.preventDefault();
          setIsBranchDropdownOpen(false);
          setIsCreatingNewBranch(true);
        }
      }

      // Command+G (Mac) or Ctrl+G (Windows/Linux) to create new worktree
      if ((event.metaKey || event.ctrlKey) && event.key === 'g') {
        if (workspacePath) {
          event.preventDefault();
          // Create worktree (defined below)
          handleCreateWorktreeRef.current();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, workspacePath, branches, gitInfo?.branch]);

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

  // Fetch branches when workspace path is available (not just when dropdown opens)
  useEffect(() => {
    if (workspacePath) {
      setIsLoadingBranches(true);
      window.gitAPI?.listBranches(workspacePath)
        .then((branchList) => {
          setBranches(branchList || []);
          setIsLoadingBranches(false);
          // Don't reset selection when branches are loaded - keep current selection
        })
        .catch(() => {
          setBranches([]);
          setIsLoadingBranches(false);
        });
    } else {
      setBranches([]);
    }
  }, [workspacePath]);

  // Auto-create worktree when modal opens with autoCreateWorktree flag
  useEffect(() => {
    if (isOpen && autoCreateWorktree && workspacePath && !worktreeInfo && !isCreatingWorktree) {
      // Use the ref to call handleCreateWorktree
      handleCreateWorktreeRef.current();
    }
  }, [isOpen, autoCreateWorktree, workspacePath, worktreeInfo, isCreatingWorktree]);

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
        setOriginalWorkspacePath(path);
        // Clear worktree if user selects a new folder
        setWorktreeInfo(null);
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

  // Parse files from git checkout error message
  const parseFilesFromCheckoutError = (errorMessage: string): string[] => {
    const files: string[] = [];
    const lines = errorMessage.split('\n');
    let inFileList = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Start collecting files after "would be overwritten by checkout:"
      if (trimmedLine.includes('would be overwritten by checkout')) {
        inFileList = true;
        continue;
      }
      
      // Stop collecting when we hit "Please commit" or "Aborting"
      if (inFileList && (trimmedLine.includes('Please commit') || trimmedLine.includes('Aborting'))) {
        break;
      }
      
      // Collect file names (skip empty lines and error prefix)
      if (inFileList && trimmedLine && !trimmedLine.startsWith('error:')) {
        files.push(trimmedLine);
      }
    }
    
    return files;
  };

  // Handle checkout conflict actions
  const handleStashAndCheckout = async () => {
    if (!pendingCheckoutBranch || !originalWorkspacePath) return;
    
    setShowCheckoutConflictModal(false);
    try {
      // First stash the changes
      const stashResult = await window.gitAPI?.stash(originalWorkspacePath);
      if (!stashResult?.success) {
        alert(`Failed to stash changes: ${stashResult?.error || 'Unknown error'}`);
        setPendingCheckoutBranch(null);
        return;
      }

      // Then checkout the branch
      const checkoutResult = await window.gitAPI?.checkoutBranch(originalWorkspacePath, pendingCheckoutBranch);
      if (!checkoutResult?.success) {
        alert(`Failed to checkout branch: ${checkoutResult?.error || 'Unknown error'}`);
        setPendingCheckoutBranch(null);
        return;
      }

      // Refresh git info
      const finalWorkspacePath = worktreeInfo?.worktreePath || workspacePath || undefined;
      if (finalWorkspacePath) {
        const updatedInfo = await window.gitAPI?.getInfo(finalWorkspacePath);
        if (updatedInfo) {
          setGitInfo({ branch: updatedInfo.branch });
        }
      }

      // Continue with agent creation
      onCreate({
        title: description.trim() || 'New Agent',
        description: description.trim(),
        workspacePath: finalWorkspacePath,
      });
      onClose();
    } catch (error) {
      alert(`Error: ${(error as Error).message}`);
    }
    setPendingCheckoutBranch(null);
  };

  const handleMigrateChanges = async () => {
    if (!pendingCheckoutBranch || !originalWorkspacePath) return;
    
    setShowCheckoutConflictModal(false);
    // Migrate changes: stash, checkout, then apply stash to new branch
    try {
      // Stash the changes
      const stashResult = await window.gitAPI?.stash(originalWorkspacePath);
      if (!stashResult?.success) {
        alert(`Failed to stash changes: ${stashResult?.error || 'Unknown error'}`);
        setPendingCheckoutBranch(null);
        return;
      }

      // Checkout the branch
      const checkoutResult = await window.gitAPI?.checkoutBranch(originalWorkspacePath, pendingCheckoutBranch);
      if (!checkoutResult?.success) {
        alert(`Failed to checkout branch: ${checkoutResult?.error || 'Unknown error'}`);
        setPendingCheckoutBranch(null);
        return;
      }

      // Apply stash to new branch (migrate changes)
      const stashPopResult = await window.gitAPI?.stashPop(originalWorkspacePath);
      if (!stashPopResult?.success) {
        // Non-fatal: stash might have conflicts or be empty, but checkout succeeded
        console.warn('[NewAgentModal] Failed to apply stash (non-fatal):', stashPopResult?.error);
      }

      // Refresh git info
      const finalWorkspacePath = worktreeInfo?.worktreePath || workspacePath || undefined;
      if (finalWorkspacePath) {
        const updatedInfo = await window.gitAPI?.getInfo(finalWorkspacePath);
        if (updatedInfo) {
          setGitInfo({ branch: updatedInfo.branch });
        }
      }

      // Continue with agent creation
      onCreate({
        title: description.trim() || 'New Agent',
        description: description.trim(),
        workspacePath: finalWorkspacePath,
      });
      onClose();
    } catch (error) {
      alert(`Error: ${(error as Error).message}`);
    }
    setPendingCheckoutBranch(null);
  };

  const handleForceCheckout = async () => {
    if (!pendingCheckoutBranch || !originalWorkspacePath) return;
    
    setShowCheckoutConflictModal(false);
    try {
      // Force checkout (discards local changes)
      const result = await window.gitAPI?.checkoutForce(originalWorkspacePath, pendingCheckoutBranch);
      if (!result?.success) {
        alert(`Failed to force checkout branch: ${result?.error || 'Unknown error'}`);
        setPendingCheckoutBranch(null);
        return;
      }

      // Refresh git info
      const finalWorkspacePath = worktreeInfo?.worktreePath || workspacePath || undefined;
      if (finalWorkspacePath) {
        const updatedInfo = await window.gitAPI?.getInfo(finalWorkspacePath);
        if (updatedInfo) {
          setGitInfo({ branch: updatedInfo.branch });
        }
      }

      // Continue with agent creation
      onCreate({
        title: description.trim() || 'New Agent',
        description: description.trim(),
        workspacePath: finalWorkspacePath,
      });
      onClose();
    } catch (error) {
      alert(`Error: ${(error as Error).message}`);
    }
    setPendingCheckoutBranch(null);
  };

  const handleCancelCheckout = () => {
    setShowCheckoutConflictModal(false);
    setPendingCheckoutBranch(null);
    setCheckoutConflictFiles([]);
    setSelectedBranchIndex(null); // Reset branch selection so it doesn't try again
  };

  const handleCreateWorktree = useCallback(async () => {
    if (!workspacePath) {
      alert('Please select a workspace folder first');
      return;
    }

    setIsCreatingWorktree(true);
    setIsBranchDropdownOpen(false);

    try {
      // Generate a branch name based on timestamp or description
      const branchName = description.trim() 
        ? `agent-${description.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}-${Date.now().toString().slice(-6)}`
        : `agent-${Date.now().toString().slice(-6)}`;

      const result = await worktreeService.createWorktree(workspacePath, branchName, {
        agentId: undefined, // Will be set when agent is created
      });

      if (!result.success) {
        alert(`Failed to create worktree: ${result.error || 'Unknown error'}`);
        setIsCreatingWorktree(false);
        return;
      }

      // Get the full worktree info
      if (result.worktreeId) {
        const worktree = await worktreeService.getWorktree(result.worktreeId);
        if (worktree) {
          setWorktreeInfo(worktree);
          // Store original path if not already stored
          if (!originalWorkspacePath) {
            setOriginalWorkspacePath(workspacePath);
          }
          // Update workspace path to the worktree path
          setWorkspacePath(worktree.worktreePath);
          // Refresh git info for the worktree
          const updatedInfo = await window.gitAPI?.getInfo(worktree.worktreePath);
          if (updatedInfo) {
            setGitInfo({ branch: updatedInfo.branch });
          }
        }
      }
    } catch (error) {
      console.error('[NewAgentModal] Error creating worktree:', error);
      alert(`Error creating worktree: ${(error as Error).message}`);
    } finally {
      setIsCreatingWorktree(false);
    }
  }, [workspacePath, description]);

  // Store handleCreateWorktree in ref for keyboard handler
  useEffect(() => {
    handleCreateWorktreeRef.current = handleCreateWorktree;
  }, [handleCreateWorktree]);

  const handleCreate = async () => {
    // Prevent multiple clicks
    if (isCreatingBranch || isCreatingWorktree) return;

    // If creating a new branch, create it first
    if (isCreatingNewBranch && newBranchName.trim() && workspacePath) {
      setIsCreatingBranch(true);
      try {
        const result = await window.gitAPI?.createBranch(workspacePath, newBranchName.trim());
        if (!result?.success) {
          console.error('[NewAgentModal] Failed to create branch:', result?.error);
          alert(`Failed to create branch: ${result?.error || 'Unknown error'}`);
          setIsCreatingBranch(false);
          return;
        }
        // Refresh git info to get the new branch
        const updatedInfo = await window.gitAPI?.getInfo(workspacePath);
        if (updatedInfo) {
          setGitInfo({ branch: updatedInfo.branch });
        }
      } catch (error) {
        console.error('[NewAgentModal] Error creating branch:', error);
        alert(`Error creating branch: ${(error as Error).message}`);
        setIsCreatingBranch(false);
        return;
      } finally {
        setIsCreatingBranch(false);
      }
    }

    // Determine the workspace path to use (worktree or regular)
    const finalWorkspacePath = worktreeInfo?.worktreePath || workspacePath || undefined;

    // If a branch is selected (rotated to), checkout that branch
    // Use the original workspace path (not worktree) for checkout since branches are in the main repo
    // Only attempt checkout if we're not already showing the conflict modal
    if (selectedBranchIndex !== null && originalWorkspacePath && !showCheckoutConflictModal) {
      const availableBranches = branches.filter((branch) => branch !== gitInfo?.branch);
      const selectedBranch = availableBranches[selectedBranchIndex];
      if (selectedBranch) {
        try {
          const result = await window.gitAPI?.checkoutBranch(originalWorkspacePath, selectedBranch);
          if (!result?.success) {
            // Check if error is about local changes
            const errorMessage = result?.error || '';
            if (errorMessage.includes('would be overwritten by checkout') || errorMessage.includes('local changes')) {
              // Parse files from error message
              const files = parseFilesFromCheckoutError(errorMessage);
              setCheckoutConflictFiles(files);
              setPendingCheckoutBranch(selectedBranch);
              setShowCheckoutConflictModal(true);
              return; // Don't create agent yet, wait for user action
            }
            console.error('[NewAgentModal] Failed to checkout branch:', result?.error);
            alert(`Failed to checkout branch: ${result?.error || 'Unknown error'}`);
            // Reset selection on error so it doesn't keep trying
            setSelectedBranchIndex(null);
            return;
          }
          // Refresh git info to get the checked out branch (use final workspace path)
          if (finalWorkspacePath) {
            const updatedInfo = await window.gitAPI?.getInfo(finalWorkspacePath);
            if (updatedInfo) {
              setGitInfo({ branch: updatedInfo.branch });
            }
          }
        } catch (error) {
          console.error('[NewAgentModal] Error checking out branch:', error);
          alert(`Error checking out branch: ${(error as Error).message}`);
          // Reset selection on error so it doesn't keep trying
          setSelectedBranchIndex(null);
          return;
        }
      }
    }

    onCreate({
      title: description.trim() || 'New Agent',
      description: description.trim(),
      workspacePath: finalWorkspacePath,
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
            {/* Show original folder only if no worktree is active */}
            {!worktreeInfo && (
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
                  {getFolderName(workspacePath || originalWorkspacePath)}
                </span>
              </div>
            )}
            {/* Show worktree when active */}
            {worktreeInfo && (
              <div className="new-agent-modal-worktree-wrapper">
                <div className="new-agent-modal-worktree-icon">
                  <svg width="14" height="14" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
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
                <span className="new-agent-modal-worktree-path">
                  {worktreeInfo.worktreePath.split('/').pop() || 'Worktree'}
                </span>
              </div>
            )}
            {gitInfo?.branch && (
              <div 
                className="new-agent-modal-branch-wrapper"
                ref={branchDropdownRef}
                style={{ position: 'relative' }}
              >
                <div
                  onClick={() => {
                    if (isCreatingNewBranch) {
                      // If in new branch mode, go back to dropdown
                      setIsCreatingNewBranch(false);
                      setNewBranchName('');
                      setIsBranchDropdownOpen(true);
                    } else {
                      setIsBranchDropdownOpen(!isBranchDropdownOpen);
                    }
                  }}
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
                  {isCreatingNewBranch ? (
                    <input
                      ref={newBranchInputRef}
                      type="text"
                      className="new-agent-modal-branch-input"
                      placeholder="Branch name"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setIsCreatingNewBranch(false);
                          setNewBranchName('');
                          setIsBranchDropdownOpen(true);
                        }
                        e.stopPropagation();
                      }}
                    />
                  ) : (
                    <span className="new-agent-modal-branch">
                      {(() => {
                        // Show selected branch if cycling, otherwise show current branch
                        if (selectedBranchIndex !== null) {
                          const availableBranches = branches.filter((branch) => branch !== gitInfo.branch);
                          if (availableBranches[selectedBranchIndex]) {
                            return availableBranches[selectedBranchIndex];
                          }
                        }
                        return gitInfo.branch;
                      })()}
                    </span>
                  )}
                </div>
                {isBranchDropdownOpen && !isCreatingNewBranch && (
                  <div className="new-agent-modal-branch-dropdown">
                    <div
                      className="new-agent-modal-branch-dropdown-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsBranchDropdownOpen(false);
                        setIsCreatingNewBranch(true);
                      }}
                    >
                      New branch <span className="new-agent-modal-command-hint">⌘E</span>
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
                    <div
                      className="new-agent-modal-branch-dropdown-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateWorktree();
                      }}
                    >
                      New worktree <span className="new-agent-modal-command-hint">⌘G</span>
                    </div>
                    <div className="new-agent-modal-branch-dropdown-divider" />
                    <div className="new-agent-modal-branch-dropdown-item new-agent-modal-branch-dropdown-item-disabled">
                      Rotate branches <span className="new-agent-modal-command-hint">⌘F</span>
                    </div>
                    <div className="new-agent-modal-branch-dropdown-divider" />
                    {isLoadingBranches ? (
                      <div className="new-agent-modal-branch-dropdown-item">Loading...</div>
                    ) : branches.length === 0 ? (
                      <div className="new-agent-modal-branch-dropdown-item">No branches found</div>
                    ) : (
                      branches
                        .filter((branch) => branch !== gitInfo.branch) // Exclude current branch
                        .map((branch, index) => (
                          <div
                            key={branch}
                            className={`new-agent-modal-branch-dropdown-item ${
                              selectedBranchIndex === index ? 'selected' : ''
                            }`}
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
              // Shift+Enter: Allow default behavior (line break)
              if (e.key === 'Enter' && e.shiftKey) {
                return; // Allow default behavior
              }
              // Enter (without Shift): Submit
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleCreate();
                return;
              }
              // Tab: Submit
              if (e.key === 'Tab') {
                e.preventDefault();
                handleCreate();
                return;
              }
              // Cmd/Ctrl+Enter: Submit (keep existing behavior)
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
            disabled={(isCreatingNewBranch && !newBranchName.trim()) || isCreatingBranch || isCreatingWorktree}
          >
            {isCreatingBranch ? 'Creating branch...' : isCreatingWorktree ? 'Creating worktree...' : 'Start agent'}
          </button>
        </div>
      </div>
      <CheckoutConflictModal
        isOpen={showCheckoutConflictModal}
        files={checkoutConflictFiles}
        onStashAndCheckout={handleStashAndCheckout}
        onMigrateChanges={handleMigrateChanges}
        onForceCheckout={handleForceCheckout}
        onCancel={handleCancelCheckout}
      />
    </div>
  );
}

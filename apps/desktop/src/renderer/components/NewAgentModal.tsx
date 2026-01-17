import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './NewAgentModal.css';
import { worktreeService } from '../services/WorktreeService';
import type { WorktreeInfo } from '../../main/types/worktree';
import { BranchSwitchWarningDialog } from './BranchSwitchWarningDialog';
import { MessagePreviewPanel } from './MessagePreviewPanel';
import type { GitInfo } from '@agent-orchestrator/shared';
import type { MessagePreview } from '../hooks/useForkModal';

/**
 * Data for fork mode operations
 */
interface ForkData {
  /** Parent session ID being forked */
  parentSessionId: string;
  /** Parent's current git branch */
  parentBranch?: string;
  /** Target message ID for filtering context */
  targetMessageId?: string;
  /** Original target message ID from text selection */
  originalTargetMessageId?: string;
  /** Whether to create a worktree by default */
  createWorktree?: boolean;
}

interface NewAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    title: string;
    description: string;
    workspacePath: string;
    gitInfo: GitInfo;
    todo?: string;
    priority?: string;
    assignee?: string;
    project?: string;
    labels?: string[];
  }) => void;
  initialPosition?: { x: number; y: number };
  initialWorkspacePath?: string | null;
  autoCreateWorktree?: boolean;
  initialDescription?: string;

  // Fork mode props
  /** Whether the modal is in fork mode */
  isForkMode?: boolean;
  /** Fork operation data */
  forkData?: ForkData;
  /** Messages for context preview */
  messages?: MessagePreview[] | null;
  /** Whether messages are loading */
  isLoadingMessages?: boolean;
  /** Callback to load messages */
  onLoadMessages?: () => void;
  /** Currently selected cutoff message ID */
  cutoffMessageId?: string | null;
  /** Callback when cutoff changes */
  onCutoffChange?: (messageId: string) => void;
  /** Callback for fork confirmation (used instead of onCreate in fork mode) */
  onForkConfirm?: (data: {
    title: string;
    workspacePath: string;
    gitInfo: GitInfo;
    createWorktree: boolean;
    branchName?: string;
    /**
     * Explicit worktree path or directory name for worktree creation.
     * When createWorktree=true, this specifies where the worktree will be created.
     */
    worktreePath?: string;
  }) => void;
}

export function NewAgentModal({
  isOpen,
  onClose,
  onCreate,
  initialPosition: _initialPosition,
  initialWorkspacePath,
  autoCreateWorktree = false,
  initialDescription,
  // Fork mode props
  isForkMode = false,
  forkData,
  messages: forkMessages,
  isLoadingMessages = false,
  onLoadMessages,
  cutoffMessageId,
  onCutoffChange,
  onForkConfirm,
}: NewAgentModalProps) {
  const [description, setDescription] = useState('');
  const [workspacePath, setWorkspacePath] = useState<string | null>(initialWorkspacePath || null);
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null);
  const [isLoadingGit, setIsLoadingGit] = useState(false);
  const [showBranchSwitchWarning, setShowBranchSwitchWarning] = useState(false);
  const [_isSelectingFolder, setIsSelectingFolder] = useState(false);
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
  const [keyboardFocus, setKeyboardFocus] = useState<'input' | 'folder' | 'branch'>('input');
  const [dropdownItemIndex, setDropdownItemIndex] = useState<number | null>(null);
  // Fork mode state
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [shouldCreateWorktreeForFork, setShouldCreateWorktreeForFork] = useState(forkData?.createWorktree ?? true);
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
        setGitInfo(info);
        setIsLoadingGit(false);
      })
      .catch(() => {
        // Not a git repository
        setGitInfo(null);
        setIsLoadingGit(false);
      });
  }, [workspacePath]);

  // Focus description input when modal opens
  useEffect(() => {
    if (isOpen && descriptionInputRef.current) {
      descriptionInputRef.current.focus();
      // Set description from initialDescription if provided, otherwise clear it
      setDescription(initialDescription || '');
      setIsCreatingNewBranch(false);
      setNewBranchName('');
      setWorktreeInfo(null);
      setOriginalWorkspacePath(null);
      setSelectedBranchIndex(null);
      setShowBranchSwitchWarning(false);
      setKeyboardFocus('input');
      setDropdownItemIndex(null);
      setIsBranchDropdownOpen(false);
      // Keep workspace path from initialWorkspacePath
      if (initialWorkspacePath) {
        setWorkspacePath(initialWorkspacePath);
        setOriginalWorkspacePath(initialWorkspacePath);
      }
    } else if (!isOpen) {
      // Reset warning state when modal closes
      setShowBranchSwitchWarning(false);
      setKeyboardFocus('input');
      setDropdownItemIndex(null);
    }
  }, [isOpen, initialWorkspacePath, initialDescription]);

  // Focus new branch input when entering new branch mode
  useEffect(() => {
    if (isCreatingNewBranch && newBranchInputRef.current) {
      newBranchInputRef.current.focus();
    }
  }, [isCreatingNewBranch]);

  // Get available branches for dropdown (excluding current branch)
  const availableBranches = branches.filter((branch) => branch !== gitInfo?.branch);
  
  // Define handleBrowseFolder before it's used in useEffect
  const handleBrowseFolder = useCallback(async () => {
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
  }, []);
  
  // Get dropdown items (actions + branches) - only actionable items, no dividers
  const dropdownItems = useMemo(() => {
    const items: Array<{ type: 'action' | 'branch'; label?: string; branch?: string; action?: () => void }> = [];
    if (workspacePath && gitInfo?.branch) {
      items.push(
        { type: 'action', label: 'New branch', action: () => setIsCreatingNewBranch(true) },
        { type: 'action', label: 'New branch from', action: () => {} },
        { type: 'action', label: 'New worktree', action: () => handleCreateWorktreeRef.current() }
      );
    }
    items.push(...availableBranches.map((branch) => ({ type: 'branch' as const, branch })));
    return items;
  }, [workspacePath, gitInfo?.branch, availableBranches]);

  // Auto-open dropdown when branch is highlighted
  useEffect(() => {
    if (keyboardFocus === 'branch' && gitInfo?.branch && !isCreatingNewBranch) {
      setIsBranchDropdownOpen(true);
      if (dropdownItems.length > 0 && dropdownItemIndex === null) {
        setDropdownItemIndex(0);
      }
    } else if (keyboardFocus !== 'branch') {
      setIsBranchDropdownOpen(false);
      setDropdownItemIndex(null);
    }
  }, [keyboardFocus, gitInfo?.branch, isCreatingNewBranch, dropdownItems.length, dropdownItemIndex]);

  // Handle Escape key, Tab navigation, and Command shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      
      // Allow new branch input to handle its own keys
      if (target === newBranchInputRef.current) {
        if (event.key === 'Enter' || event.key === 'Escape') {
          return; // Let new branch input handle these
        }
      }

      // If we're in navigation mode (folder/branch), handle keys globally
      if (keyboardFocus !== 'input') {
        // In navigation mode - handle keys globally
      } else if (target === descriptionInputRef.current) {
        // Text entry box is active - only let textarea handle Enter, not Tab
        if (event.key === 'Enter') {
          return; // Let textarea handler take care of Enter
        }
        // Tab should be handled by global handler to navigate to folder
      }

      if (event.key === 'Escape') {
        if (isBranchDropdownOpen) {
          setIsBranchDropdownOpen(false);
          setDropdownItemIndex(null);
          setKeyboardFocus('branch');
        } else if (isCreatingNewBranch) {
          setIsCreatingNewBranch(false);
          setNewBranchName('');
          setKeyboardFocus('branch');
        } else {
          onClose();
        }
        return;
      }

      // Tab navigation: input -> folder -> branch -> input
      if (event.key === 'Tab' && !event.shiftKey) {
        // Always prevent default Tab behavior when modal is open
        event.preventDefault();
        
        if (keyboardFocus === 'input') {
          // Tab from input: go to folder (if visible) or branch
          // Blur textarea first
          if (descriptionInputRef.current) {
            descriptionInputRef.current.blur();
          }
          if (!worktreeInfo) {
            // Folder is visible - go to folder
            setKeyboardFocus('folder');
          } else if (gitInfo?.branch) {
            // Worktree is active, skip folder and go to branch
            setKeyboardFocus('branch');
          }
          // If neither folder nor branch available, stay on input
        } else if (keyboardFocus === 'folder') {
          // Tab from folder: go to branch (if available) or back to input
          if (gitInfo?.branch) {
            setKeyboardFocus('branch');
          } else {
            setKeyboardFocus('input');
            descriptionInputRef.current?.focus();
          }
        } else if (keyboardFocus === 'branch') {
          // Tab from branch: go back to input
          setKeyboardFocus('input');
          descriptionInputRef.current?.focus();
        }
        return;
      }

      // Enter key actions
      if (event.key === 'Enter' && !event.shiftKey) {
        if (keyboardFocus === 'folder') {
          event.preventDefault();
          handleBrowseFolder();
          return;
        } else if (keyboardFocus === 'branch') {
          event.preventDefault();
          if (isBranchDropdownOpen && dropdownItemIndex !== null) {
            const item = dropdownItems[dropdownItemIndex];
            if (item && item.type === 'action') {
              item.action();
              setIsBranchDropdownOpen(false);
              setDropdownItemIndex(null);
            } else if (item && item.type === 'branch') {
              // Select branch for checkout
              const branchIndex = availableBranches.indexOf(item.branch);
              setSelectedBranchIndex(branchIndex);
              setIsBranchDropdownOpen(false);
              setDropdownItemIndex(null);
            }
          }
          return;
        }
        // If keyboardFocus is 'input', let textarea handler take care of it
        return;
      }

      // Up/Down arrow keys for dropdown navigation
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && keyboardFocus === 'branch' && isBranchDropdownOpen) {
        event.preventDefault();
        if (dropdownItemIndex === null) {
          setDropdownItemIndex(event.key === 'ArrowDown' ? 0 : dropdownItems.length - 1);
        } else {
          setDropdownItemIndex((prev) => {
            if (prev === null) return 0;
            if (event.key === 'ArrowDown') {
              return (prev + 1) % dropdownItems.length;
            } else {
              return (prev - 1 + dropdownItems.length) % dropdownItems.length;
            }
          });
        }
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
  }, [isOpen, onClose, workspacePath, branches, gitInfo?.branch, keyboardFocus, isBranchDropdownOpen, dropdownItemIndex, dropdownItems, availableBranches, worktreeInfo, isCreatingNewBranch, handleBrowseFolder]);

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

  // Get folder name (last segment of path)
  const getFolderName = (path: string | null): string => {
    if (!path) return 'No folder selected';
    return path.split('/').pop() || 'Workspace';
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

      // Compute full sibling worktree path
      const parentDir = workspacePath.split('/').slice(0, -1).join('/');
      const dirName = description.trim()
        ? `agent-${description.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`
        : `agent-${Date.now().toString().slice(-6)}`;
      const fullWorktreePath = `${parentDir}/${dirName}`;

      const result = await worktreeService.createWorktree(workspacePath, branchName, {
        agentId: undefined, // Will be set when agent is created
        worktreePath: fullWorktreePath,
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
            setGitInfo(updatedInfo);
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
          setGitInfo(updatedInfo);
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
    if (selectedBranchIndex !== null && originalWorkspacePath) {
      const availableBranches = branches.filter((branch) => branch !== gitInfo?.branch);
      const selectedBranch = availableBranches[selectedBranchIndex];
      if (selectedBranch) {
        // Check for uncommitted changes before attempting checkout
        const currentGitInfo = await window.gitAPI?.getInfo(originalWorkspacePath);
        if (currentGitInfo?.status === 'dirty') {
          // Show warning dialog and prevent checkout
          setShowBranchSwitchWarning(true);
          return;
        }

        try {
          const result = await window.gitAPI?.checkoutBranch(originalWorkspacePath, selectedBranch);
          if (!result?.success) {
            console.error('[NewAgentModal] Failed to checkout branch:', result?.error);
            // Check if error is due to uncommitted changes
            if (result?.error?.toLowerCase().includes('uncommitted') || result?.error?.toLowerCase().includes('changes')) {
              setShowBranchSwitchWarning(true);
              return;
            }
            alert(`Failed to checkout branch: ${result?.error || 'Unknown error'}`);
            return;
          }
          // Refresh git info to get the checked out branch (use final workspace path)
          if (finalWorkspacePath) {
            const updatedInfo = await window.gitAPI?.getInfo(finalWorkspacePath);
            if (updatedInfo) {
              setGitInfo(updatedInfo);
            }
          }
        } catch (error) {
          console.error('[NewAgentModal] Error checking out branch:', error);
          const errorMessage = (error as Error).message.toLowerCase();
          if (errorMessage.includes('uncommitted') || errorMessage.includes('changes')) {
            setShowBranchSwitchWarning(true);
            return;
          }
          alert(`Error checking out branch: ${(error as Error).message}`);
          return;
        }
      }
    }

    // Validate git info is available (required for agent creation)
    if (!gitInfo) {
      alert('Please select a git repository. Agent creation requires a git-initialized directory.');
      return;
    }

    if (!finalWorkspacePath) {
      alert('Please select a workspace folder.');
      return;
    }

    // Fork mode: call onForkConfirm instead of onCreate
    if (isForkMode && onForkConfirm) {
      // Compute full sibling worktree path from workspace path
      const parentDir = finalWorkspacePath.split('/').slice(0, -1).join('/');
      const dirName = description.trim()
        ? `agent-${description.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`
        : `agent-fork-${Date.now()}`;
      const fullWorktreePath = `${parentDir}/${dirName}`;

      onForkConfirm({
        title: description.trim(),
        workspacePath: finalWorkspacePath,
        gitInfo,
        createWorktree: shouldCreateWorktreeForFork,
        branchName: gitInfo.branch,
        worktreePath: shouldCreateWorktreeForFork ? fullWorktreePath : undefined,
      });
      onClose();
      return;
    }

    // Regular mode: call onCreate
    onCreate({
      title: description.trim() || 'New Agent',
      description: description.trim(),
      workspacePath: finalWorkspacePath,
      gitInfo,
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
            {/* Fork mode title */}
            {isForkMode && (
              <span className="new-agent-modal-title">Fork Agent Session</span>
            )}
            {/* Show original folder only if no worktree is active */}
            {!worktreeInfo && (
              <div 
                className={`new-agent-modal-folder-wrapper ${keyboardFocus === 'folder' ? 'keyboard-selected' : ''}`}
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
                className={`new-agent-modal-branch-wrapper ${keyboardFocus === 'branch' ? 'keyboard-selected' : ''}`}
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
                    {workspacePath && gitInfo?.branch && (
                      <>
                        <div
                          className={`new-agent-modal-branch-dropdown-item ${
                            dropdownItemIndex === 0 ? 'keyboard-selected' : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsBranchDropdownOpen(false);
                            setIsCreatingNewBranch(true);
                          }}
                        >
                          New branch <span className="new-agent-modal-command-hint">⌘E</span>
                        </div>
                        <div
                          className={`new-agent-modal-branch-dropdown-item ${
                            dropdownItemIndex === 1 ? 'keyboard-selected' : ''
                          }`}
                          onClick={() => {
                            // TODO: Implement new branch from existing branch
                            setIsBranchDropdownOpen(false);
                          }}
                        >
                          New branch from
                        </div>
                        <div className="new-agent-modal-branch-dropdown-divider" />
                        <div
                          className={`new-agent-modal-branch-dropdown-item ${
                            dropdownItemIndex === 2 ? 'keyboard-selected' : ''
                          }`}
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
                      </>
                    )}
                    {isLoadingBranches ? (
                      <div className="new-agent-modal-branch-dropdown-item">Loading...</div>
                    ) : availableBranches.length === 0 ? (
                      <div className="new-agent-modal-branch-dropdown-item">No branches found</div>
                    ) : (
                      availableBranches.map((branch, index) => {
                        // Calculate the actual index in dropdownItems (after action items)
                        const actionItemsCount = workspacePath && gitInfo?.branch ? 3 : 0; // New branch, New branch from, New worktree
                        const itemIndex = actionItemsCount + index;
                        return (
                          <div
                            key={branch}
                            className={`new-agent-modal-branch-dropdown-item ${
                              selectedBranchIndex === index ? 'selected' : ''
                            } ${
                              dropdownItemIndex === itemIndex ? 'keyboard-selected' : ''
                            }`}
                            onClick={() => {
                              // Set the selected branch index to trigger checkout on create
                              setSelectedBranchIndex(index);
                              setIsBranchDropdownOpen(false);
                            }}
                          >
                            {branch}
                          </div>
                        );
                      })
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
          {/* Fork mode: Fork name input with inline worktree checkbox */}
          {isForkMode && (
            <div className="new-agent-modal-fork-input-row">
              <textarea
                ref={descriptionInputRef}
                className="new-agent-modal-description-input new-agent-modal-fork-input"
                placeholder="Fork name..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (keyboardFocus === 'input') {
                    if (e.key === 'Enter' && e.shiftKey) {
                      return;
                    }
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleCreate();
                      return;
                    }
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleCreate();
                      return;
                    }
                  }
                }}
                rows={1}
              />
              <label className="new-agent-modal-checkbox-label new-agent-modal-fork-worktree-checkbox">
                <input
                  type="checkbox"
                  className="new-agent-modal-checkbox"
                  checked={shouldCreateWorktreeForFork}
                  onChange={(e) => setShouldCreateWorktreeForFork(e.target.checked)}
                />
                <span className="new-agent-modal-checkbox-text">Worktree</span>
              </label>
            </div>
          )}
          {/* Regular mode: standard textarea */}
          {!isForkMode && (
            <textarea
              ref={descriptionInputRef}
              className="new-agent-modal-description-input"
              placeholder="Create a new agent"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (keyboardFocus === 'input') {
                  if (e.key === 'Enter' && e.shiftKey) {
                    return;
                  }
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCreate();
                    return;
                  }
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleCreate();
                    return;
                  }
                }
              }}
              rows={6}
            />
          )}
          {/* Fork mode: Show full worktree path when worktree checkbox is checked */}
          {isForkMode && shouldCreateWorktreeForFork && workspacePath && (
            <div className="new-agent-modal-fork-worktree-path">
              <span className="new-agent-modal-fork-worktree-label">Create Agent in:</span>
              <span className="new-agent-modal-fork-worktree-value">
                {(() => {
                  // Compute sibling path: parent directory of workspace + directory name
                  const parentDir = workspacePath.split('/').slice(0, -1).join('/');
                  const dirName = description.trim()
                    ? `agent-${description.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`
                    : 'agent-fork';
                  return `${parentDir}/${dirName}`;
                })()}
              </span>
            </div>
          )}

          {/* Fork mode: Message preview section */}
          {isForkMode && onLoadMessages && (
            <div className="new-agent-modal-preview-section">
              <button
                type="button"
                className="new-agent-modal-preview-toggle"
                onClick={() => {
                  if (!isPreviewExpanded && !forkMessages) {
                    onLoadMessages();
                  }
                  setIsPreviewExpanded(!isPreviewExpanded);
                }}
              >
                {isPreviewExpanded ? '▼' : '▶'} Preview Context
              </button>

              {isPreviewExpanded && (
                <div className="new-agent-modal-preview-content">
                  {forkMessages && onCutoffChange ? (
                    <MessagePreviewPanel
                      messages={forkMessages}
                      cutoffMessageId={cutoffMessageId ?? null}
                      originalTargetMessageId={forkData?.originalTargetMessageId}
                      onCutoffChange={onCutoffChange}
                      isLoading={isLoadingMessages}
                    />
                  ) : isLoadingMessages ? (
                    <div className="new-agent-modal-preview-loading">Loading messages...</div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Bar */}
        <div className={`new-agent-modal-footer ${isForkMode ? 'fork-mode-footer' : ''}`}>
          {/* Fork mode: Show parent session info on the left */}
          {isForkMode && forkData && (
            <div className="new-agent-modal-session-info">
              <span className="new-agent-modal-session-id">
                from: {forkData.parentSessionId}
              </span>
            </div>
          )}
          <button
            className="new-agent-modal-create-btn"
            onClick={handleCreate}
            disabled={
              (isForkMode && !description.trim()) ||
              (isCreatingNewBranch && !newBranchName.trim()) ||
              isCreatingBranch ||
              isCreatingWorktree ||
              isLoadingGit ||
              !gitInfo
            }
            title={!gitInfo && !isLoadingGit ? 'Please select a git repository' : undefined}
          >
            {isCreatingBranch ? 'Creating branch...' :
             isCreatingWorktree ? 'Creating worktree...' :
             isLoadingGit ? 'Checking git...' :
             !gitInfo ? 'Git required' :
             isForkMode ? 'Create fork' :
             'Start agent'}
          </button>
        </div>
      </div>
      <BranchSwitchWarningDialog
        isOpen={showBranchSwitchWarning}
        onCancel={() => setShowBranchSwitchWarning(false)}
      />
    </div>
  );
}

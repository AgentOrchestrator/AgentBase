import { useState, useEffect } from 'react';
import type { TerminalAttachment } from '../types/attachments';
import { isWorkspaceMetadataAttachment } from '../types/attachments';
import { useWorkspaceInheritance } from './useWorkspaceInheritance';
import type { GitInfo } from '../../main/preload';

// Import global type declarations
import '../global.d.ts';

export type WorkspaceSource = 'attachment' | 'inherited' | 'manual' | null;

export interface WorkspaceDisplayResult {
  /** The resolved workspace path */
  workspacePath: string | null;
  /** How the workspace was obtained */
  source: WorkspaceSource;
  /** Live git info for the workspace */
  gitInfo: GitInfo | null;
  /** Whether git info is loading */
  isLoadingGit: boolean;
  /** Whether currently provisioning worktree */
  isProvisioning: boolean;
}

export function useWorkspaceDisplay(
  nodeId: string,
  attachments: TerminalAttachment[],
  manualWorkspacePath?: string | null
): WorkspaceDisplayResult {
  const { inheritedWorkspacePath, isProvisioning } = useWorkspaceInheritance(nodeId);
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null);
  const [isLoadingGit, setIsLoadingGit] = useState(false);

  // Priority: direct attachment > manual > inherited
  const attachmentWorkspace = attachments.find(isWorkspaceMetadataAttachment);

  let workspacePath: string | null = null;
  let source: WorkspaceSource = null;

  if (attachmentWorkspace) {
    workspacePath = attachmentWorkspace.path;
    source = 'attachment';
  } else if (manualWorkspacePath) {
    workspacePath = manualWorkspacePath;
    source = 'manual';
  } else if (inheritedWorkspacePath) {
    workspacePath = inheritedWorkspacePath;
    source = 'inherited';
  }

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
        setGitInfo(null);
        setIsLoadingGit(false);
      });
  }, [workspacePath]);

  return {
    workspacePath,
    source,
    gitInfo,
    isLoadingGit,
    isProvisioning,
  };
}

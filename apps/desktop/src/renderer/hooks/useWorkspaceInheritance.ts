import { useState, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { WorktreeInfo } from '../../main/types/worktree';

export interface WorkspaceInheritanceResult {
  /** The workspace path to use (from worktree if inherited) */
  inheritedWorkspacePath: string | null;
  /** Worktree info if one was provisioned */
  worktree: WorktreeInfo | null;
  /** The parent workspace node ID if inheriting */
  parentWorkspaceNodeId: string | null;
  /** Whether currently provisioning worktree */
  isProvisioning: boolean;
}

export function useWorkspaceInheritance(nodeId: string): WorkspaceInheritanceResult {
  const { getNodes, getEdges } = useReactFlow();
  const [worktree, setWorktree] = useState<WorktreeInfo | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);

  // Ref to track current worktree for cleanup (avoids stale closure issues)
  const worktreeRef = useRef<WorktreeInfo | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    worktreeRef.current = worktree;
  }, [worktree]);

  // Find parent workspace node from incoming edges
  const edges = getEdges();
  const nodes = getNodes();

  const incomingEdge = edges.find((e) => e.target === nodeId);
  const parentNode = incomingEdge ? nodes.find((n) => n.id === incomingEdge.source) : null;

  // Check if parent is a workspace node
  const parentWorkspaceNode = parentNode?.type === 'workspace' ? parentNode : null;
  const parentWorkspacePath = parentWorkspaceNode?.data?.path as string | undefined;

  // Provision worktree when parent workspace is detected
  useEffect(() => {
    if (parentWorkspacePath && !worktree && !isProvisioning) {
      setIsProvisioning(true);
      const branchName = `agent-${nodeId}`;

      window.worktreeAPI?.provision(parentWorkspacePath, branchName, { agentId: nodeId })
        .then((wt) => {
          setWorktree(wt);
          setIsProvisioning(false);
        })
        .catch((err) => {
          console.error('[useWorkspaceInheritance] Failed to provision worktree:', err);
          setIsProvisioning(false);
        });
    }
  }, [parentWorkspacePath, nodeId, worktree, isProvisioning]);

  // Cleanup worktree on unmount (separate effect to avoid stale closure)
  useEffect(() => {
    return () => {
      if (worktreeRef.current) {
        window.worktreeAPI?.release(worktreeRef.current.id).catch((err) => {
          console.error('[useWorkspaceInheritance] Failed to release worktree:', err);
        });
      }
    };
  }, []);

  return {
    inheritedWorkspacePath: worktree?.worktreePath || null,
    worktree,
    parentWorkspaceNodeId: parentWorkspaceNode?.id || null,
    isProvisioning,
  };
}

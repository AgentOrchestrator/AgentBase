/**
 * useAgentState Hook
 *
 * THE SINGLE SOURCE OF TRUTH for agent state.
 *
 * Consolidates:
 * - useSessionId (session matching via polling)
 * - useWorkspaceInheritance (worktree provisioning)
 * - useWorkspaceDisplay (workspace path resolution + git info)
 * - Store subscriptions
 * - Node data management
 *
 * Usage:
 *   const agent = useAgentState({ nodeId, initialNodeData });
 *   agent.workspace.path    // workspace path
 *   agent.session.id        // matched session ID
 *   agent.actions.setWorkspace(path)  // set workspace
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { WorktreeInfo } from '../../../main/types/worktree';
import type { GitInfo } from '@agent-orchestrator/shared';
import type { AgentNodeData } from '../../types/agent-node';
import { createWorkspaceMetadataAttachment, isWorkspaceMetadataAttachment } from '../../types/attachments';
import { agentStore } from '../../stores';
import type {
  AgentState,
  UseAgentStateInput,
  WorkspaceSource,
  SessionSummary,
} from './types';

// =============================================================================
// Helper Functions (from useSessionId)
// =============================================================================

function normalizePath(path: string): string {
  return path.replace(/\/$/, '').toLowerCase();
}

function pathsMatch(path1?: string, path2?: string): boolean {
  if (!path1 || !path2) return false;
  return normalizePath(path1) === normalizePath(path2);
}

function findMatchingSession(
  sessions: SessionSummary[],
  agentCreatedAt: number,
  workspacePath?: string
): SessionSummary | null {
  if (sessions.length === 0) return null;

  // Filter by workspace path if provided
  let candidateSessions = sessions;
  if (workspacePath) {
    candidateSessions = sessions.filter((session) =>
      pathsMatch(session.projectPath, workspacePath)
    );
  }

  // If no workspace-filtered matches, use all sessions (fallback)
  if (candidateSessions.length === 0) {
    candidateSessions = sessions;
  }

  // Find session with closest timestamp to agent creation
  const TIME_WINDOW_MS = 60 * 1000; // 60 seconds window
  let bestMatch: SessionSummary | null = null;
  let minTimeDiff = Infinity;

  for (const session of candidateSessions) {
    const sessionTime = new Date(session.updatedAt).getTime();
    const timeDiff = Math.abs(sessionTime - agentCreatedAt);

    if (timeDiff <= TIME_WINDOW_MS && timeDiff < minTimeDiff) {
      bestMatch = session;
      minTimeDiff = timeDiff;
    }
  }

  // Fallback to most recent session if no close match
  if (!bestMatch && candidateSessions.length > 0) {
    const sorted = [...candidateSessions].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    bestMatch = sorted[0];
  }

  return bestMatch;
}

// =============================================================================
// Main Hook
// =============================================================================

export function useAgentState({ nodeId, initialNodeData, attachments = [] }: UseAgentStateInput): AgentState {
  const { getNodes, getEdges } = useReactFlow();

  // ---------------------------------------------------------------------------
  // Core State
  // ---------------------------------------------------------------------------
  const [nodeData, setNodeData] = useState<AgentNodeData>(initialNodeData);
  const [isInitialized, setIsInitialized] = useState(false);

  // ---------------------------------------------------------------------------
  // Workspace State
  // ---------------------------------------------------------------------------
  const [manualWorkspacePath, setManualWorkspacePath] = useState<string | null>(null);
  const [worktree, setWorktree] = useState<WorktreeInfo | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null);
  const [isLoadingGit, setIsLoadingGit] = useState(false);

  // ---------------------------------------------------------------------------
  // Session State
  // ---------------------------------------------------------------------------
  const [sessionId, setSessionId] = useState<string | null>(nodeData.sessionId || null);
  const [isMatchingSession, setIsMatchingSession] = useState(false);

  // ---------------------------------------------------------------------------
  // Refs for cleanup
  // ---------------------------------------------------------------------------
  const worktreeRef = useRef<WorktreeInfo | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const matchedSessionIdRef = useRef<string | null>(sessionId);

  // Keep refs in sync
  useEffect(() => {
    worktreeRef.current = worktree;
  }, [worktree]);

  useEffect(() => {
    matchedSessionIdRef.current = sessionId;
  }, [sessionId]);

  // ---------------------------------------------------------------------------
  // Config (immutable)
  // ---------------------------------------------------------------------------
  const config = useMemo(
    () => ({
      nodeId,
      agentId: nodeData.agentId,
      terminalId: nodeData.terminalId,
      agentType: nodeData.agentType,
      createdAt: nodeData.createdAt,
      initialPrompt: nodeData.initialPrompt,
    }),
    [nodeId, nodeData.agentId, nodeData.terminalId, nodeData.agentType, nodeData.createdAt, nodeData.initialPrompt]
  );

  // ---------------------------------------------------------------------------
  // Workspace Path Resolution
  // ---------------------------------------------------------------------------

  // Find parent workspace node (for inheritance)
  const edges = getEdges();
  const nodes = getNodes();
  const incomingEdge = edges.find((e) => e.target === nodeId);
  const parentNode = incomingEdge ? nodes.find((n) => n.id === incomingEdge.source) : null;
  const parentWorkspaceNode = parentNode?.type === 'workspace' ? parentNode : null;
  const parentWorkspacePath = parentWorkspaceNode?.data?.path as string | undefined;

  // Get workspace from attachment
  const currentAttachments = nodeData.attachments || attachments;
  const attachmentWorkspace = currentAttachments.find(isWorkspaceMetadataAttachment);
  const attachmentWorkspacePath = attachmentWorkspace?.path || null;

  // Resolve final workspace path and source
  let workspacePath: string | null = null;
  let workspaceSource: WorkspaceSource = null;

  if (attachmentWorkspacePath) {
    workspacePath = attachmentWorkspacePath;
    workspaceSource = 'attachment';
  } else if (manualWorkspacePath) {
    workspacePath = manualWorkspacePath;
    workspaceSource = 'manual';
  } else if (worktree?.worktreePath) {
    workspacePath = worktree.worktreePath;
    workspaceSource = 'inherited';
  }

  // ---------------------------------------------------------------------------
  // Store Subscription
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const storeData = agentStore.getAgent(nodeData.agentId);
    if (storeData) {
      setNodeData((prev) => ({
        ...prev,
        ...storeData,
        sessionId: storeData.sessionId ?? prev.sessionId,
        chatMessages: storeData.chatMessages ?? prev.chatMessages,
        attachments: storeData.attachments ?? prev.attachments,
        createdAt: storeData.createdAt ?? prev.createdAt,
        initialPrompt: storeData.initialPrompt ?? prev.initialPrompt,
      }));
    }

    const unsubscribe = agentStore.subscribe(nodeData.agentId, (updatedAgent) => {
      setNodeData((prev) => ({
        ...prev,
        ...updatedAgent,
        sessionId: updatedAgent.sessionId ?? prev.sessionId,
        chatMessages: updatedAgent.chatMessages ?? prev.chatMessages,
        attachments: updatedAgent.attachments ?? prev.attachments,
        createdAt: updatedAgent.createdAt ?? prev.createdAt,
        initialPrompt: updatedAgent.initialPrompt ?? prev.initialPrompt,
      }));
    });

    return unsubscribe;
  }, [nodeData.agentId]);

  // ---------------------------------------------------------------------------
  // Worktree Provisioning (from parent workspace)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (parentWorkspacePath && !worktree && !isProvisioning && !attachmentWorkspacePath) {
      setIsProvisioning(true);
      const branchName = `agent-${nodeId}`;

      window.worktreeAPI
        ?.provision(parentWorkspacePath, branchName, { agentId: nodeId })
        .then((wt) => {
          setWorktree(wt);
          setIsProvisioning(false);
        })
        .catch((err) => {
          console.error('[useAgentState] Failed to provision worktree:', err);
          setIsProvisioning(false);
        });
    }
  }, [parentWorkspacePath, nodeId, worktree, isProvisioning, attachmentWorkspacePath]);

  // Cleanup worktree on unmount
  useEffect(() => {
    return () => {
      if (worktreeRef.current) {
        window.worktreeAPI?.release(worktreeRef.current.id).catch((err) => {
          console.error('[useAgentState] Failed to release worktree:', err);
        });
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Git Info Fetching
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!workspacePath) {
      setGitInfo(null);
      return;
    }

    setIsLoadingGit(true);
    window.gitAPI
      ?.getInfo(workspacePath)
      .then((info) => {
        setGitInfo(info);
        setIsLoadingGit(false);
      })
      .catch(() => {
        setGitInfo(null);
        setIsLoadingGit(false);
      });
  }, [workspacePath]);

  // ---------------------------------------------------------------------------
  // Session Matching (polling)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const { createdAt } = nodeData;

    // Don't run if no workspace, no createdAt, or already matched
    if (!workspacePath || !createdAt || matchedSessionIdRef.current) {
      return;
    }

    setIsMatchingSession(true);

    const startPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      const maxAttempts = 30;
      let attempts = 0;

      pollingIntervalRef.current = setInterval(async () => {
        attempts++;

        if (attempts > maxAttempts || matchedSessionIdRef.current) {
          setIsMatchingSession(false);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          return;
        }

        try {
          const codingAgentAPI = (window as any).codingAgentAPI;
          if (!codingAgentAPI) return;

          const sinceTimestamp = createdAt - 30000;
          const sessions = await codingAgentAPI.listSessionSummaries('claude_code', {
            lookbackDays: 1,
            sinceTimestamp,
          });

          const match = findMatchingSession(sessions, createdAt, workspacePath);

          if (match) {
            matchedSessionIdRef.current = match.id;
            setSessionId(match.id);
            setIsMatchingSession(false);

            // Update node data with session ID
            dispatchNodeUpdate({ ...nodeData, sessionId: match.id });

            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
          }
        } catch (error) {
          console.error('[useAgentState] Error fetching sessions:', error);
        }
      }, 2000);
    };

    // Start polling after initial delay
    const timeoutId = setTimeout(startPolling, 2000);

    return () => {
      clearTimeout(timeoutId);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [workspacePath, nodeData.createdAt]);

  // Reset session matching when agentId changes
  useEffect(() => {
    matchedSessionIdRef.current = null;
    setSessionId(null);
  }, [nodeData.agentId]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const dispatchNodeUpdate = useCallback(
    (updatedData: AgentNodeData) => {
      setNodeData(updatedData);
      window.dispatchEvent(
        new CustomEvent('update-node', {
          detail: { nodeId, data: updatedData },
        })
      );
    },
    [nodeId]
  );

  const setWorkspace = useCallback(
    (path: string) => {
      setManualWorkspacePath(path);

      const newAttachment = createWorkspaceMetadataAttachment({
        path,
        name: path.split('/').pop() || 'Workspace',
      });

      const updatedData = {
        ...nodeData,
        attachments: [...(nodeData.attachments || []), newAttachment],
      };

      dispatchNodeUpdate(updatedData);
    },
    [nodeData, dispatchNodeUpdate]
  );

  const updateNodeData = useCallback(
    (updates: Partial<AgentNodeData>) => {
      dispatchNodeUpdate({ ...nodeData, ...updates });
    },
    [nodeData, dispatchNodeUpdate]
  );

  const deleteNode = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent('delete-node', {
        detail: { nodeId },
      })
    );
  }, [nodeId]);

  // ---------------------------------------------------------------------------
  // Coding Agent API
  // ---------------------------------------------------------------------------
  const codingAgent = useMemo(
    () => ({
      listSessions: async (filter?: { lookbackDays?: number; sinceTimestamp?: number }) => {
        const api = (window as any).codingAgentAPI;
        if (!api) return [];
        return api.listSessionSummaries(nodeData.agentType, filter);
      },
      getSession: async (sid: string, filter?: { messageTypes?: string[] }) => {
        const api = (window as any).codingAgentAPI;
        if (!api) return null;
        return api.getSession(nodeData.agentType, sid, filter);
      },
    }),
    [nodeData.agentType]
  );

  // ---------------------------------------------------------------------------
  // Mark as initialized once workspace is resolved
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (workspacePath && !isInitialized) {
      setIsInitialized(true);
    }
  }, [workspacePath, isInitialized]);

  // ---------------------------------------------------------------------------
  // Return Complete State
  // ---------------------------------------------------------------------------
  return {
    config,
    status: nodeData.status,
    isInitialized,
    workspace: {
      path: workspacePath,
      source: workspaceSource,
      worktree,
      gitInfo,
      isLoadingGit,
      isProvisioning,
    },
    session: {
      id: sessionId,
      isMatching: isMatchingSession,
    },
    nodeData,
    actions: {
      setWorkspace,
      updateNodeData,
      deleteNode,
    },
    codingAgent,
  };
}

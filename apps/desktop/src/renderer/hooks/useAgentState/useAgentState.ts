/**
 * useAgentState Hook
 *
 * THE SINGLE SOURCE OF TRUTH for agent state.
 *
 * Consolidates:
 * - Session state (explicit session IDs)
 * - useWorkspaceDisplay (workspace path resolution + git info)
 * - Store subscriptions
 * - Node data management
 *
 * Usage:
 *   const agent = useAgentState({ nodeId, initialNodeData });
 *   agent.workspace.path    // workspace path
 *   agent.session.id        // explicit session ID
 *   agent.actions.setWorkspace(path)  // set workspace
 */

import type { GitInfo } from '@agent-orchestrator/shared';
import { useReactFlow } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNodeActionsOptional } from '../../features/canvas/context';
import { agentActionStore } from '../../stores';
import type { AgentNodeData } from '../../types/agent-node';
import { formatRelativeTime } from '../../utils/formatRelativeTime';
import type { AgentState, SessionReadiness, UseAgentStateInput, WorkspaceSource } from './types';

// =============================================================================
// Deterministic Session ID - Commented out for future use
// =============================================================================

// function cyrb128(input: string): [number, number, number, number] {
//   let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
//   for (let i = 0; i < input.length; i++) {
//     const k = input.charCodeAt(i);
//     h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
//     h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
//     h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
//     h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
//   }
//   h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
//   h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
//   h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
//   h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
//   return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
// }

// Commented out - kept for potential future use in deterministic UUID generation
// function deterministicUuidFromString(input: string): string {
//   const hash = cyrb128(input);
//   const bytes = new Uint8Array(16);
//   for (let i = 0; i < 4; i++) {
//     const value = hash[i];
//     const offset = i * 4;
//     bytes[offset] = (value >>> 24) & 0xff;
//     bytes[offset + 1] = (value >>> 16) & 0xff;
//     bytes[offset + 2] = (value >>> 8) & 0xff;
//     bytes[offset + 3] = value & 0xff;
//   }
//   bytes[6] = (bytes[6] & 0x0f) | 0x40;
//   bytes[8] = (bytes[8] & 0x3f) | 0x80;
//   const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
//   return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
//     .slice(6, 8)
//     .join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
// }

// =============================================================================
// Main Hook
// =============================================================================

export function useAgentState({ nodeId, initialNodeData }: UseAgentStateInput): AgentState {
  // const { getNodes, getEdges } = useReactFlow(); // Commented - will be used when workspace inheritance is re-enabled
  useReactFlow(); // Keep hook call for potential future use

  // Node actions context for direct updates (replaces event-based pattern)
  const nodeActions = useNodeActionsOptional();

  // ---------------------------------------------------------------------------
  // Core State
  // ---------------------------------------------------------------------------
  const [nodeData, setNodeData] = useState<AgentNodeData>(initialNodeData);
  const [isInitialized, setIsInitialized] = useState(false);

  // Track if we've logged initialization (only log once per mount)
  const hasLoggedInit = useRef(false);
  useEffect(() => {
    if (!hasLoggedInit.current) {
      console.log('[useAgentState] Initialized for node', initialNodeData);
      hasLoggedInit.current = true;
    }
  }, [initialNodeData]);

  // Sync external node updates (e.g., from Canvas update-node events)
  useEffect(() => {
    setNodeData((prev) => ({
      ...prev,
      ...initialNodeData,
      // Preserve session-related fields if they exist in prev but not in initialNodeData
      sessionId: initialNodeData.sessionId ?? prev.sessionId,
      parentSessionId: initialNodeData.parentSessionId ?? prev.parentSessionId,
      worktreeId: initialNodeData.worktreeId ?? prev.worktreeId,
      // Preserve workspace path if it exists
      workspacePath: initialNodeData.workspacePath ?? prev.workspacePath,
      // Preserve other optional fields
      attachments: initialNodeData.attachments ?? prev.attachments,
      createdAt: initialNodeData.createdAt ?? prev.createdAt,
      initialPrompt: initialNodeData.initialPrompt ?? prev.initialPrompt,
    }));
  }, [initialNodeData]);

  // ---------------------------------------------------------------------------
  // Workspace State
  // ---------------------------------------------------------------------------
  const [manualWorkspacePath, setManualWorkspacePath] = useState<string | null>(null);
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(nodeData.gitInfo);
  const [isLoadingGit, setIsLoadingGit] = useState(false);

  // ---------------------------------------------------------------------------
  // Session State
  // ---------------------------------------------------------------------------
  const [sessionId, setSessionId] = useState<string | null>(nodeData.sessionId || null);
  const [sessionCreatedAt, setSessionCreatedAt] = useState<string | null>(null);
  const sessionReadiness: SessionReadiness = sessionId ? 'ready' : 'idle';

  useEffect(() => {
    const nextSessionId = nodeData.sessionId ?? null;
    if (nextSessionId !== sessionId) {
      setSessionId(nextSessionId);
      // Reset creation time when session changes
      setSessionCreatedAt(null);
    }
  }, [nodeData.sessionId, sessionId]);

  // Clear actions when agent/session changes
  useEffect(() => {
    agentActionStore.clearAgent(nodeData.agentId);
  }, [nodeData.agentId]);

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
    [
      nodeId,
      nodeData.agentId,
      nodeData.terminalId,
      nodeData.agentType,
      nodeData.createdAt,
      nodeData.initialPrompt,
    ]
  );

  // ---------------------------------------------------------------------------
  // Workspace Path Resolution
  // ---------------------------------------------------------------------------

  // Find parent node (for potential inheritance - workspace nodes no longer used)
  // Commented out - kept for potential future use when workspace inheritance is re-enabled
  // const edges = getEdges();
  // const nodes = getNodes();
  // const incomingEdge = edges.find((e) => e.target === nodeId);
  // const parentNode = incomingEdge ? nodes.find((n) => n.id === incomingEdge.source) : null;

  // Resolve final workspace path and source
  // Priority: node data > manual
  let workspacePath: string | null = null;
  let workspaceSource: WorkspaceSource = null;

  if (nodeData.workspacePath) {
    workspacePath = nodeData.workspacePath;
    workspaceSource = 'manual';
  } else if (manualWorkspacePath) {
    workspacePath = manualWorkspacePath;
    workspaceSource = 'manual';
  }

  // ---------------------------------------------------------------------------
  // Session Creation Time Fetching
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Skip if we don't have both sessionId and workspacePath
    if (!sessionId || !workspacePath) {
      return;
    }

    // Avoid re-fetching if we already have the creation time
    if (sessionCreatedAt) {
      return;
    }

    const fetchSessionCreatedAt = async () => {
      try {
        const codingAgentAPI = window.codingAgentAPI;
        if (!codingAgentAPI) {
          return;
        }

        const session = await codingAgentAPI.getSession(nodeData.agentType, sessionId, {
          workspacePath,
        });

        if (session?.createdAt) {
          setSessionCreatedAt(session.createdAt);
        }
      } catch (error) {
        console.error('[useAgentState] Failed to fetch session creation time:', error);
      }
    };

    fetchSessionCreatedAt();
  }, [sessionId, workspacePath, nodeData.agentType, sessionCreatedAt]);

  // Compute the "time ago" string - recalculated on each render for accuracy
  const sessionCreatedAgo = useMemo(() => {
    if (!sessionCreatedAt) return null;
    return formatRelativeTime(sessionCreatedAt);
  }, [sessionCreatedAt]);

  // ---------------------------------------------------------------------------
  // Store Subscription
  // ---------------------------------------------------------------------------
  // COMMENTED OUT FOR DEBUGGING - Store subscription
  // useEffect(() => {
  //   // Debug: Log store subscription to detect shared agentId issues
  //   console.log('[useAgentState] Subscribing to store', {
  //     nodeId,
  //     agentId: nodeData.agentId,
  //     currentTitle: nodeData.title?.value,
  //   });

  //   const storeData = agentStore.getAgent(nodeData.agentId);
  //   if (storeData) {
  //     console.log('[useAgentState] Found store data, applying to node', {
  //       nodeId,
  //       agentId: nodeData.agentId,
  //       storeTitle: storeData.title?.value,
  //     });
  //     setNodeData((prev) => ({
  //       ...prev,
  //       ...storeData,
  //       sessionId: storeData.sessionId ?? prev.sessionId,
  //       parentSessionId: storeData.parentSessionId ?? prev.parentSessionId,
  //       worktreeId: storeData.worktreeId ?? prev.worktreeId,
  //       workingDirectory: storeData.workingDirectory ?? prev.workingDirectory,
  //       chatMessages: storeData.chatMessages ?? prev.chatMessages,
  //       attachments: storeData.attachments ?? prev.attachments,
  //       createdAt: storeData.createdAt ?? prev.createdAt,
  //       initialPrompt: storeData.initialPrompt ?? prev.initialPrompt,
  //     }));
  //   }

  //   const unsubscribe = agentStore.subscribe(nodeData.agentId, (updatedAgent) => {
  //     console.log('[useAgentState] Store update received', {
  //       nodeId,
  //       agentId: nodeData.agentId,
  //       updatedTitle: updatedAgent.title?.value,
  //     });
  //     setNodeData((prev) => ({
  //       ...prev,
  //       ...updatedAgent,
  //       sessionId: updatedAgent.sessionId ?? prev.sessionId,
  //       parentSessionId: updatedAgent.parentSessionId ?? prev.parentSessionId,
  //       worktreeId: updatedAgent.worktreeId ?? prev.worktreeId,
  //       workingDirectory: updatedAgent.workingDirectory ?? prev.workingDirectory,
  //       chatMessages: updatedAgent.chatMessages ?? prev.chatMessages,
  //       attachments: updatedAgent.attachments ?? prev.attachments,
  //       createdAt: updatedAgent.createdAt ?? prev.createdAt,
  //       initialPrompt: updatedAgent.initialPrompt ?? prev.initialPrompt,
  //     }));
  //   });

  //   return unsubscribe;
  // }, [nodeData.agentId, nodeId]);

  // ---------------------------------------------------------------------------
  // Git Info Fetching - sync to node data via context (not events)
  // ---------------------------------------------------------------------------
  const lastFetchedWorkspaceRef = useRef<string | null>(null);

  useEffect(() => {
    if (!workspacePath) {
      setGitInfo(null);
      lastFetchedWorkspaceRef.current = null;
      return;
    }

    // Skip if we've already fetched for this workspace path
    if (lastFetchedWorkspaceRef.current === workspacePath) {
      return;
    }

    lastFetchedWorkspaceRef.current = workspacePath;
    setIsLoadingGit(true);
    window.gitAPI
      ?.getInfo(workspacePath)
      .then((info) => {
        setGitInfo(info);
        setIsLoadingGit(false);
        // Sync git info to node data for persistence via context
        // IMPORTANT: Using context instead of events prevents infinite loops
        // Only update if nodeActions is available (within provider)
        if (nodeActions) {
          nodeActions.updateGitInfo(nodeId, info, workspacePath);
        }
      })
      .catch(() => {
        setGitInfo(null);
        setIsLoadingGit(false);
      });
    // NOTE: nodeActions excluded from deps - ref guards against re-fetching
  }, [workspacePath, nodeId]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const setWorkspace = useCallback(
    (path: string) => {
      setManualWorkspacePath(path);

      // Store workspace path directly in node data via context (not events)
      if (nodeActions) {
        nodeActions.updateWorkspacePath(nodeId, path);
      }
    },
    [nodeId, nodeActions]
  );

  const deleteNode = useCallback(() => {
    // Delete node via context (not events)
    if (nodeActions) {
      nodeActions.deleteNode(nodeId);
    }
  }, [nodeId, nodeActions]);

  // ---------------------------------------------------------------------------
  // Mark as initialized once workspace is resolved
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (workspacePath && !isInitialized) {
      setIsInitialized(true);
    }
  }, [workspacePath, isInitialized]);

  // Note: Permission event subscription is now handled globally by SharedEventDispatcher.
  // Events flow directly to agentActionStore without per-hook subscriptions.

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
      gitInfo,
      isLoadingGit,
    },
    session: {
      id: sessionId,
      readiness: sessionReadiness,
      createdAt: sessionCreatedAt,
      createdAgo: sessionCreatedAgo,
    },
    nodeData,
    actions: {
      setWorkspace,
      deleteNode,
    },
  };
}

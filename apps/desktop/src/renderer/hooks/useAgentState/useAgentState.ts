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

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import type {
  AgentAction,
  AgentEvent,
  ClarifyingQuestion,
  GitInfo,
  PermissionPayload,
} from '@agent-orchestrator/shared';
import type { AgentNodeData } from '../../types/agent-node';
import { agentActionStore } from '../../stores';
import type {
  AgentState,
  UseAgentStateInput,
  WorkspaceSource,
  SessionReadiness,
} from './types';

// =============================================================================
// Deterministic Session ID
// =============================================================================

function cyrb128(input: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;

  for (let i = 0; i < input.length; i++) {
    const k = input.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);

  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ];
}

function deterministicUuidFromString(input: string): string {
  const hash = cyrb128(input);
  const bytes = new Uint8Array(16);

  for (let i = 0; i < 4; i++) {
    const value = hash[i];
    const offset = i * 4;
    bytes[offset] = (value >>> 24) & 0xff;
    bytes[offset + 1] = (value >>> 16) & 0xff;
    bytes[offset + 2] = (value >>> 8) & 0xff;
    bytes[offset + 3] = value & 0xff;
  }

  // RFC 4122 variant + v4 marker for UUID shape
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
    .slice(6, 8)
    .join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

// =============================================================================
// Main Hook
// =============================================================================

export function useAgentState({ nodeId, initialNodeData }: UseAgentStateInput): AgentState {
  const { getNodes, getEdges } = useReactFlow();

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
  }, []);

  // COMMENTED OUT FOR DEBUGGING - Sync external node updates
  // useEffect(() => {
  //   setNodeData((prev) => ({
  //     ...prev,
  //     ...initialNodeData,
  //     sessionId: initialNodeData.sessionId ?? prev.sessionId,
  //     parentSessionId: initialNodeData.parentSessionId ?? prev.parentSessionId,
  //     worktreeId: initialNodeData.worktreeId ?? prev.worktreeId,
  //     workingDirectory: initialNodeData.workingDirectory ?? prev.workingDirectory,
  //     chatMessages: initialNodeData.chatMessages ?? prev.chatMessages,
  //     attachments: initialNodeData.attachments ?? prev.attachments,
  //     createdAt: initialNodeData.createdAt ?? prev.createdAt,
  //     initialPrompt: initialNodeData.initialPrompt ?? prev.initialPrompt,
  //   }));
  // }, [initialNodeData]);

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
  const sessionReadiness: SessionReadiness = sessionId ? 'ready' : 'idle';

  // ---------------------------------------------------------------------------
  // Hook-driven Action State
  // ---------------------------------------------------------------------------
  const actionIdsRef = useRef<Set<string>>(new Set());


  useEffect(() => {
    const nextSessionId = nodeData.sessionId ?? null;
    if (nextSessionId !== sessionId) {
      setSessionId(nextSessionId);
    }
  }, [nodeData.sessionId, sessionId]);

  useEffect(() => {
    actionIdsRef.current.clear();
    agentActionStore.clearAgent(nodeData.agentId);
  }, [nodeData.agentId, sessionId]);

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

  // Find parent node (for potential inheritance - workspace nodes no longer used)
  const edges = getEdges();
  const nodes = getNodes();
  const incomingEdge = edges.find((e) => e.target === nodeId);
  const parentNode = incomingEdge ? nodes.find((n) => n.id === incomingEdge.source) : null;
  // parentWorkspacePath is no longer used since workspace nodes were removed
  const _parentNode = parentNode; // Keep reference for potential future use

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
  // Git Info Fetching - sync to node data
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
        // Sync git info to node data for persistence
        window.dispatchEvent(
          new CustomEvent('update-node', {
            detail: { nodeId, data: { ...nodeData, gitInfo: info, workspacePath } },
          })
        );
      })
      .catch(() => {
        setGitInfo(null);
        setIsLoadingGit(false);
      });
  }, [workspacePath, nodeId]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const setWorkspace = useCallback(
    (path: string) => {
      setManualWorkspacePath(path);

      // Store workspace path directly in node data (single source of truth)
      const updatedData = {
        ...nodeData,
        workspacePath: path,
      };

      window.dispatchEvent(
        new CustomEvent('update-node', {
          detail: { nodeId, data: updatedData },
        })
      );
    },
    [nodeId, nodeData]
  );

  const deleteNode = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent('delete-node', {
        detail: { nodeId },
      })
    );
  }, [nodeId]);

  const toClarifyingQuestions = (toolInput: Record<string, unknown> | undefined): ClarifyingQuestion[] => {
    const questions = toolInput?.questions;
    if (!Array.isArray(questions)) {
      return [];
    }

    return questions
      .map((question) => {
        if (!question || typeof question !== 'object') {
          return null;
        }
        const item = question as {
          header?: string;
          question?: string;
          options?: Array<{ label?: string; description?: string }>;
          multiSelect?: boolean;
        };

        if (!item.question) {
          return null;
        }

        return {
          header: item.header,
          question: item.question,
          options: Array.isArray(item.options)
            ? item.options
                .filter((option) => option && typeof option.label === 'string')
                .map((option) => ({
                  label: String(option.label),
                  description: typeof option.description === 'string' ? option.description : undefined,
                }))
            : undefined,
          multiSelect: item.multiSelect,
        } as ClarifyingQuestion;
      })
      .filter((question): question is ClarifyingQuestion => Boolean(question));
  };

  const buildActionFromPermissionEvent = (
    event: AgentEvent<PermissionPayload>
  ): AgentAction | null => {
    const raw = event.raw as { toolInput?: Record<string, unknown>; toolUseId?: string } | undefined;
    const toolInput = raw?.toolInput;
    const toolName = event.payload.toolName;
    const resolvedAgentId = event.agentId ?? nodeData.agentId;

    if (toolName && toolName.toLowerCase() === 'askuserquestion') {
      const questions = toClarifyingQuestions(toolInput);
      return {
        id: event.id,
        type: 'clarifying_question',
        agentId: resolvedAgentId,
        agentType: event.agent,
        sessionId: event.sessionId,
        workspacePath: event.workspacePath,
        toolUseId: raw?.toolUseId,
        createdAt: event.timestamp,
        questions,
      };
    }

    return {
      id: event.id,
      type: 'tool_approval',
      agentId: resolvedAgentId,
      agentType: event.agent,
      sessionId: event.sessionId,
      workspacePath: event.workspacePath,
      toolUseId: raw?.toolUseId,
      createdAt: event.timestamp,
      toolName: toolName || 'Unknown tool',
      command: event.payload.command,
      filePath: event.payload.filePath,
      workingDirectory: event.payload.workingDirectory,
      reason: event.payload.reason,
      input: toolInput,
    };
  };

  // ---------------------------------------------------------------------------
  // Mark as initialized once workspace is resolved
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (workspacePath && !isInitialized) {
      setIsInitialized(true);
    }
  }, [workspacePath, isInitialized]);

  // ---------------------------------------------------------------------------
  // Hook Events (permission requests, questions)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!window.codingAgentAPI?.onAgentEvent) {
      return;
    }

    const unsubscribe = window.codingAgentAPI.onAgentEvent((event) => {
      const typedEvent = event as AgentEvent<PermissionPayload>;
      if (typedEvent.type !== 'permission:request') {
        return;
      }

      if (typedEvent.agentId && typedEvent.agentId !== nodeData.agentId) {
        return;
      }

      if (!typedEvent.agentId && typedEvent.sessionId && sessionId && typedEvent.sessionId !== sessionId) {
        return;
      }

      if (actionIdsRef.current.has(typedEvent.id)) {
        return;
      }

      const action = buildActionFromPermissionEvent(typedEvent);
      if (!action) {
        return;
      }

      actionIdsRef.current.add(typedEvent.id);
      agentActionStore.addAction(action);
    });

    return unsubscribe;
  }, [nodeData.agentId, sessionId]);

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
    },
    nodeData,
    actions: {
      setWorkspace,
      deleteNode,
    },
  };
}

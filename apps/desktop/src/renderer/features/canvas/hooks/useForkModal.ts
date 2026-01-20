/**
 * Fork Modal Hook
 *
 * Manages fork modal UI state and orchestrates fork operations.
 * Extracts fork modal logic from Canvas.tsx for better separation of concerns.
 */

import type { Edge, Node } from '@xyflow/react';
import { useCallback, useState } from 'react';
import { forkService } from '../../../services';
import { type AgentNodeData, createDefaultAgentTitle } from '../../../types/agent-node';
import { getOptimalHandles } from '../../../utils/edgeHandles';

// =============================================================================
// Types
// =============================================================================

/**
 * Message preview for context display in fork modal
 */
export interface MessagePreview {
  /** Unique message identifier */
  id: string;
  /** Message role (user, assistant, system) */
  role: 'user' | 'assistant' | 'system';
  /** Truncated message content for preview */
  preview: string;
  /** ISO timestamp of the message */
  timestamp: string;
}

/**
 * Data stored when fork modal is opened
 */
export interface ForkModalData {
  /** ID of the source node being forked */
  sourceNodeId: string;
  /** Position where the forked node should be placed */
  position: { x: number; y: number };
  /** Session ID for the fork operation */
  sessionId: string;
  /** Workspace path for the fork operation */
  workspacePath: string;
  /** Target message ID for filtering fork context (optional) */
  targetMessageId?: string;
  /** Original target message ID (from text selection, preserved for UI indicator) */
  originalTargetMessageId?: string;
  /** Agent type for API calls */
  agentType?: string;
  /**
   * Whether to create a new git worktree for the fork.
   * - true: Fork Handle Button behavior - creates isolated worktree
   * - false: Text Selection Fork behavior - stays in same workspace
   */
  createWorktree: boolean;
  /** Parent's current git branch (for default branch value) */
  parentBranch?: string;
  /** Selected text from the source node (to populate in new node's input) */
  selectedText?: string;
}

/**
 * Result of a successful fork confirmation
 */
export interface ForkConfirmResult {
  success: true;
  /** ID of the newly created node */
  newNodeId: string;
  /** The forked node data */
  forkedNode: Node;
  /** The edge connecting source to forked node */
  newEdge: Edge;
}

/**
 * Result of a failed fork confirmation
 */
export interface ForkConfirmError {
  success: false;
  error: string;
}

/**
 * Return type of useForkModal hook
 */
export interface UseForkModalReturn {
  // State
  /** Whether the modal is currently open */
  isOpen: boolean;
  /** Whether a fork operation is in progress */
  isLoading: boolean;
  /** Current error message, if any */
  error: string | null;
  /** Data for the current fork operation */
  modalData: ForkModalData | null;
  /** Messages available for preview (null = not loaded yet) */
  messages: MessagePreview[] | null;
  /** Whether messages are currently loading */
  isLoadingMessages: boolean;
  /** Currently selected cutoff message ID */
  cutoffMessageId: string | null;

  // Actions
  /**
   * Open the fork modal for a source node
   * @param sourceNodeId - ID of the node to fork
   * @param position - Position for the new forked node
   * @param targetMessageId - Optional message ID for filtering fork context
   * @param createWorktree - Whether to create a worktree (default: true)
   * @param selectedText - Optional selected text to populate in new node's input
   */
  open: (
    sourceNodeId: string,
    position: { x: number; y: number },
    targetMessageId?: string,
    createWorktree?: boolean,
    selectedText?: string
  ) => Promise<void>;
  /**
   * Confirm the fork operation with data from NewAgentModal
   * @param data - Fork confirmation data from the modal
   * @returns Result with new node/edge data or error
   */
  confirm: (data: {
    title: string;
    workspacePath: string;
    gitInfo: { branch?: string };
    createWorktree: boolean;
    branchName?: string;
    /** Directory name for worktree (deterministic, no timestamp) */
    worktreeDirectoryName?: string;
  }) => Promise<ForkConfirmResult | ForkConfirmError>;
  /** Cancel and close the modal */
  cancel: () => void;
  /** Clear the current error */
  clearError: () => void;
  /** Load messages for preview */
  loadMessages: () => Promise<void>;
  /** Update the cutoff message ID */
  setCutoffMessageId: (messageId: string) => void;
}

/**
 * Input parameters for useForkModal hook
 */
export interface UseForkModalInput {
  /** Current nodes in the canvas (for finding source node) */
  nodes: Node[];
  /** Callback to update a node (for session auto-detection) */
  onNodeUpdate?: (nodeId: string, data: Partial<AgentNodeData>) => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Truncate content for preview display
 */
function truncateContent(content: string, maxLength: number = 100): string {
  const trimmed = content.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 3)}...`;
}

/**
 * Hook for managing fork modal state and operations
 *
 * @example
 * ```tsx
 * const { isOpen, open, confirm, cancel, error } = useForkModal({ nodes });
 *
 * // Open modal when user initiates fork
 * await open(sourceNodeId, { x: 100, y: 200 });
 *
 * // On confirm, add the new node and edge
 * const result = await confirm('My Fork Title');
 * if (result.success) {
 *   setNodes(nds => [...nds, result.forkedNode]);
 *   setEdges(eds => [...eds, result.newEdge]);
 * }
 * ```
 */
export function useForkModal({ nodes, onNodeUpdate }: UseForkModalInput): UseForkModalReturn {
  // State
  const [modalData, setModalData] = useState<ForkModalData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessagePreview[] | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [cutoffMessageId, setCutoffMessageIdState] = useState<string | null>(null);

  // Derived state
  const isOpen = modalData !== null;

  /**
   * Open the fork modal for a source node
   */
  const open = useCallback(
    async (
      sourceNodeId: string,
      position: { x: number; y: number },
      targetMessageId?: string,
      createWorktree: boolean = true,
      selectedText?: string
    ) => {
      // Find the source node
      const sourceNode = nodes.find((n) => n.id === sourceNodeId);
      if (!sourceNode) {
        console.error('[useForkModal] Source node not found:', sourceNodeId);
        setError('Source node not found');
        setTimeout(() => setError(null), 5000);
        return;
      }

      const sourceData = sourceNode.data as unknown as AgentNodeData;

      // Get workspace path from node data (single source of truth)
      const workspacePath = sourceData.workspacePath;

      // Log the source data for debugging
      console.log('[useForkModal] Fork attempt - sourceData:', {
        agentId: sourceData.agentId,
        agentType: sourceData.agentType,
        sessionId: sourceData.sessionId,
        workspacePath,
        attachments: sourceData.attachments?.length ?? 0,
      });

      // Auto-detect session if not set
      let sessionId = sourceData.sessionId;
      if (!sessionId && workspacePath) {
        console.log('[useForkModal] Session not set, auto-detecting from workspace...');
        const latestSession = await forkService.getLatestSessionForWorkspace(
          sourceData.agentType,
          workspacePath
        );
        if (latestSession) {
          sessionId = latestSession.id;
          console.log('[useForkModal] Auto-detected session:', sessionId);

          // Update the node with the detected sessionId if callback provided
          if (onNodeUpdate) {
            onNodeUpdate(sourceNodeId, { sessionId });
          }
        }
      }

      // Validate requirements
      const validation = forkService.validateForkRequest(sessionId, workspacePath);
      if (!validation.valid) {
        console.warn('[useForkModal] Fork validation failed:', validation.error);
        setError(validation.error);
        setTimeout(() => setError(null), 5000);
        return;
      }

      if (!sessionId || !workspacePath) {
        setError('Missing session or workspace');
        setTimeout(() => setError(null), 5000);
        return;
      }

      // Get parent branch from gitInfo if available
      const parentBranch = sourceData.gitInfo?.branch;

      // Show fork modal with resolved session/workspace and optional message filter
      setModalData({
        sourceNodeId,
        position,
        sessionId,
        workspacePath,
        targetMessageId,
        originalTargetMessageId: targetMessageId,
        agentType: sourceData.agentType,
        createWorktree,
        parentBranch,
        selectedText,
      });
      // Initialize cutoff from targetMessageId (if provided from text selection)
      setCutoffMessageIdState(targetMessageId || null);
      // Reset messages when opening new modal
      setMessages(null);
      setError(null);
    },
    [nodes, onNodeUpdate]
  );

  /**
   * Confirm the fork operation
   */
  const confirm = useCallback(
    async (data: {
      title: string;
      workspacePath: string;
      gitInfo: { branch?: string };
      createWorktree: boolean;
      branchName?: string;
      worktreePath?: string;
    }): Promise<ForkConfirmResult | ForkConfirmError> => {
      const {
        title: forkTitle,
        workspacePath: customWorkspacePath,
        createWorktree,
        branchName,
        worktreePath,
      } = data;

      if (!modalData) {
        return { success: false, error: 'No fork operation in progress' };
      }

      const sourceNode = nodes.find((n) => n.id === modalData.sourceNodeId);
      if (!sourceNode) {
        setError('Source node not found');
        return { success: false, error: 'Source node not found' };
      }

      const sourceData = sourceNode.data as unknown as AgentNodeData;
      const sessionId = modalData.sessionId;
      const workspacePath = modalData.workspacePath;

      if (!sessionId || !workspacePath) {
        setError('Missing session or workspace');
        return { success: false, error: 'Missing session or workspace' };
      }

      // Use provided createWorktree from modal
      const shouldCreateWorktree = createWorktree;

      // Use custom workspace path if provided by user
      const effectiveRepoPath = customWorkspacePath || workspacePath;

      setIsLoading(true);
      setError(null);

      try {
        // Build filterOptions using cutoffMessageId (user's selected cutoff point)
        // Falls back to original targetMessageId if cutoff wasn't changed
        const effectiveCutoff = cutoffMessageId || modalData.targetMessageId;
        const filterOptions = effectiveCutoff ? { targetMessageId: effectiveCutoff } : undefined;

        console.log('[useForkModal] Fork with filter:', {
          cutoffMessageId,
          targetMessageId: modalData.targetMessageId,
          effectiveCutoff,
          filterOptions,
          createWorktree: shouldCreateWorktree,
          branchName,
          customWorkspacePath,
        });

        // Call fork service to fork session (with or without worktree)
        // Pass branchName to forkTitle if user customized it for worktree naming
        const result = await forkService.forkAgent({
          sourceAgentId: sourceData.agentId,
          sessionId,
          agentType: sourceData.agentType,
          forkTitle: branchName || forkTitle, // Use branchName for worktree branch if provided
          repoPath: effectiveRepoPath,
          filterOptions,
          createWorktree: shouldCreateWorktree,
          worktreePath, // Pass through for deterministic worktree path
        });

        if (!result.success) {
          setError(result.error.message);
          setIsLoading(false);
          return { success: false, error: result.error.message };
        }

        // Generate new IDs for the forked node
        const newNodeId = `node-${Date.now()}`;
        const newAgentId = `agent-${crypto.randomUUID()}`;
        const newTerminalId = `terminal-${crypto.randomUUID()}`;

        // Determine workspace path and worktree ID based on fork mode
        const forkedWorkspacePath = result.data.worktreeInfo?.worktreePath ?? workspacePath;
        const forkedWorktreeId = result.data.worktreeInfo?.id;

        // Create forked node data with explicit field mapping
        // This avoids accidentally copying fields that shouldn't be inherited
        const forkedData: AgentNodeData = {
          // New identifiers for the forked agent
          agentId: newAgentId,
          terminalId: newTerminalId,

          // Inherited from source (agent configuration)
          agentType: sourceData.agentType,

          // Fresh state for the forked agent
          status: 'idle',
          statusInfo: undefined,
          title: createDefaultAgentTitle(forkTitle),
          summary: null,
          progress: null,
          activeView: sourceData.activeView,

          // Session/fork lineage
          sessionId: result.data.sessionInfo.id,
          parentSessionId: sessionId,
          worktreeId: forkedWorktreeId,

          // Workspace configuration
          workspacePath: forkedWorkspacePath,
          gitInfo: sourceData.gitInfo, // Inherit from parent - worktree is on new branch in same repo

          // Keep non-workspace attachments (Linear issues, etc.)
          attachments: sourceData.attachments || [],

          // Forking state
          forking: false,

          // Initial input text from text selection
          initialInputText: modalData.selectedText,
        };

        // Create the new forked node
        const forkedNode: Node = {
          id: newNodeId,
          type: sourceNode.type,
          position: modalData.position,
          data: forkedData as unknown as Record<string, unknown>,
          style: sourceNode.style,
        };

        // Create edge from source to forked node (agent to agent)
        // Use solid style to differentiate from chat edges (agent to chat view)
        // Calculate optimal handles based on relative node positions for shortest path
        const optimalHandles = getOptimalHandles(sourceNode, forkedNode);
        const newEdgeId = `edge-${Date.now()}`;
        const newEdge: Edge = {
          id: newEdgeId,
          source: modalData.sourceNodeId,
          target: newNodeId,
          sourceHandle: optimalHandles.sourceHandle,
          targetHandle: optimalHandles.targetHandle,
          type: 'default',
          animated: false,
          style: {
            stroke: '#4a5568',
            strokeWidth: 2,
            // No strokeDasharray = solid line
          },
        };

        console.log('[useForkModal] Fork created successfully:', {
          newNodeId,
          sessionId: result.data.sessionInfo.id,
          workspacePath: forkedWorkspacePath,
          hasWorktree: !!result.data.worktreeInfo,
        });

        // Close modal
        setModalData(null);
        setIsLoading(false);

        return {
          success: true,
          newNodeId,
          forkedNode,
          newEdge,
        };
      } catch (err) {
        console.error('[useForkModal] Fork failed:', err);
        const errorMessage = err instanceof Error ? err.message : 'Fork failed';
        setError(errorMessage);
        setIsLoading(false);
        return { success: false, error: errorMessage };
      }
    },
    [modalData, nodes, cutoffMessageId]
  );

  /**
   * Cancel and close the modal
   */
  const cancel = useCallback(() => {
    setModalData(null);
    setError(null);
    setIsLoading(false);
    setMessages(null);
    setCutoffMessageIdState(null);
  }, []);

  /**
   * Clear the current error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Load messages for preview
   */
  const loadMessages = useCallback(async () => {
    if (!modalData?.sessionId || !modalData?.agentType) {
      console.warn('[useForkModal] Cannot load messages: missing sessionId or agentType');
      return;
    }

    if (!window.codingAgentAPI) {
      console.warn('[useForkModal] codingAgentAPI not available');
      return;
    }

    setIsLoadingMessages(true);
    try {
      const session = await window.codingAgentAPI.getSession(
        modalData.agentType as 'claude_code' | 'cursor' | 'codex',
        modalData.sessionId,
        { workspacePath: modalData.workspacePath }
      );

      if (session?.messages) {
        const previews: MessagePreview[] = session.messages
          .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
          .map((msg) => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant' | 'system',
            preview: truncateContent(msg.content, 120),
            timestamp: msg.timestamp,
          }));
        setMessages(previews);

        // If no cutoff is set and we have messages, default to last message (include all)
        if (!cutoffMessageId && previews.length > 0) {
          setCutoffMessageIdState(previews[previews.length - 1].id);
        }
      }
    } catch (err) {
      console.error('[useForkModal] Failed to load messages:', err);
      setError('Failed to load messages for preview');
    } finally {
      setIsLoadingMessages(false);
    }
  }, [modalData, cutoffMessageId]);

  /**
   * Update the cutoff message ID
   */
  const setCutoffMessageId = useCallback((messageId: string) => {
    setCutoffMessageIdState(messageId);
  }, []);

  return {
    // State
    isOpen,
    isLoading,
    error,
    modalData,
    messages,
    isLoadingMessages,
    cutoffMessageId,

    // Actions
    open,
    confirm,
    cancel,
    clearError,
    loadMessages,
    setCutoffMessageId,
  };
}

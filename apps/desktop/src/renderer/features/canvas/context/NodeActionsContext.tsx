/**
 * NodeActionsContext
 *
 * Provides typed, explicit methods for node data mutations.
 * Uses React Flow's useReactFlow() hook internally as the single source of truth.
 *
 * This replaces the event-based update-node pattern which caused infinite loops:
 * - Before: Component dispatches event → Canvas receives → updates state → component re-renders → dispatches again
 * - After: Component calls context method → direct setNodes call → no re-subscription cycle
 */

import type { CodingAgentStatus, GitInfo, TerminalAttachment } from '@agent-orchestrator/shared';
import type { Node } from '@xyflow/react';
import { useReactFlow } from '@xyflow/react';
import { createContext, type ReactNode, useCallback, useContext, useMemo } from 'react';
import type { AgentTitle } from '../../../types/agent-node';

// =============================================================================
// Types
// =============================================================================

export interface NodeActionsContextValue {
  /**
   * Update git info and workspace path for a node.
   * Used by useAgentState when git info is fetched.
   */
  updateGitInfo: (nodeId: string, gitInfo: GitInfo | null, workspacePath: string) => void;

  /**
   * Update only the workspace path for a node.
   * Used when user selects a new workspace.
   */
  updateWorkspacePath: (nodeId: string, workspacePath: string) => void;

  /**
   * Update attachments array for a node.
   * Used by TerminalNode when dropping Linear issues.
   */
  updateAttachments: (nodeId: string, attachments: TerminalAttachment[]) => void;

  /**
   * Update session ID for a node.
   * Used when a new session is created or detected.
   */
  updateSessionId: (nodeId: string, sessionId: string) => void;

  /**
   * Update the title for a node.
   * Used when user edits the title or it's auto-generated.
   */
  updateTitle: (nodeId: string, title: AgentTitle) => void;

  /**
   * Update the status for a node.
   * Used when agent status changes.
   */
  updateStatus: (nodeId: string, status: CodingAgentStatus) => void;

  /**
   * Delete a node by ID.
   * Dispatches to nodeStore and removes from React Flow state.
   */
  deleteNode: (nodeId: string) => void;

  /**
   * Merge partial data into a node's data object.
   * For backward compatibility during migration - prefer specific methods.
   */
  mergeNodeData: (nodeId: string, data: Record<string, unknown>) => void;

  /**
   * Get current nodes array.
   * Useful for operations that need to read current state.
   */
  getNodes: () => Node[];
}

const NodeActionsContext = createContext<NodeActionsContextValue | null>(null);

// =============================================================================
// Provider Props
// =============================================================================

export interface NodeActionsProviderProps {
  children: ReactNode;
  /**
   * Callback when nodes change due to user action.
   * Used for persistence.
   */
  onNodesChange?: (nodes: Node[]) => void;
}

// =============================================================================
// Provider Implementation
// =============================================================================

export function NodeActionsProvider({ children, onNodesChange }: NodeActionsProviderProps) {
  const { setNodes, getNodes } = useReactFlow();

  // Helper to notify persistence after changes
  const notifyChange = useCallback(
    (newNodes: Node[]) => {
      onNodesChange?.(newNodes);
    },
    [onNodesChange]
  );

  // ---------------------------------------------------------------------------
  // Specific Update Methods
  // ---------------------------------------------------------------------------

  const updateGitInfo = useCallback(
    (nodeId: string, gitInfo: GitInfo | null, workspacePath: string) => {
      setNodes((nodes) => {
        const newNodes = nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: { ...node.data, gitInfo, workspacePath },
              }
            : node
        );
        queueMicrotask(() => notifyChange(newNodes));
        return newNodes;
      });
    },
    [setNodes, notifyChange]
  );

  const updateWorkspacePath = useCallback(
    (nodeId: string, workspacePath: string) => {
      setNodes((nodes) => {
        const newNodes = nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: { ...node.data, workspacePath },
              }
            : node
        );
        queueMicrotask(() => notifyChange(newNodes));
        return newNodes;
      });
    },
    [setNodes, notifyChange]
  );

  const updateAttachments = useCallback(
    (nodeId: string, attachments: TerminalAttachment[]) => {
      setNodes((nodes) => {
        const newNodes = nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: { ...node.data, attachments },
              }
            : node
        );
        queueMicrotask(() => notifyChange(newNodes));
        return newNodes;
      });
    },
    [setNodes, notifyChange]
  );

  const updateSessionId = useCallback(
    (nodeId: string, sessionId: string) => {
      setNodes((nodes) => {
        const newNodes = nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: { ...node.data, sessionId },
              }
            : node
        );
        queueMicrotask(() => notifyChange(newNodes));
        return newNodes;
      });
    },
    [setNodes, notifyChange]
  );

  const updateTitle = useCallback(
    (nodeId: string, title: AgentTitle) => {
      setNodes((nodes) => {
        const newNodes = nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: { ...node.data, title },
              }
            : node
        );
        queueMicrotask(() => notifyChange(newNodes));
        return newNodes;
      });
    },
    [setNodes, notifyChange]
  );

  const updateStatus = useCallback(
    (nodeId: string, status: CodingAgentStatus) => {
      setNodes((nodes) => {
        const newNodes = nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: { ...node.data, status },
              }
            : node
        );
        queueMicrotask(() => notifyChange(newNodes));
        return newNodes;
      });
    },
    [setNodes, notifyChange]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nodes) => {
        const newNodes = nodes.filter((node) => node.id !== nodeId);
        queueMicrotask(() => notifyChange(newNodes));
        return newNodes;
      });
    },
    [setNodes, notifyChange]
  );

  // ---------------------------------------------------------------------------
  // Generic Merge (for backward compatibility)
  // ---------------------------------------------------------------------------

  const mergeNodeData = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((nodes) => {
        const newNodes = nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: { ...node.data, ...data },
              }
            : node
        );
        queueMicrotask(() => notifyChange(newNodes));
        return newNodes;
      });
    },
    [setNodes, notifyChange]
  );

  // ---------------------------------------------------------------------------
  // Context Value (memoized to prevent re-render cascades)
  // ---------------------------------------------------------------------------

  const value = useMemo<NodeActionsContextValue>(
    () => ({
      updateGitInfo,
      updateWorkspacePath,
      updateAttachments,
      updateSessionId,
      updateTitle,
      updateStatus,
      deleteNode,
      mergeNodeData,
      getNodes,
    }),
    [
      updateGitInfo,
      updateWorkspacePath,
      updateAttachments,
      updateSessionId,
      updateTitle,
      updateStatus,
      deleteNode,
      mergeNodeData,
      getNodes,
    ]
  );

  return <NodeActionsContext.Provider value={value}>{children}</NodeActionsContext.Provider>;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Access node action methods from the NodeActionsContext.
 * Must be used within a NodeActionsProvider (which must be inside ReactFlowProvider).
 */
export function useNodeActions(): NodeActionsContextValue {
  const context = useContext(NodeActionsContext);
  if (!context) {
    throw new Error(
      'useNodeActions must be used within a NodeActionsProvider. ' +
        'Make sure NodeActionsProvider is inside ReactFlowProvider.'
    );
  }
  return context;
}

/**
 * Optional hook that returns null if not within provider.
 * Useful for components that may be rendered outside the canvas.
 */
export function useNodeActionsOptional(): NodeActionsContextValue | null {
  return useContext(NodeActionsContext);
}

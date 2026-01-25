import type { Node } from '@xyflow/react';
import { useCallback, useMemo, useRef } from 'react';
import { applyHighlightStylesToNodes } from '../../sidebar/hooks/useFolderHighlight';

/**
 * Node Operations Hook
 *
 * Provides declarative methods for node manipulation, replacing generic setNodes calls.
 * Each method has a clear intent, making the code easier to reason about.
 *
 * Operations are categorized as:
 * - Internal: Restoration, highlighting (should NOT trigger persistence)
 * - User-initiated: Add, delete, update (SHOULD trigger persistence)
 */

// =============================================================================
// Pure Functions (testable logic, no React state)
// =============================================================================

/**
 * Removes highlight styles (border, boxShadow, borderRadius) from all agent nodes.
 * Returns the same array reference if no changes are needed to prevent unnecessary re-renders.
 */
export function removeHighlightStylesFromNodes(nodes: Node[]): Node[] {
  if (nodes.length === 0) return nodes;

  const needsUpdate = nodes.some((node) => {
    if (node.type !== 'agent') return false;
    const style = node.style as Record<string, unknown> | undefined;
    return !!(style?.border || style?.boxShadow || style?.borderRadius);
  });

  if (!needsUpdate) return nodes;

  return nodes.map((node) => {
    if (node.type !== 'agent') return node;
    const currentStyle = node.style || {};
    const { border, boxShadow, borderRadius, ...restStyle } = currentStyle as Record<
      string,
      unknown
    >;
    return { ...node, style: restStyle };
  });
}

// =============================================================================
// Types
// =============================================================================

export interface UseNodeOperationsInput {
  /** React Flow's setNodes function */
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  /** Callback when user-initiated changes occur (for persistence) */
  onUserChange?: (nodes: Node[]) => void;
}

export interface UseNodeOperationsReturn {
  // Internal operations (no persistence)
  /** Restore nodes from persistence - internal, no persist trigger */
  restoreNodes: (nodes: Node[]) => void;
  /** Apply highlight border to a specific agent node */
  highlightAgentNode: (agentId: string) => void;
  /** Remove highlight from all agent nodes */
  unhighlightAllAgentNodes: () => void;
  /** Apply folder highlight styles to nodes */
  applyFolderHighlights: (
    highlightedFolders: Set<string>,
    folderColors: Map<string, string>
  ) => void;

  // User-initiated operations (triggers persistence)
  /** Add a new node */
  addNode: (node: Node) => void;
  /** Remove a node by ID */
  removeNode: (nodeId: string) => void;
  /** Replace a node with a new node (e.g., starter -> agent) */
  replaceNode: (oldNodeId: string, newNode: Node) => void;
  /** Update a node's position */
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;

  // Specific node data updates (triggers persistence)
  /** Update node's sessionId (e.g., from fork modal auto-detection) */
  updateNodeSessionId: (nodeId: string, sessionId: string) => void;
  /** Update node's attachments (e.g., from terminal drop) */
  updateNodeAttachments: (nodeId: string, attachments: unknown[]) => void;
  /** Update node's git info and workspace path */
  updateNodeGitInfo: (
    nodeId: string,
    gitInfo: { branch?: string; repo?: string },
    workspacePath: string
  ) => void;

  /** Mark that initial state has been applied (enables persistence) */
  markInitialStateApplied: () => void;
  /** Check if initial state has been applied */
  isInitialStateApplied: () => boolean;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useNodeOperations({
  setNodes,
  onUserChange,
}: UseNodeOperationsInput): UseNodeOperationsReturn {
  const initialStateApplied = useRef(false);
  // Track current nodes in a ref to avoid calling setNodes just to read them
  const nodesRef = useRef<Node[]>([]);

  // Helper to notify persistence after user changes
  // Takes the new nodes directly to avoid reading from state
  const notifyUserChange = useCallback(
    (newNodes: Node[]) => {
      if (initialStateApplied.current && onUserChange) {
        nodesRef.current = newNodes;
        onUserChange(newNodes);
      }
    },
    [onUserChange]
  );

  // ---------------------------------------------------------------------------
  // Internal Operations (no persistence)
  // ---------------------------------------------------------------------------

  const restoreNodes = useCallback(
    (nodes: Node[]) => {
      console.log('[NodeOperations] restoreNodes:', nodes.length);
      setNodes(nodes);
    },
    [setNodes]
  );

  const highlightAgentNode = useCallback(
    (agentId: string) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.type !== 'agent') return node;
          const nodeData = node.data as Record<string, unknown>;
          const nodeAgentId = nodeData?.agentId as string | undefined;

          if (nodeAgentId === agentId) {
            const currentStyle = node.style || {};
            return {
              ...node,
              style: {
                ...currentStyle,
                border: '2px solid #3b82f6',
                boxShadow: '0 0 12px rgba(59, 130, 246, 0.5)',
                borderRadius: '12px',
              },
            };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  const unhighlightAllAgentNodes = useCallback(() => {
    setNodes(removeHighlightStylesFromNodes);
  }, [setNodes]);

  const applyFolderHighlights = useCallback(
    (highlightedFolders: Set<string>, folderColors: Map<string, string>) => {
      setNodes((currentNodes) => {
        const result = applyHighlightStylesToNodes(currentNodes, highlightedFolders, folderColors);
        return result;
      });
    },
    [setNodes]
  );

  // ---------------------------------------------------------------------------
  // User-Initiated Operations (triggers persistence)
  // ---------------------------------------------------------------------------

  const addNode = useCallback(
    (node: Node) => {
      console.log('[NodeOperations] addNode:', node.id, { type: node.type });
      setNodes((currentNodes) => {
        const newNodes = [...currentNodes, node];
        // Defer persistence to avoid calling it inside setNodes
        queueMicrotask(() => notifyUserChange(newNodes));
        return newNodes;
      });
    },
    [setNodes, notifyUserChange]
  );

  const removeNode = useCallback(
    (nodeId: string) => {
      console.log('[NodeOperations] removeNode:', nodeId);
      setNodes((currentNodes) => {
        const newNodes = currentNodes.filter((n) => n.id !== nodeId);
        queueMicrotask(() => notifyUserChange(newNodes));
        return newNodes;
      });
    },
    [setNodes, notifyUserChange]
  );

  const replaceNode = useCallback(
    (oldNodeId: string, newNode: Node) => {
      console.log('[NodeOperations] replaceNode:', oldNodeId, '->', newNode.id, {
        type: newNode.type,
      });
      setNodes((currentNodes) => {
        const newNodes = [...currentNodes.filter((n) => n.id !== oldNodeId), newNode];
        queueMicrotask(() => notifyUserChange(newNodes));
        return newNodes;
      });
    },
    [setNodes, notifyUserChange]
  );

  const updateNodePosition = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      console.log('[NodeOperations] updateNodePosition:', nodeId, position);
      setNodes((currentNodes) => {
        const newNodes = currentNodes.map((n) => (n.id === nodeId ? { ...n, position } : n));
        queueMicrotask(() => notifyUserChange(newNodes));
        return newNodes;
      });
    },
    [setNodes, notifyUserChange]
  );

  // ---------------------------------------------------------------------------
  // Specific Node Data Updates (triggers persistence)
  // ---------------------------------------------------------------------------

  const updateNodeSessionId = useCallback(
    (nodeId: string, sessionId: string) => {
      console.log('[NodeOperations] updateNodeSessionId:', nodeId, { sessionId });
      setNodes((currentNodes) => {
        const newNodes = currentNodes.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, sessionId } } : node
        );
        queueMicrotask(() => notifyUserChange(newNodes));
        return newNodes;
      });
    },
    [setNodes, notifyUserChange]
  );

  const updateNodeAttachments = useCallback(
    (nodeId: string, attachments: unknown[]) => {
      console.log('[NodeOperations] updateNodeAttachments:', nodeId, {
        count: attachments.length,
      });
      setNodes((currentNodes) => {
        const newNodes = currentNodes.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, attachments } } : node
        );
        queueMicrotask(() => notifyUserChange(newNodes));
        return newNodes;
      });
    },
    [setNodes, notifyUserChange]
  );

  const updateNodeGitInfo = useCallback(
    (nodeId: string, gitInfo: { branch?: string; repo?: string }, workspacePath: string) => {
      console.log('[NodeOperations] updateNodeGitInfo:', nodeId, { gitInfo, workspacePath });
      setNodes((currentNodes) => {
        const newNodes = currentNodes.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, gitInfo, workspacePath } } : node
        );
        queueMicrotask(() => notifyUserChange(newNodes));
        return newNodes;
      });
    },
    [setNodes, notifyUserChange]
  );

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  const markInitialStateApplied = useCallback(() => {
    initialStateApplied.current = true;
  }, []);

  const isInitialStateApplied = useCallback(() => {
    return initialStateApplied.current;
  }, []);

  return useMemo(
    () => ({
      // Internal operations
      restoreNodes,
      highlightAgentNode,
      unhighlightAllAgentNodes,
      applyFolderHighlights,
      // User operations
      addNode,
      removeNode,
      replaceNode,
      updateNodePosition,
      // Specific node data updates
      updateNodeSessionId,
      updateNodeAttachments,
      updateNodeGitInfo,
      // State management
      markInitialStateApplied,
      isInitialStateApplied,
    }),
    [
      restoreNodes,
      highlightAgentNode,
      unhighlightAllAgentNodes,
      applyFolderHighlights,
      addNode,
      removeNode,
      replaceNode,
      updateNodePosition,
      updateNodeSessionId,
      updateNodeAttachments,
      updateNodeGitInfo,
      markInitialStateApplied,
      isInitialStateApplied,
    ]
  );
}

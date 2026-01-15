/**
 * Node Store Interface
 *
 * Observable store for managing canvas node state.
 * Follows the same pattern as IForkStore and IAgentStore.
 */

import type { Node } from '@xyflow/react';

/**
 * Callback for node state changes
 */
export type NodesChangeListener = (nodes: Node[]) => void;

/**
 * Interface for node state management
 */
export interface INodeStore {
  /**
   * Get a single node by ID
   */
  getNode(nodeId: string): Node | null;

  /**
   * Get all nodes
   */
  getAllNodes(): Node[];

  /**
   * Update a single node's data
   * Only updates the target node - no cross-node syncing
   */
  updateNode(nodeId: string, data: Record<string, unknown>): void;

  /**
   * Delete a node by ID
   */
  deleteNode(nodeId: string): void;

  /**
   * Set all nodes (bulk update, used for initialization and sync with React Flow)
   */
  setNodes(nodes: Node[]): void;

  /**
   * Subscribe to node state changes
   * @returns Unsubscribe function
   */
  subscribe(listener: NodesChangeListener): () => void;
}

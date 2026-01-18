/**
 * Node Store Implementation
 *
 * Manages canvas node state using observer pattern.
 * Each node is independent - no cross-node session syncing.
 */

import type { Node } from '@xyflow/react';
import type { INodeStore, NodesChangeListener } from './INodeStore';

/**
 * Node store implementation with observer pattern
 */
export class NodeStore implements INodeStore {
  private nodes: Map<string, Node> = new Map();
  private listeners: Set<NodesChangeListener> = new Set();

  /**
   * Get a single node by ID
   */
  getNode(nodeId: string): Node | null {
    return this.nodes.get(nodeId) ?? null;
  }

  /**
   * Get all nodes as an array
   */
  getAllNodes(): Node[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Update a single node's data
   * Only updates the target node - no cross-node syncing
   */
  updateNode(nodeId: string, data: Record<string, unknown>): void {
    const existing = this.nodes.get(nodeId);
    if (!existing) {
      console.warn('[NodeStore] updateNode: node not found', { nodeId });
      return;
    }

    const updatedNode: Node = {
      ...existing,
      data: { ...data },
    };

    this.nodes.set(nodeId, updatedNode);

    this.notifyListeners();
  }

  /**
   * Delete a node by ID
   */
  deleteNode(nodeId: string): void {
    if (this.nodes.has(nodeId)) {
      this.nodes.delete(nodeId);
      this.notifyListeners();
    }
  }

  /**
   * Set all nodes (bulk update)
   * Used for initialization and sync with React Flow
   */
  setNodes(nodes: Node[]): void {
    this.nodes.clear();
    for (const node of nodes) {
      this.nodes.set(node.id, node);
    }
    this.notifyListeners();
  }

  /**
   * Subscribe to node state changes
   */
  subscribe(listener: NodesChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const currentNodes = this.getAllNodes();
    this.listeners.forEach((listener) => {
      listener(currentNodes);
    });
  }
}

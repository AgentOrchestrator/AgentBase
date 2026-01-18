/**
 * Utility functions for calculating optimal edge handle connections
 * based on relative node positions.
 */

import type { Edge, Node } from '@xyflow/react';

export interface HandlePair {
  sourceHandle: string;
  targetHandle: string;
}

/**
 * Calculate the optimal source and target handles for an edge
 * based on the relative positions of the source and target nodes.
 *
 * This creates the shortest visual path by connecting nodes via
 * the sides that face each other.
 *
 * @param sourceNode - The source node
 * @param targetNode - The target node
 * @returns The optimal sourceHandle and targetHandle IDs
 */
export function getOptimalHandles(sourceNode: Node, targetNode: Node): HandlePair {
  // Get node centers (position is top-left corner)
  // Use measured dimensions if available, otherwise use defaults
  const sourceWidth = sourceNode.measured?.width ?? sourceNode.width ?? 450;
  const sourceHeight = sourceNode.measured?.height ?? sourceNode.height ?? 350;
  const targetWidth = targetNode.measured?.width ?? targetNode.width ?? 450;
  const targetHeight = targetNode.measured?.height ?? targetNode.height ?? 350;

  const sourceCenterX = sourceNode.position.x + sourceWidth / 2;
  const sourceCenterY = sourceNode.position.y + sourceHeight / 2;
  const targetCenterX = targetNode.position.x + targetWidth / 2;
  const targetCenterY = targetNode.position.y + targetHeight / 2;

  // Calculate the difference between centers
  const deltaX = targetCenterX - sourceCenterX;
  const deltaY = targetCenterY - sourceCenterY;

  // Determine which axis has the greater absolute distance
  // This determines the primary direction of the connection
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (absX > absY) {
    // Horizontal connection is primary
    if (deltaX > 0) {
      // Target is to the RIGHT of source
      return { sourceHandle: 'source-right', targetHandle: 'target-left' };
    } else {
      // Target is to the LEFT of source
      return { sourceHandle: 'source-left', targetHandle: 'target-right' };
    }
  } else {
    // Vertical connection is primary
    if (deltaY > 0) {
      // Target is BELOW source
      return { sourceHandle: 'source-bottom', targetHandle: 'target-top' };
    } else {
      // Target is ABOVE source
      return { sourceHandle: 'source-top', targetHandle: 'target-bottom' };
    }
  }
}

/**
 * Check if a node type supports dynamic handle updates.
 * Some node types (like agent-chat) only have handles on specific sides.
 *
 * @param nodeType - The type of the node
 * @returns True if the node supports all-side handles
 */
function supportsAllSideHandles(nodeType: string | undefined): boolean {
  // agent-chat nodes only have handles at top and bottom
  // Only 'agent' nodes have handles on all four sides
  return nodeType === 'agent';
}

/**
 * Update edges with optimal handles based on current node positions.
 * Only updates edges where both source and target nodes support all-side handles.
 *
 * @param edges - Array of edges to update
 * @param nodes - Array of all nodes
 * @returns Updated edges with optimal handles
 */
export function updateEdgesWithOptimalHandles(edges: Edge[], nodes: Node[]): Edge[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  return edges.map((edge) => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if (!sourceNode || !targetNode) {
      return edge;
    }

    // Only update edges between nodes that both support all-side handles
    // This prevents breaking edges to chat nodes which only have top/bottom handles
    if (!supportsAllSideHandles(sourceNode.type) || !supportsAllSideHandles(targetNode.type)) {
      return edge;
    }

    const optimalHandles = getOptimalHandles(sourceNode, targetNode);

    // Only update if handles have changed
    if (
      edge.sourceHandle === optimalHandles.sourceHandle &&
      edge.targetHandle === optimalHandles.targetHandle
    ) {
      return edge;
    }

    return {
      ...edge,
      sourceHandle: optimalHandles.sourceHandle,
      targetHandle: optimalHandles.targetHandle,
    };
  });
}

/**
 * Check if any edges need handle updates based on node positions.
 * This is useful for determining whether to trigger an edge update.
 *
 * @param edges - Array of edges to check
 * @param nodes - Array of all nodes
 * @returns True if any edge handles need updating
 */
export function edgesNeedHandleUpdate(edges: Edge[], nodes: Node[]): boolean {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  return edges.some((edge) => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if (!sourceNode || !targetNode) {
      return false;
    }

    const optimalHandles = getOptimalHandles(sourceNode, targetNode);

    return (
      edge.sourceHandle !== optimalHandles.sourceHandle ||
      edge.targetHandle !== optimalHandles.targetHandle
    );
  });
}

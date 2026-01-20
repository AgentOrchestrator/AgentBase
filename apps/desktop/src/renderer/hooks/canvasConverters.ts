import type { Edge, Node, Viewport } from '@xyflow/react';
import type {
  CanvasEdge,
  CanvasNode,
  Viewport as DbViewport,
  NodeData,
} from '../../main/types/database';
import { nodeRegistry } from '../nodes/registry';

/**
 * Convert React Flow nodes to database CanvasNodes
 *
 * Uses the node registry to:
 * 1. Filter out non-persistent node types
 * 2. Validate node data against schemas
 */
export function nodesToCanvasNodes(nodes: Node[]): CanvasNode[] {
  console.log(
    `[CanvasPersistence] nodesToCanvasNodes: START - processing ${nodes.length} input nodes`
  );

  const filteredNodes = nodes.filter((node) => {
    const nodeType = node.type || 'custom';
    console.log(`[CanvasPersistence] nodesToCanvasNodes: checking node`, {
      id: node.id,
      type: nodeType,
    });

    if (!nodeRegistry.isPersistedType(nodeType)) {
      console.log(`[CanvasPersistence] nodesToCanvasNodes: FILTERED OUT - non-persistent node`, {
        id: node.id,
        type: nodeType,
      });
      return false;
    }
    return true;
  });

  console.log(
    `[CanvasPersistence] nodesToCanvasNodes: after filter - ${filteredNodes.length} of ${nodes.length} nodes are persistent`
  );

  const result = filteredNodes.map((node) => {
    const nodeType = node.type || 'custom';

    // Validate against schema if available
    const validation = nodeRegistry.validateNodeData(nodeType, node.data);
    if (!validation.success) {
      console.warn(`[CanvasPersistence] nodesToCanvasNodes: VALIDATION FAILED`, {
        id: node.id,
        type: nodeType,
        fullNode: JSON.stringify(node),
        error: validation.error,
      });
    }

    const canvasNode = {
      id: node.id,
      type: nodeType as CanvasNode['type'],
      position: {
        x: node.position.x,
        y: node.position.y,
      },
      data: node.data as NodeData,
      style: node.style as { width?: number; height?: number } | undefined,
    };

    console.log(`[CanvasPersistence] nodesToCanvasNodes: converted node`, {
      id: canvasNode.id,
      type: canvasNode.type,
      position: canvasNode.position,
    });

    return canvasNode;
  });

  console.log(
    `[CanvasPersistence] nodesToCanvasNodes: END - returning ${result.length} canvas nodes`
  );

  return result;
}

/**
 * Convert database CanvasNodes to React Flow nodes
 */
export function canvasNodesToNodes(canvasNodes: CanvasNode[]): Node[] {
  return canvasNodes.map((cn) => ({
    id: cn.id,
    type: cn.type,
    position: { ...cn.position },
    // Deep clone data to ensure each node has its own independent data object
    // This prevents shared reference issues when multiple nodes are loaded
    data: JSON.parse(JSON.stringify(cn.data)) as Record<string, unknown>,
    style: cn.style ? { ...cn.style } : undefined,
  }));
}

/**
 * Convert React Flow edges to database CanvasEdges
 */
export function edgesToCanvasEdges(edges: Edge[]): CanvasEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type,
    data: edge.data as Record<string, unknown> | undefined,
    style: edge.style as Record<string, unknown> | undefined,
  }));
}

/**
 * Convert database CanvasEdges to React Flow edges
 */
export function canvasEdgesToEdges(canvasEdges: CanvasEdge[]): Edge[] {
  return canvasEdges.map((ce) => ({
    id: ce.id,
    source: ce.source,
    target: ce.target,
    type: ce.type,
    data: ce.data,
    style: ce.style,
  }));
}

/**
 * Convert React Flow Viewport to database Viewport
 */
export function viewportToDbViewport(viewport: Viewport): DbViewport {
  return {
    x: viewport.x,
    y: viewport.y,
    zoom: viewport.zoom,
  };
}

/**
 * Convert database Viewport to React Flow Viewport
 */
export function dbViewportToViewport(dbViewport: DbViewport): Viewport {
  return {
    x: dbViewport.x,
    y: dbViewport.y,
    zoom: dbViewport.zoom,
  };
}

/**
 * Generate a unique canvas ID
 */
export function generateCanvasId(): string {
  return `canvas-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

import type { Node, Edge, Viewport } from '@xyflow/react';
import type {
  CanvasNode,
  CanvasEdge,
  NodeData,
  Viewport as DbViewport,
} from '../../main/types/database';

/**
 * Convert React Flow nodes to database CanvasNodes
 */
export function nodesToCanvasNodes(nodes: Node[]): CanvasNode[] {
  return nodes.map((node) => ({
    id: node.id,
    type: (node.type || 'custom') as 'custom' | 'terminal' | 'workspace',
    position: {
      x: node.position.x,
      y: node.position.y,
    },
    data: node.data as NodeData,
    style: node.style as { width?: number; height?: number } | undefined,
  }));
}

/**
 * Convert database CanvasNodes to React Flow nodes
 */
export function canvasNodesToNodes(canvasNodes: CanvasNode[]): Node[] {
  return canvasNodes.map((cn) => ({
    id: cn.id,
    type: cn.type,
    position: cn.position,
    data: cn.data as Record<string, unknown>,
    style: cn.style,
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

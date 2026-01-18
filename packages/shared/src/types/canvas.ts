/**
 * Canvas Type Definitions
 *
 * Types for canvas state persistence and React Flow integration.
 * Used for saving/loading the visual agent orchestration canvas.
 */

import type { AgentNodeData } from './agent-node.js';
import type { TerminalAttachment } from './attachments.js';

// =============================================================================
// Node Data Types
// =============================================================================

/**
 * Data for terminal nodes
 */
export interface TerminalNodeData {
  /** Terminal instance identifier */
  terminalId: string;
  /** Attached metadata */
  attachments?: TerminalAttachment[];
  /** Legacy: Linear issue info (prefer attachments) */
  issue?: {
    id?: string;
    identifier: string;
    title: string;
    url: string;
  };
}

/**
 * Data for custom/generic nodes
 */
export interface CustomNodeData {
  /** Display label */
  label?: string;
  /** Extensible properties */
  [key: string]: unknown;
}

/**
 * Union of all node data types
 */
export type NodeData = TerminalNodeData | CustomNodeData | AgentNodeData;

// =============================================================================
// Node Types
// =============================================================================

/**
 * Supported node types in the canvas
 */
export type CanvasNodeType = 'custom' | 'terminal' | 'agent';

// =============================================================================
// Canvas Node
// =============================================================================

/**
 * Canvas node definition (React Flow compatible)
 */
export interface CanvasNode {
  /** Unique node identifier */
  id: string;
  /** Node type */
  type: CanvasNodeType;
  /** Position on canvas */
  position: {
    x: number;
    y: number;
  };
  /** Node-specific data */
  data: NodeData;
  /** Optional styling */
  style?: {
    width?: number;
    height?: number;
    [key: string]: unknown;
  };
}

// =============================================================================
// Canvas Edge
// =============================================================================

/**
 * Canvas edge definition (React Flow compatible)
 */
export interface CanvasEdge {
  /** Unique edge identifier */
  id: string;
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Edge type (e.g., 'default', 'smoothstep') */
  type?: string;
  /** Edge-specific data */
  data?: Record<string, unknown>;
  /** Edge styling */
  style?: Record<string, unknown>;
}

// =============================================================================
// Viewport
// =============================================================================

/**
 * Canvas viewport state
 */
export interface Viewport {
  /** X offset */
  x: number;
  /** Y offset */
  y: number;
  /** Zoom level */
  zoom: number;
}

// =============================================================================
// Canvas State
// =============================================================================

/**
 * Complete canvas state for persistence
 */
export interface CanvasState {
  /** Canvas identifier */
  id: string;
  /** Optional display name */
  name?: string;
  /** All nodes on the canvas */
  nodes: CanvasNode[];
  /** All edges connecting nodes */
  edges: CanvasEdge[];
  /** Current viewport */
  viewport?: Viewport;
  /** ISO timestamp when created */
  createdAt?: string;
  /** ISO timestamp when last updated */
  updatedAt?: string;
}

/**
 * Canvas metadata for listing (without full node/edge data)
 */
export interface CanvasMetadata {
  /** Canvas identifier */
  id: string;
  /** Optional display name */
  name?: string;
  /** Number of nodes */
  nodeCount: number;
  /** Number of edges */
  edgeCount: number;
  /** ISO timestamp when created */
  createdAt: string;
  /** ISO timestamp when last updated */
  updatedAt: string;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if node data is for an agent node
 */
export function isAgentNodeData(data: NodeData): data is AgentNodeData {
  return 'agentId' in data && 'terminalId' in data && 'agentType' in data;
}

/**
 * Type guard to check if node data is for a terminal node
 */
export function isTerminalNodeData(data: NodeData): data is TerminalNodeData {
  return 'terminalId' in data && !('agentId' in data);
}

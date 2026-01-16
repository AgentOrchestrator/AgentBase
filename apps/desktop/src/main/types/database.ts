/**
 * Database Type Definitions
 *
 * Re-exports canvas and node types from @agent-orchestrator/shared.
 * This file is kept for backwards compatibility with existing imports.
 */

export type {
  // Node data types
  TerminalNodeData,
  CustomNodeData,
  NodeData,
  // Canvas types
  CanvasNodeType,
  CanvasNode,
  CanvasEdge,
  Viewport,
  CanvasState,
  CanvasMetadata,
} from '@agent-orchestrator/shared';

export {
  // Type guards
  isAgentNodeData,
  isTerminalNodeData,
} from '@agent-orchestrator/shared';

// Re-export AgentNodeData for convenience (also available from agent-node types)
export type { AgentNodeData } from '@agent-orchestrator/shared';

// Re-export attachment types used in node data
export type { TerminalAttachment } from '@agent-orchestrator/shared';

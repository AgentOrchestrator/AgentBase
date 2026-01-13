/**
 * Database type definitions for canvas state persistence
 */

// Attachment types (from renderer/types/attachments.ts)
export interface BaseAttachment {
  type: string;
  id: string;
  metadata?: Record<string, unknown>;
}

export interface LinearIssueAttachment extends BaseAttachment {
  type: 'linear-issue';
  identifier: string;
  title: string;
  url: string;
  state?: {
    name: string;
    color: string;
  };
  priority?: {
    label: string;
    priority: number;
  };
  assignee?: {
    name: string;
    avatarUrl?: string;
  };
}

export interface WorkspaceMetadataAttachment extends BaseAttachment {
  type: 'workspace-metadata';
  path: string;
  name?: string;
  description?: string;
  gitRepo?: string;
  projectType?: string;
}

export type TerminalAttachment = LinearIssueAttachment | WorkspaceMetadataAttachment;

// Node data types
export interface TerminalNodeData {
  terminalId: string;
  attachments?: TerminalAttachment[];
  issue?: {
    id?: string;
    identifier: string;
    title: string;
    url: string;
  };
}

export interface WorkspaceNodeData {
  path: string;
  name?: string;
  projectType?: string;
}

export interface CustomNodeData {
  label?: string;
  [key: string]: unknown;
}

// Agent node data (mirrors renderer/types/agent-node.ts)
export interface AgentNodeData {
  agentId: string;
  terminalId: string;
  agentType: string;
  status: string;
  statusInfo?: Record<string, unknown>;
  title: {
    value: string;
    isManuallySet: boolean;
  };
  summary: string | null;
  progress: Record<string, unknown> | null;
  attachments?: TerminalAttachment[];
  activeView?: 'overview' | 'terminal';
}

export type NodeData = TerminalNodeData | WorkspaceNodeData | CustomNodeData | AgentNodeData;

// Canvas node definition
export interface CanvasNode {
  id: string;
  type: 'custom' | 'terminal' | 'workspace' | 'agent';
  position: {
    x: number;
    y: number;
  };
  data: NodeData;
  style?: {
    width?: number;
    height?: number;
    [key: string]: unknown;
  };
}

// Canvas edge definition
export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  data?: Record<string, unknown>;
  style?: Record<string, unknown>;
}

// Viewport state
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

// Complete canvas state
export interface CanvasState {
  id: string;
  name?: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport?: Viewport;
  createdAt?: string;
  updatedAt?: string;
}

// Canvas metadata for listing
export interface CanvasMetadata {
  id: string;
  name?: string;
  nodeCount: number;
  edgeCount: number;
  createdAt: string;
  updatedAt: string;
}

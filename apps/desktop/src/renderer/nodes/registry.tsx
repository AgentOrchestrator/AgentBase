/**
 * Node Type Registry
 *
 * Single source of truth for all node types and their persistence configuration.
 *
 * DESIGN PRINCIPLE: Persistence is automatic unless explicitly opted out.
 * When adding a new node type, you MUST declare its persistence config.
 * If persistence is disabled, you MUST provide a reason.
 */

import { Handle, type NodeProps, Position } from '@xyflow/react';
import type { ComponentType } from 'react';
import type { z } from 'zod';

// Import node components
import TerminalNode from '../TerminalNode';
import AgentChatNode from './AgentChatNode';
import { AgentNode } from './AgentNode';
import BrowserNode from './BrowserNode';
import ConversationNode from './ConversationNode';
import StarterNode from './StarterNode';

// Import schemas
import {
  AgentChatNodeDataSchema,
  AgentNodeDataSchema,
  BrowserNodeDataSchema,
  ConversationNodeDataSchema,
  CustomNodeDataSchema,
  TerminalNodeDataSchema,
} from './schemas';

// =============================================================================
// Registry Types
// =============================================================================

interface PersistenceEnabled<T> {
  enabled: true;
  dataSchema: z.ZodSchema<T>;
}

interface PersistenceDisabled {
  enabled: false;
  /** Explanation required for why this node type is not persisted */
  reason: string;
}

/**
 * Configuration for a node type.
 * Persistence config is REQUIRED - you cannot register a node without it.
 */
export interface NodeTypeConfig<T = unknown> {
  /** Unique identifier for this node type */
  type: string;
  /** React component to render this node */
  component: ComponentType<NodeProps>;
  /** Persistence configuration - REQUIRED */
  persistence: PersistenceEnabled<T> | PersistenceDisabled;
}

// =============================================================================
// Custom Node Component (inline since it's simple)
// =============================================================================

const CustomNode = ({ data }: NodeProps) => {
  const nodeData = data as { label?: string };
  return (
    <div className="custom-node">
      <Handle type="target" position={Position.Top} />
      <div className="custom-node-content">{nodeData.label}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

// =============================================================================
// Node Registry Definition
// =============================================================================

/**
 * All registered node types.
 *
 * To add a new node type:
 * 1. Create your node component
 * 2. Create a Zod schema in schemas.ts
 * 3. Add it to this array with persistence config
 *
 * TypeScript will error if you forget the persistence config!
 */
const NODE_CONFIGS: NodeTypeConfig[] = [
  {
    type: 'custom',
    component: CustomNode as ComponentType<NodeProps>,
    persistence: {
      enabled: true,
      dataSchema: CustomNodeDataSchema,
    },
  },
  {
    type: 'terminal',
    component: TerminalNode as ComponentType<NodeProps>,
    persistence: {
      enabled: true,
      dataSchema: TerminalNodeDataSchema,
    },
  },
  {
    type: 'agent',
    component: AgentNode as ComponentType<NodeProps>,
    persistence: {
      enabled: true,
      dataSchema: AgentNodeDataSchema,
    },
  },
  {
    type: 'conversation',
    component: ConversationNode as ComponentType<NodeProps>,
    persistence: {
      enabled: true,
      dataSchema: ConversationNodeDataSchema,
    },
  },
  {
    type: 'agent-chat',
    component: AgentChatNode as ComponentType<NodeProps>,
    persistence: {
      enabled: true,
      dataSchema: AgentChatNodeDataSchema,
    },
  },
  {
    type: 'starter',
    component: StarterNode as ComponentType<NodeProps>,
    persistence: {
      enabled: false,
      reason: 'Starter nodes are transient input fields, not meant to be persisted',
    },
  },
  {
    type: 'browser',
    component: BrowserNode as ComponentType<NodeProps>,
    persistence: {
      enabled: true,
      dataSchema: BrowserNodeDataSchema,
    },
  },
];

// =============================================================================
// Registry Factory
// =============================================================================

function createNodeRegistry(configs: NodeTypeConfig[]) {
  // Extract all type strings
  const types = configs.map((c) => c.type);

  // Create React Flow nodeTypes object
  const reactFlowNodeTypes = Object.fromEntries(
    configs.map((c) => [c.type, c.component])
  ) as Record<string, ComponentType<NodeProps>>;

  // Get list of persisted types
  const persistedTypes = configs.filter((c) => c.persistence.enabled).map((c) => c.type);

  // Build schema map for persisted types
  const schemas = Object.fromEntries(
    configs
      .filter(
        (c): c is NodeTypeConfig & { persistence: PersistenceEnabled<unknown> } =>
          c.persistence.enabled
      )
      .map((c) => [c.type, c.persistence.dataSchema])
  ) as Record<string, z.ZodSchema>;

  // Get reasons for non-persisted types
  const nonPersistedReasons = Object.fromEntries(
    configs
      .filter(
        (c): c is NodeTypeConfig & { persistence: PersistenceDisabled } => !c.persistence.enabled
      )
      .map((c) => [c.type, c.persistence.reason])
  ) as Record<string, string>;

  return {
    /** All registered node type strings */
    types,

    /** React Flow nodeTypes object for <ReactFlow nodeTypes={...} /> */
    reactFlowNodeTypes,

    /** Types that should be persisted */
    persistedTypes,

    /** Zod schemas by type (only for persisted types) */
    schemas,

    /** Reasons for non-persistence by type */
    nonPersistedReasons,

    /** Check if a type should be persisted */
    isPersistedType: (type: string): boolean => persistedTypes.includes(type),

    /** Get schema for a type (undefined if not persisted) */
    getSchema: (type: string): z.ZodSchema | undefined => schemas[type],

    /** Check if a type is registered */
    isValidType: (type: string): boolean => types.includes(type),

    /** Validate node data against its schema */
    validateNodeData: (type: string, data: unknown): { success: boolean; error?: string } => {
      const schema = schemas[type];
      if (!schema) {
        return { success: true }; // No schema means no validation needed
      }
      const result = schema.safeParse(data);
      if (result.success) {
        return { success: true };
      }
      return {
        success: false,
        error: result.error.message,
      };
    },
  };
}

// =============================================================================
// Export Registry Instance
// =============================================================================

export const nodeRegistry = createNodeRegistry(NODE_CONFIGS);

/** Union type of all registered node types */
export type NodeType = (typeof nodeRegistry.types)[number];

/**
 * Node Data Schemas
 *
 * Zod schemas for validating node data during persistence.
 * These schemas ensure data integrity when saving/loading canvas state.
 */

import { z } from 'zod';

// =============================================================================
// Attachment Schemas
// =============================================================================

const LinearIssueAttachmentSchema = z.object({
  type: z.literal('linear-issue'),
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  url: z.string(),
  state: z.object({
    name: z.string(),
    color: z.string(),
  }).optional(),
  priority: z.object({
    label: z.string(),
    priority: z.number(),
  }).optional(),
  assignee: z.object({
    name: z.string(),
    avatarUrl: z.string().optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const WorkspaceMetadataAttachmentSchema = z.object({
  type: z.literal('workspace-metadata'),
  id: z.string(),
  path: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  gitRepo: z.string().optional(),
  projectType: z.string().optional(),
  git: z.object({
    branch: z.string(),
    remote: z.string().optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const TerminalAttachmentSchema = z.discriminatedUnion('type', [
  LinearIssueAttachmentSchema,
  WorkspaceMetadataAttachmentSchema,
]);

// =============================================================================
// Node Data Schemas
// =============================================================================

/**
 * Schema for CustomNode data
 */
export const CustomNodeDataSchema = z.object({
  label: z.string().optional(),
}).passthrough(); // Allow additional properties

/**
 * Schema for TerminalNode data
 */
export const TerminalNodeDataSchema = z.object({
  terminalId: z.string(),
  attachments: z.array(TerminalAttachmentSchema).optional(),
  // Legacy support
  issue: z.object({
    id: z.string().optional(),
    identifier: z.string(),
    title: z.string(),
    url: z.string(),
  }).optional(),
});

/**
 * Schema for WorkspaceNode data
 */
export const WorkspaceNodeDataSchema = z.object({
  path: z.string(),
  name: z.string().optional(),
  projectType: z.string().optional(),
});

/**
 * Schema for AgentNode data
 */
export const AgentNodeDataSchema = z.object({
  agentId: z.string(),
  terminalId: z.string(),
  agentType: z.string(),
  status: z.string(),
  statusInfo: z.record(z.unknown()).optional(),
  title: z.object({
    value: z.string(),
    isManuallySet: z.boolean(),
  }),
  summary: z.string().nullable(),
  progress: z.record(z.unknown()).nullable(),
  attachments: z.array(TerminalAttachmentSchema).optional(),
  activeView: z.enum(['overview', 'terminal']).optional(),
  conversationId: z.string().optional(),
});

/**
 * Schema for MessageNode data
 */
export const MessageNodeDataSchema = z.object({
  conversationId: z.string(),
  message: z.string(),
  role: z.enum(['user', 'assistant']),
  timestamp: z.string(),
  agentNodeId: z.string(), // Reference to the parent agent node
});

// =============================================================================
// Inferred Types
// =============================================================================

export type CustomNodeData = z.infer<typeof CustomNodeDataSchema>;
export type TerminalNodeData = z.infer<typeof TerminalNodeDataSchema>;
export type WorkspaceNodeData = z.infer<typeof WorkspaceNodeDataSchema>;
export type AgentNodeData = z.infer<typeof AgentNodeDataSchema>;
export type MessageNodeData = z.infer<typeof MessageNodeDataSchema>;
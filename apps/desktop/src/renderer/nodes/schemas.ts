/**
 * Node Data Schemas
 *
 * Zod schemas for validating node data during persistence.
 * These schemas ensure data integrity when saving/loading canvas state.
 */

import { z } from 'zod';
import type { CodingAgentMessage } from '@agent-orchestrator/shared';

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

// TerminalAttachment is now only LinearIssueAttachment
// Workspace metadata is stored directly in AgentNodeData.workspacePath
const TerminalAttachmentSchema = LinearIssueAttachmentSchema;

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
 * Schema for CodingAgentMessage data (must be before AgentNodeDataSchema)
 */
export const ChatMessageSchema: z.ZodType<CodingAgentMessage> = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  contentBlocks: z.array(z.unknown()).optional(),
  timestamp: z.string(),
  messageType: z.string().optional(),
});

/**
 * Schema for GitInfo
 */
const GitInfoSchema = z.object({
  branch: z.string().optional(),
  remote: z.string().optional(),
  status: z.string().optional(),
}).nullable();

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
  activeView: z.enum(['overview', 'terminal', 'chat']).optional(),
  conversationId: z.string().optional(),
  initialPrompt: z.string().optional(),
  sessionId: z.string().optional(),
  chatMessages: z.array(ChatMessageSchema).optional(),
  forking: z.boolean().optional(),
  // Workspace - single source of truth
  workspacePath: z.string().optional(),
  gitInfo: GitInfoSchema.optional(),
  workingDirectory: z.string().optional(),
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

/**
 * Schema for ConversationNode data
 */
export const ConversationNodeDataSchema = z.object({
  sessionId: z.string(),
  agentType: z.string(),
  title: z.string(),
  projectName: z.string().optional(),
  messageCount: z.number().optional(),
  timestamp: z.string().optional(),
  isExpanded: z.boolean().optional(),
});

/**
 * Schema for AgentChatNode data
 */
export const AgentChatNodeDataSchema = z.object({
  sessionId: z.string().optional(),
  agentType: z.string(),
  workspacePath: z.string().optional(),
  title: z.string().optional(),
  isExpanded: z.boolean().optional(),
  messages: z.array(ChatMessageSchema),
  isDraft: z.boolean(),
});

// =============================================================================
// Inferred Types
// =============================================================================

export type CustomNodeData = z.infer<typeof CustomNodeDataSchema>;
export type TerminalNodeData = z.infer<typeof TerminalNodeDataSchema>;
export type WorkspaceNodeData = z.infer<typeof WorkspaceNodeDataSchema>;
export type AgentNodeData = z.infer<typeof AgentNodeDataSchema>;
export type MessageNodeData = z.infer<typeof MessageNodeDataSchema>;
export type ConversationNodeData = z.infer<typeof ConversationNodeDataSchema>;
export type AgentChatNodeData = z.infer<typeof AgentChatNodeDataSchema>;

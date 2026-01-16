/**
 * Attachment Type Definitions
 *
 * Re-exports all attachment types from @agent-orchestrator/shared.
 * This file is kept for backwards compatibility with existing imports.
 */

export type {
  BaseAttachment,
  LinearIssueAttachment,
  WorkspaceMetadataAttachment,
  TerminalAttachment,
} from '@agent-orchestrator/shared';

export {
  isLinearIssueAttachment,
  isWorkspaceMetadataAttachment,
  createLinearIssueAttachment,
  createWorkspaceMetadataAttachment,
} from '@agent-orchestrator/shared';

/**
 * Attachment Type Definitions
 *
 * Re-exports all attachment types from @agent-orchestrator/shared.
 * This file is kept for backwards compatibility with existing imports.
 */

export type {
  BaseAttachment,
  LinearIssueAttachment,
  TerminalAttachment,
  WorkspaceMetadataAttachment,
} from '@agent-orchestrator/shared';

export {
  createLinearIssueAttachment,
  createWorkspaceMetadataAttachment,
  isLinearIssueAttachment,
  isWorkspaceMetadataAttachment,
} from '@agent-orchestrator/shared';

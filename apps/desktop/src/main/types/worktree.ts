/**
 * Worktree Type Definitions
 *
 * Re-exports worktree types from @agent-orchestrator/shared.
 * This file is kept for backwards compatibility with existing imports.
 *
 * Note: WorktreeRow is kept local as it's a database-specific mapping.
 */

export type {
  BranchInfo,
  OpenExistingBranchErrorCode,
  OpenExistingBranchOptions,
  OpenExistingBranchResult,
  WorktreeInfo,
  WorktreeManagerConfig,
  WorktreeProvisionOptions,
  WorktreeReleaseOptions,
  WorktreeStatus,
} from '@agent-orchestrator/shared';

export { OpenExistingBranchError } from '@agent-orchestrator/shared';

import type { WorktreeStatus } from '@agent-orchestrator/shared';

/**
 * Database row representation of a worktree.
 * This is specific to SQLite storage and maps to the worktrees table.
 */
export interface WorktreeRow {
  id: string;
  repo_path: string;
  worktree_path: string;
  branch_name: string;
  status: WorktreeStatus;
  provisioned_at: string;
  last_activity_at: string;
  agent_id: string | null;
  error_message: string | null;
}

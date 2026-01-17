/**
 * Fork Service
 *
 * Orchestrates fork operations by coordinating worktree creation
 * and session forking. Handles rollback if session fork fails.
 *
 * This is a boundary service that uses window.codingAgentAPI directly
 * for communicating with the main process. It handles the translation
 * between Result types from the main process and the ForkResult/ForkError
 * types used by the renderer layer.
 */

import type { CodingAgentType, SessionInfo, ForkOptions } from '../../main/services/coding-agent';
import type { WorktreeInfo } from '../../main/types/worktree';
import type { AgentType, JsonlFilterOptions } from '@agent-orchestrator/shared';
import { worktreeService } from './WorktreeService';
import { sessionProvider } from './SessionProvider';

/**
 * Supported agent types for forking
 */
const FORKABLE_AGENT_TYPES: CodingAgentType[] = ['claude_code', 'cursor', 'codex'];

/**
 * Check if an agent type supports fork operations
 */
function isForkableAgentType(agentType: AgentType): agentType is CodingAgentType {
  return FORKABLE_AGENT_TYPES.includes(agentType as CodingAgentType);
}

/**
 * Request to fork an agent session
 */
export interface ForkRequest {
  /** Source agent ID for tracking */
  sourceAgentId: string;
  /** Session ID to fork from */
  sessionId: string;
  /** Type of agent (must be claude_code, cursor, or codex for fork support) */
  agentType: AgentType;
  /** User-provided title for the fork (used in branch name) */
  forkTitle: string;
  /** Path to the source repository */
  repoPath: string;
  /** Optional filter to include only messages up to a specific point */
  filterOptions?: JsonlFilterOptions;
  /**
   * Whether to create a new git worktree for the fork.
   * - true (default): Fork Handle Button behavior - creates isolated worktree
   * - false: Text Selection Fork behavior - stays in same workspace
   */
  createWorktree?: boolean;
}

/**
 * Result of a successful fork operation
 */
export interface ForkResult {
  /** Worktree information (only present if createWorktree=true) */
  worktreeInfo?: WorktreeInfo;
  /** Forked session information */
  sessionInfo: SessionInfo;
}

/**
 * Error types for fork operations
 */
export type ForkErrorType =
  | 'WORKTREE_CREATION_FAILED'
  | 'SESSION_FORK_FAILED'
  | 'API_NOT_AVAILABLE'
  | 'VALIDATION_FAILED';

/**
 * Fork operation error
 */
export interface ForkError {
  type: ForkErrorType;
  message: string;
}

/**
 * Interface for fork operations
 */
export interface IForkService {
  /**
   * Fork an agent session with worktree isolation
   * @param request - Fork request parameters
   * @returns Fork result or error
   */
  forkAgent(request: ForkRequest): Promise<{ success: true; data: ForkResult } | { success: false; error: ForkError }>;

  /**
   * Validate if fork can proceed
   * @param sessionId - Session ID to check
   * @param repoPath - Repository path to check
   * @returns Validation result with error message if invalid
   */
  validateForkRequest(
    sessionId: string | undefined,
    repoPath: string | undefined
  ): { valid: true } | { valid: false; error: string };

  /**
   * Auto-detect the latest session for a workspace
   * @param agentType - Type of agent (only claude_code, cursor, codex supported)
   * @param workspacePath - Workspace path to search
   * @returns Session info or null if not found or unsupported agent
   */
  getLatestSessionForWorkspace(
    agentType: AgentType,
    workspacePath: string
  ): Promise<{ id: string; updatedAt: string } | null>;
}

/**
 * Sanitize fork title into a valid branch name
 */
function sanitizeBranchName(title: string): string {
  // Convert to lowercase, replace spaces and special chars with hyphens
  const sanitized = title
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // Add timestamp for uniqueness
  const timestamp = Date.now();
  return `fork-${sanitized || 'unnamed'}-${timestamp}`;
}

/**
 * Fork service implementation
 */
export class ForkService implements IForkService {
  /**
   * Validate if fork can proceed
   */
  validateForkRequest(
    sessionId: string | undefined,
    repoPath: string | undefined
  ): { valid: true } | { valid: false; error: string } {
    if (!sessionId) {
      return { valid: false, error: 'Start a session before forking' };
    }
    if (!repoPath) {
      return { valid: false, error: 'Attach a workspace before forking' };
    }
    return { valid: true };
  }

  /**
   * Auto-detect the latest session for a workspace
   * Delegates to the session provider (file-based now, hooks-based in future)
   */
  async getLatestSessionForWorkspace(
    agentType: AgentType,
    workspacePath: string
  ): Promise<{ id: string; updatedAt: string } | null> {
    const result = await sessionProvider.getActiveSession(agentType, workspacePath);
    console.log('[ForkService] Session lookup via provider:', { workspacePath, result });
    return result;
  }

  /**
   * Fork an agent session
   *
   * Two modes based on createWorktree flag:
   * - createWorktree=true (default): Creates worktree, then forks session to new path
   * - createWorktree=false: Forks session in same workspace without worktree
   */
  async forkAgent(
    request: ForkRequest
  ): Promise<{ success: true; data: ForkResult } | { success: false; error: ForkError }> {
    console.log('[ForkService] Starting fork operation:', request);

    // Validate agent type supports forking
    if (!isForkableAgentType(request.agentType)) {
      return {
        success: false,
        error: {
          type: 'VALIDATION_FAILED',
          message: `Agent type '${request.agentType}' does not support forking`,
        },
      };
    }

    // Check API availability
    if (!window.codingAgentAPI) {
      return {
        success: false,
        error: {
          type: 'API_NOT_AVAILABLE',
          message: 'Coding agent API not available',
        },
      };
    }

    // Validate request
    const validation = this.validateForkRequest(request.sessionId, request.repoPath);
    if (!validation.valid) {
      return {
        success: false,
        error: {
          type: 'VALIDATION_FAILED',
          message: validation.error,
        },
      };
    }

    // Determine fork mode (default to creating worktree for backward compatibility)
    const shouldCreateWorktree = request.createWorktree !== false;

    if (shouldCreateWorktree) {
      // WORKTREE PATH: Fork Handle Button behavior
      return this.forkWithWorktree(request);
    } else {
      // NON-WORKTREE PATH: Text Selection Fork behavior
      return this.forkWithoutWorktree(request);
    }
  }

  /**
   * Fork with worktree creation (Fork Handle Button behavior)
   */
  private async forkWithWorktree(
    request: ForkRequest
  ): Promise<{ success: true; data: ForkResult } | { success: false; error: ForkError }> {
    if (!window.worktreeAPI) {
      return {
        success: false,
        error: {
          type: 'API_NOT_AVAILABLE',
          message: 'Worktree API not available',
        },
      };
    }

    // Step 1: Create worktree
    const branchName = sanitizeBranchName(request.forkTitle);
    console.log('[ForkService] Creating worktree with branch:', branchName);

    const worktreeResult = await worktreeService.createWorktree(request.repoPath, branchName, {
      agentId: request.sourceAgentId,
    });

    if (!worktreeResult.success || !worktreeResult.worktreeId) {
      return {
        success: false,
        error: {
          type: 'WORKTREE_CREATION_FAILED',
          message: worktreeResult.error || 'Failed to create worktree',
        },
      };
    }

    // Step 2: Get worktree info
    const worktreeInfo = await window.worktreeAPI.get(worktreeResult.worktreeId);
    if (!worktreeInfo) {
      return {
        success: false,
        error: {
          type: 'WORKTREE_CREATION_FAILED',
          message: 'Worktree info not found after creation',
        },
      };
    }

    // Step 3: Fork the session to the worktree path
    console.log('[ForkService] Forking session to worktree:', request.sessionId);

    const forkOptions: ForkOptions = {
      sessionId: request.sessionId,
      newSessionName: request.forkTitle,
      workspacePath: worktreeInfo.worktreePath,
      filterOptions: request.filterOptions,
      createWorktree: true,
    };

    console.log('[ForkService] Fork options:', forkOptions);

    const result = await window.codingAgentAPI!.forkSession(request.agentType, forkOptions);

    if (!result.success) {
      // Rollback: release the worktree if session fork failed
      console.error('[ForkService] Session fork failed, rolling back worktree:', result.error);

      try {
        await worktreeService.releaseWorktree(worktreeResult.worktreeId, { deleteBranch: true });
        console.log('[ForkService] Worktree rolled back successfully');
      } catch (rollbackError) {
        console.error('[ForkService] Failed to rollback worktree:', rollbackError);
      }

      return {
        success: false,
        error: {
          type: 'SESSION_FORK_FAILED',
          message: result.error.message,
        },
      };
    }

    console.log('[ForkService] Session forked successfully:', result.data);

    return {
      success: true,
      data: {
        worktreeInfo,
        sessionInfo: result.data,
      },
    };
  }

  /**
   * Fork without worktree creation (Text Selection Fork behavior)
   */
  private async forkWithoutWorktree(
    request: ForkRequest
  ): Promise<{ success: true; data: ForkResult } | { success: false; error: ForkError }> {
    console.log('[ForkService] Forking session in same workspace:', request.sessionId);

    const forkOptions: ForkOptions = {
      sessionId: request.sessionId,
      newSessionName: request.forkTitle,
      workspacePath: request.repoPath, // Stay in same workspace
      filterOptions: request.filterOptions,
      createWorktree: false,
    };

    console.log('[ForkService] Fork options:', forkOptions);

    const result = await window.codingAgentAPI!.forkSession(request.agentType, forkOptions);

    if (!result.success) {
      return {
        success: false,
        error: {
          type: 'SESSION_FORK_FAILED',
          message: result.error.message,
        },
      };
    }

    console.log('[ForkService] Session forked successfully:', result.data);

    return {
      success: true,
      data: {
        sessionInfo: result.data,
        // No worktreeInfo for non-worktree forks
      },
    };
  }
}

/**
 * Singleton instance
 */
export const forkService: IForkService = new ForkService();

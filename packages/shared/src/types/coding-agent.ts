/**
 * Coding Agent Type Definitions
 *
 * Unified status types derived from Claude Code and Cursor coding agents.
 * These are the canonical definitions used across the monorepo.
 */

import type { AgentType } from '../loaders/types.js';

// =============================================================================
// Status Types
// =============================================================================

/**
 * All possible status states for a coding agent.
 * Unified from Claude Code (thinking, executing_tool, awaiting_input) and
 * Cursor (idle, running, streaming, paused, completed, error).
 */
export type CodingAgentStatus =
  | 'idle' // Waiting for user input
  | 'running' // Actively processing a task
  | 'thinking' // Deep reasoning/planning mode
  | 'streaming' // Generating output in real-time
  | 'executing_tool' // Running a tool (bash, read, write, etc.)
  | 'awaiting_input' // Waiting for user response/permission
  | 'paused' // Temporarily suspended
  | 'completed' // Task finished
  | 'error'; // Error occurred

/**
 * Categories of tools that can be executed by a coding agent.
 */
export type ToolType =
  | 'bash'
  | 'read'
  | 'write'
  | 'edit'
  | 'search'
  | 'lsp'
  | 'fetch'
  | 'mcp'
  | 'unknown';

// =============================================================================
// Status Info
// =============================================================================

/**
 * Detailed status information with contextual data.
 */
export interface CodingAgentStatusInfo {
  /** Current status of the agent */
  status: CodingAgentStatus;

  /** Name of the tool being executed (when status is 'executing_tool') */
  toolName?: string;

  /** Category of the tool (when status is 'executing_tool') */
  toolType?: ToolType;

  /** Error message (when status is 'error') */
  errorMessage?: string;

  /** Name of subagent running (e.g., 'Plan Agent', 'Explore Agent') */
  subagentName?: string;

  /** Timestamp when this status was set */
  startedAt: number;
}

// =============================================================================
// Title Configuration
// =============================================================================

/**
 * Title configuration with manual/computed tracking.
 */
export interface TitleConfig {
  /** The title value */
  value: string;

  /** Whether the title was manually set by user */
  isManuallySet: boolean;

  /** First N user messages used for automatic computation (if not manual) */
  computedFrom?: string[];
}

// =============================================================================
// Full Agent State
// =============================================================================

/**
 * Complete state of a coding agent including status, title, and summary.
 */
export interface CodingAgentState {
  /** Unique identifier for the agent */
  agentId: string;

  /** Type of coding agent */
  agentType: AgentType;

  /** Current status with context */
  statusInfo: CodingAgentStatusInfo;

  /** Title configuration */
  title: TitleConfig;

  /** Short computed summary of the agent's task */
  summary: string | null;

  /** Timestamp when agent was registered */
  createdAt: number;

  /** Timestamp of last state update */
  updatedAt: number;
}

// Re-export AgentType for convenience
export type { AgentType } from '../loaders/types.js';

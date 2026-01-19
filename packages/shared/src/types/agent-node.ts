/**
 * Agent Node Type Definitions
 *
 * Types for the AgentNode component that wraps overview and terminal views.
 * Uses discriminated unions for type-safe progress tracking.
 */

import type { CodingAgentMessage, GitInfo } from '../types.js';
import type { TerminalAttachment } from './attachments.js';
import type { AgentType, CodingAgentStatus, CodingAgentStatusInfo } from './coding-agent.js';

// =============================================================================
// Permission Mode
// =============================================================================

/**
 * Permission mode for agent operations
 * - 'plan': Deny all operations (restrictive) - plan first, execute later
 * - 'auto-accept': Allow all operations (permissive) - auto-approve tools
 * - 'ask': Prompt for each operation (interactive) - ask before each tool
 */
export type PermissionMode = 'plan' | 'auto-accept' | 'ask';

// =============================================================================
// Progress Variants (Discriminated Union)
// =============================================================================

/**
 * Base interface for progress tracking
 */
export interface BaseProgress {
  /** Discriminator field for type-safe unions */
  type: string;
}

/**
 * Percentage-based progress (e.g., "45%")
 */
export interface PercentageProgress extends BaseProgress {
  type: 'percentage';
  /** Progress value from 0 to 100 */
  value: number;
  /** Optional label describing what's being measured */
  label?: string;
}

/**
 * Individual todo item for checklist progress
 */
export interface TodoItem {
  /** Unique identifier for the todo */
  id: string;
  /** Description of the task */
  content: string;
  /** Whether the task is completed */
  completed: boolean;
  /** Optional active/in-progress form of the description */
  activeForm?: string;
}

/**
 * Todo list progress (checklist with checkmarks)
 */
export interface TodoListProgress extends BaseProgress {
  type: 'todoList';
  /** List of todo items */
  items: TodoItem[];
  /** Optional title for the todo list */
  title?: string;
}

/**
 * Union type of all progress variants
 */
export type AgentProgress = PercentageProgress | TodoListProgress;

// =============================================================================
// Type Guards for Progress
// =============================================================================

/**
 * Type guard to check if progress is percentage-based
 */
export function isPercentageProgress(progress: AgentProgress): progress is PercentageProgress {
  return progress.type === 'percentage';
}

/**
 * Type guard to check if progress is todo list based
 */
export function isTodoListProgress(progress: AgentProgress): progress is TodoListProgress {
  return progress.type === 'todoList';
}

// =============================================================================
// Agent Title
// =============================================================================

/**
 * Title configuration with manual/computed tracking
 */
export interface AgentTitle {
  /** The display title */
  value: string;
  /** Whether manually edited by user */
  isManuallySet: boolean;
}

// =============================================================================
// Agent Node View
// =============================================================================

/**
 * View mode for the agent node
 */
export type AgentNodeView = 'overview' | 'terminal' | 'chat';

/**
 * Chat message structure for agent chat view
 */
export type AgentChatMessage = CodingAgentMessage;

// =============================================================================
// Agent Node Data
// =============================================================================

/**
 * Data structure for AgentNode (passed via NodeProps)
 * This is the canonical definition used across the monorepo.
 */
export interface AgentNodeData {
  /** Unique agent identifier (links to CodingAgentStatusManager) */
  agentId: string;

  /** Terminal ID for the embedded terminal */
  terminalId: string;

  /** Agent type */
  agentType: AgentType;

  /** Current agent status */
  status: CodingAgentStatus;

  /** Detailed status info */
  statusInfo?: CodingAgentStatusInfo;

  /** Title configuration */
  title: AgentTitle;

  /** Short summary of current task */
  summary: string | null;

  /** Progress tracking (percentage or todo list) */
  progress: AgentProgress | null;

  /** Attached metadata (Linear tickets, workspace info, etc.) */
  attachments?: TerminalAttachment[];

  /** Current active view */
  activeView?: AgentNodeView;

  /** Timestamp when agent node was created (for matching to conversation files) */
  createdAt?: number;

  /** Vendor-specific session identifier for resume/fork operations */
  sessionId?: string;

  /** Parent session ID if this agent was forked */
  parentSessionId?: string;

  /** Worktree ID if agent runs in isolated worktree */
  worktreeId?: string;

  /** Workspace path - single source of truth for agent workspace (worktree path or original repo) */
  workspacePath: string;

  /** Git info for the workspace (required - only git directories allowed) */
  gitInfo: GitInfo;

  /** Initial prompt to send to the agent when it starts */
  initialPrompt?: string;

  /** Initial text to populate in the chat input field (not auto-sent) */
  initialInputText?: string;

  /** Whether the JSONL file exists (for forking capability) */
  forking?: boolean;

  /** Permission mode for this agent (overrides global default) */
  permissionMode?: PermissionMode;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a default agent title
 */
export function createDefaultAgentTitle(value = 'Untitled Agent'): AgentTitle {
  return {
    value,
    isManuallySet: false,
  };
}

/**
 * Create a percentage progress object
 */
export function createPercentageProgress(value: number, label?: string): PercentageProgress {
  return {
    type: 'percentage',
    value: Math.min(100, Math.max(0, value)),
    label,
  };
}

/**
 * Create a todo list progress object
 */
export function createTodoListProgress(
  items: Omit<TodoItem, 'id'>[],
  title?: string
): TodoListProgress {
  return {
    type: 'todoList',
    items: items.map((item, index) => ({
      ...item,
      id: `todo-${index}-${Date.now()}`,
    })),
    title,
  };
}

/**
 * Calculate completion percentage from todo list
 */
export function getTodoListCompletionPercent(progress: TodoListProgress): number {
  if (progress.items.length === 0) return 0;
  const completed = progress.items.filter((item) => item.completed).length;
  return Math.round((completed / progress.items.length) * 100);
}

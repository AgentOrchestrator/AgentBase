/**
 * Vendor-agnostic event types for coding agent hooks
 *
 * This module defines abstract event categories that map to specific
 * agent implementations (Claude Code, Codex, etc.) via adapters.
 */

import type { AgentType, ToolCategory } from '../loaders/types.js';

// =============================================================================
// VENDOR-AGNOSTIC EVENT TYPES
// =============================================================================

/**
 * Abstract event categories representing concepts common across all coding agents
 */
export type AgentEventCategory =
  | 'session' // Session lifecycle: start/end/pause/resume
  | 'user_input' // User provides input/prompt
  | 'agent_output' // Agent generates text/thinking/reasoning
  | 'tool' // Tool invocation lifecycle
  | 'permission' // Permission request/approval/denial
  | 'delegation' // Subagent spawn/completion
  | 'context' // Context compaction/memory operations
  | 'system'; // Notifications, errors, interrupts

/**
 * Valid event types - explicit list to avoid invalid combinations
 * Format: 'category:action' (e.g., 'session:start', 'permission:request')
 */
export type AgentEventType =
  // Session lifecycle
  | 'session:start'
  | 'session:end'
  | 'session:pause'
  | 'session:resume'
  // User input
  | 'user_input:complete'
  // Agent output
  | 'agent_output:delta'
  | 'agent_output:complete'
  // Tool execution
  | 'tool:begin'
  | 'tool:output'
  | 'tool:complete'
  | 'tool:error'
  // Permission
  | 'permission:request'
  | 'permission:approve'
  | 'permission:deny'
  // Delegation (subagents)
  | 'delegation:start'
  | 'delegation:end'
  // Context management
  | 'context:compact'
  // System events
  | 'system:info'
  | 'system:warning'
  | 'system:error';

// =============================================================================
// CORE EVENT INTERFACE
// =============================================================================

/**
 * Base interface for all agent events
 *
 * Context fields (agentId, sessionId, workspacePath, gitBranch) are REQUIRED
 * to ensure proper event routing and context preservation.
 */
export interface AgentEvent<T = unknown> {
  /** Unique event identifier */
  id: string;

  /** Event type in category:action format */
  type: AgentEventType;

  /** Agent that emitted the event */
  agent: AgentType;

  /** Agent node identifier - REQUIRED for routing to correct terminal */
  agentId: string;

  /** Session identifier - REQUIRED for response routing */
  sessionId: string;

  /** Workspace/project path - REQUIRED for context */
  workspacePath: string;

  /** Git branch - REQUIRED for context display */
  gitBranch: string;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** Event-specific payload */
  payload: T;

  /** Vendor-specific raw data (for debugging/advanced use) */
  raw?: unknown;
}

// =============================================================================
// PAYLOAD TYPES BY CATEGORY
// =============================================================================

/**
 * Payload for session lifecycle events (session:start, session:end, etc.)
 */
export interface SessionPayload {
  /** Session identifier */
  sessionId: string;

  /** Workspace/project path */
  workspacePath?: string;

  /** Agent version string */
  agentVersion?: string;

  /** Reason for session end (completed, interrupted, error) */
  reason?: string;
}

/**
 * Payload for user input events
 */
export interface UserInputPayload {
  /** User's input content */
  content: string;

  /** Whether input includes file references */
  hasFiles?: boolean;

  /** Referenced file paths */
  fileRefs?: string[];
}

/**
 * Payload for agent output events (streaming text, thinking, etc.)
 */
export interface AgentOutputPayload {
  /** Output content */
  content: string;

  /** Type of output */
  outputType: 'text' | 'thinking' | 'reasoning' | 'code';

  /** Whether this is a streaming delta */
  isStreaming?: boolean;
}

/**
 * Payload for tool execution events
 */
export interface ToolPayload {
  /** Tool name (e.g., 'Bash', 'Read', 'Write') */
  toolName: string;

  /** Tool category for filtering */
  toolCategory: ToolCategory;

  /** Tool input parameters */
  input?: Record<string, unknown>;

  /** Tool output */
  output?: unknown;

  /** Execution status */
  status?: 'pending' | 'running' | 'success' | 'error';

  /** Execution duration in milliseconds */
  duration?: number;

  /** Error message if status is 'error' */
  error?: string;
}

/**
 * Payload for permission request/response events
 * This is the key payload for auto-approve/deny functionality
 */
export interface PermissionPayload {
  /** Tool requesting permission */
  toolName: string;

  /** Command to execute (for shell tools) */
  command?: string;

  /** Command arguments */
  args?: string[];

  /** File path being accessed */
  filePath?: string;

  /** Working directory */
  workingDirectory?: string;

  /** Human-readable reason for the request */
  reason?: string;

  /** Decision made (for response events) */
  decision?: 'allow' | 'deny' | 'ask';

  /** Who/what made the decision */
  decidedBy?: 'user' | 'policy' | 'timeout';

  /** Raw terminal prompt text (for parsing) */
  rawPrompt?: string;
}

/**
 * Payload for delegation/subagent events
 */
export interface DelegationPayload {
  /** Subagent identifier */
  subagentId: string;

  /** Type of subagent */
  subagentType?: string;

  /** Task assigned to subagent */
  task?: string;

  /** Transcript on completion */
  transcript?: string;
}

/**
 * Payload for context management events
 */
export interface ContextPayload {
  /** Type of context operation */
  operation: 'compact' | 'summarize' | 'clear';

  /** Token count before operation */
  tokensBefore?: number;

  /** Token count after operation */
  tokensAfter?: number;
}

/**
 * Payload for system events (notifications, errors, etc.)
 */
export interface SystemPayload {
  /** Severity level */
  level: 'info' | 'warning' | 'error';

  /** Message content */
  message: string;

  /** Error/notification code */
  code?: string;
}

// =============================================================================
// HANDLER TYPES
// =============================================================================

/**
 * Result returned by event handlers
 */
export interface EventResult {
  /** Action to take */
  action: 'allow' | 'deny' | 'continue' | 'modify' | 'ask';

  /** Optional message explaining the decision */
  message?: string;

  /** Modified payload (when action is 'modify') */
  modifiedPayload?: unknown;
}

/**
 * Event handler function type
 */
export type EventHandler<T = unknown> = (
  event: AgentEvent<T>
) => Promise<EventResult> | EventResult;

/**
 * Unsubscribe function returned by event registration
 */
export type UnsubscribeFn = () => void;

// =============================================================================
// VENDOR EVENT MAPPING REFERENCE
// =============================================================================
//
// Claude Code Hooks → Abstract Events:
//   SessionStart      → session:start
//   SessionEnd        → session:end
//   UserPromptSubmit  → user_input:complete
//   PreToolUse        → tool:begin
//   PostToolUse       → tool:complete
//   PermissionRequest → permission:request
//   SubagentStart     → delegation:start
//   SubagentStop      → delegation:end
//   PreCompact        → context:compact
//   Stop              → session:end
//   Notification      → system:info
//
// Codex Events → Abstract Events:
//   Op::UserInput           → user_input:complete
//   Op::ExecApproval        → permission:approve / permission:deny
//   Op::Interrupt           → session:pause
//   Op::Compact             → context:compact
//   Event::AgentMessageDelta    → agent_output:delta
//   Event::AgentThinkingDelta   → agent_output:delta (outputType: thinking)
//   Event::ExecApprovalRequest  → permission:request
//   Event::ExecCommandBegin     → tool:begin
//   Event::ExecOutputDelta      → tool:output
//   Event::ExecCommandEnd       → tool:complete
//   Event::TurnComplete         → agent_output:complete

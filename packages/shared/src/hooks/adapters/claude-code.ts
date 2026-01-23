/**
 * Claude Code Adapter
 *
 * Translates Claude Code hooks into vendor-agnostic AgentEvents.
 *
 * Claude Code exposes 11 hooks:
 * - SessionStart, SessionEnd, UserPromptSubmit
 * - PreToolUse, PostToolUse, PermissionRequest
 * - SubagentStart, SubagentStop, PreCompact
 * - Stop, Notification
 */

// Use globalThis.crypto for cross-platform UUID generation (Node.js 19+ and browsers)
const randomUUID = (): string => globalThis.crypto.randomUUID();

import type { AgentType } from '../../loaders/types.js';
import type {
  AgentEvent,
  AgentEventType,
  ContextPayload,
  DelegationPayload,
  PermissionPayload,
  SessionPayload,
  SystemPayload,
  ToolPayload,
  UserInputPayload,
} from '../types.js';
import type { IAgentAdapter } from './base.js';

// =============================================================================
// CLAUDE CODE HOOK TYPES
// =============================================================================

/**
 * Claude Code hook event names
 */
export type ClaudeCodeHookEvent =
  | 'SessionStart'
  | 'SessionEnd'
  | 'UserPromptSubmit'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PermissionRequest'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'PreCompact'
  | 'Stop'
  | 'Notification';

/**
 * Raw Claude Code hook data format
 */
export interface ClaudeCodeHookData {
  event: ClaudeCodeHookEvent;
  session_id?: string;
  timestamp?: string;

  // Tool-related fields
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: unknown;

  // Permission-related fields
  command?: string;
  args?: string[];
  file_path?: string;
  working_directory?: string;

  // Subagent-related fields
  subagent_id?: string;
  subagent_type?: string;
  task?: string;
  transcript?: string;

  // Context-related fields
  tokens_before?: number;
  tokens_after?: number;

  // Notification/system fields
  level?: 'info' | 'warning' | 'error';
  message?: string;
  code?: string;

  // User input fields
  content?: string;
  file_refs?: string[];

  // Session fields
  workspace_path?: string;
  agent_version?: string;
  reason?: string;

  // Context fields (may be provided by orchestrator)
  agent_id?: string;
  git_branch?: string;
}

// =============================================================================
// EVENT TYPE MAPPING
// =============================================================================

/**
 * Map Claude Code hook events to vendor-agnostic event types
 */
const CLAUDE_CODE_EVENT_MAP: Record<ClaudeCodeHookEvent, AgentEventType> = {
  SessionStart: 'session:start',
  SessionEnd: 'session:end',
  UserPromptSubmit: 'user_input:complete',
  PreToolUse: 'tool:begin',
  PostToolUse: 'tool:complete',
  PermissionRequest: 'permission:request',
  SubagentStart: 'delegation:start',
  SubagentStop: 'delegation:end',
  PreCompact: 'context:compact',
  Stop: 'session:end',
  Notification: 'system:info',
};

// =============================================================================
// TERMINAL OUTPUT PATTERNS
// =============================================================================

/**
 * Regex patterns for detecting events in terminal output
 */
const TERMINAL_PATTERNS = {
  // Permission request pattern (Claude Code asks for permission)
  permissionRequest:
    /(?:Allow|Approve|Run|Execute)\s+(?:command|tool)?\s*[:\s]*["']?([^"'\n]+)["']?\s*\?/i,

  // Tool execution patterns
  toolBegin: /(?:Running|Executing|Using)\s+(?:tool\s+)?["']?(\w+)["']?/i,
  toolComplete: /(?:Completed|Finished|Done)\s+["']?(\w+)["']?/i,

  // Session patterns
  sessionStart: /(?:Session|Conversation)\s+(?:started|initialized)/i,
  sessionEnd: /(?:Session|Conversation)\s+(?:ended|completed|finished)/i,
};

// =============================================================================
// CLAUDE CODE ADAPTER
// =============================================================================

/**
 * Adapter for Claude Code hooks
 */
export class ClaudeCodeAdapter implements IAgentAdapter {
  readonly agentType: AgentType = 'claude_code';

  /**
   * Parse raw Claude Code hook data into an AgentEvent
   */
  parse(rawData: unknown): AgentEvent | null {
    if (!isClaudeCodeHookData(rawData)) {
      return null;
    }

    const eventType = this.mapEventType(rawData.event);
    if (!eventType) {
      return null;
    }

    // Validate required context fields - fail explicitly if missing
    if (!rawData.agent_id) {
      throw new Error(
        `[ClaudeCodeAdapter] agent_id is required in hook data for event ${rawData.event}`
      );
    }
    if (!rawData.session_id) {
      throw new Error(
        `[ClaudeCodeAdapter] session_id is required in hook data for event ${rawData.event}`
      );
    }
    if (!rawData.workspace_path) {
      throw new Error(
        `[ClaudeCodeAdapter] workspace_path is required in hook data for event ${rawData.event}`
      );
    }
    if (!rawData.git_branch) {
      throw new Error(
        `[ClaudeCodeAdapter] git_branch is required in hook data for event ${rawData.event}`
      );
    }

    const baseEvent = {
      id: randomUUID(),
      type: eventType,
      agent: this.agentType,
      agentId: rawData.agent_id,
      sessionId: rawData.session_id,
      workspacePath: rawData.workspace_path,
      gitBranch: rawData.git_branch,
      timestamp: rawData.timestamp ?? new Date().toISOString(),
      raw: rawData,
    };

    // Build payload based on event type
    const payload = this.buildPayload(rawData);

    return {
      ...baseEvent,
      payload,
    };
  }

  /**
   * Context required for parsing terminal output into events
   */
  /**
   * Parse terminal output to detect Claude Code events
   *
   * @param output - Terminal output to parse
   * @param context - Required context for building events (agentId, sessionId, workspacePath, gitBranch)
   */
  parseTerminalOutput(
    output: string,
    context: { agentId: string; sessionId: string; workspacePath: string; gitBranch: string }
  ): AgentEvent[] {
    const events: AgentEvent[] = [];
    const timestamp = new Date().toISOString();

    // Check for permission request
    const permissionMatch = output.match(TERMINAL_PATTERNS.permissionRequest);
    if (permissionMatch) {
      events.push({
        id: randomUUID(),
        type: 'permission:request',
        agent: this.agentType,
        agentId: context.agentId,
        sessionId: context.sessionId,
        workspacePath: context.workspacePath,
        gitBranch: context.gitBranch,
        timestamp,
        payload: {
          toolName: 'Bash',
          command: permissionMatch[1],
          rawPrompt: output,
        } as PermissionPayload,
      });
    }

    // Check for tool begin
    const toolBeginMatch = output.match(TERMINAL_PATTERNS.toolBegin);
    if (toolBeginMatch) {
      events.push({
        id: randomUUID(),
        type: 'tool:begin',
        agent: this.agentType,
        agentId: context.agentId,
        sessionId: context.sessionId,
        workspacePath: context.workspacePath,
        gitBranch: context.gitBranch,
        timestamp,
        payload: {
          toolName: toolBeginMatch[1],
          toolCategory: 'unknown',
        } as ToolPayload,
      });
    }

    return events;
  }

  /**
   * Map Claude Code event to AgentEventType
   */
  mapEventType(vendorType: string): AgentEventType | null {
    return CLAUDE_CODE_EVENT_MAP[vendorType as ClaudeCodeHookEvent] ?? null;
  }

  /**
   * Detect permission prompt from terminal output
   */
  detectPermissionPrompt(output: string): PermissionPayload | null {
    const match = output.match(TERMINAL_PATTERNS.permissionRequest);
    if (!match) {
      return null;
    }

    return {
      toolName: 'Bash',
      command: match[1],
      rawPrompt: output,
    };
  }

  /**
   * Build event payload based on hook type
   */
  private buildPayload(data: ClaudeCodeHookData): unknown {
    switch (data.event) {
      case 'SessionStart':
      case 'SessionEnd':
      case 'Stop':
        return {
          sessionId: data.session_id ?? '',
          workspacePath: data.workspace_path,
          agentVersion: data.agent_version,
          reason: data.reason,
        } satisfies SessionPayload;

      case 'UserPromptSubmit':
        return {
          content: data.content ?? '',
          hasFiles: (data.file_refs?.length ?? 0) > 0,
          fileRefs: data.file_refs,
        } satisfies UserInputPayload;

      case 'PreToolUse':
      case 'PostToolUse':
        return {
          toolName: data.tool_name ?? '',
          toolCategory: categorizeClaudeCodeTool(data.tool_name ?? ''),
          input: data.tool_input,
          output: data.tool_output,
          status: data.event === 'PostToolUse' ? 'success' : 'pending',
        } satisfies ToolPayload;

      case 'PermissionRequest':
        return {
          toolName: data.tool_name ?? 'Bash',
          command: data.command,
          args: data.args,
          filePath: data.file_path,
          workingDirectory: data.working_directory,
        } satisfies PermissionPayload;

      case 'SubagentStart':
      case 'SubagentStop':
        return {
          subagentId: data.subagent_id ?? '',
          subagentType: data.subagent_type,
          task: data.task,
          transcript: data.transcript,
        } satisfies DelegationPayload;

      case 'PreCompact':
        return {
          operation: 'compact',
          tokensBefore: data.tokens_before,
          tokensAfter: data.tokens_after,
        } satisfies ContextPayload;

      case 'Notification':
        return {
          level: data.level ?? 'info',
          message: data.message ?? '',
          code: data.code,
        } satisfies SystemPayload;

      default:
        return {};
    }
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type guard for ClaudeCodeHookData
 */
function isClaudeCodeHookData(data: unknown): data is ClaudeCodeHookData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'event' in data &&
    typeof (data as ClaudeCodeHookData).event === 'string'
  );
}

/**
 * Categorize Claude Code tool names to ToolCategory
 */
function categorizeClaudeCodeTool(
  toolName: string
): import('../types.js').ToolPayload['toolCategory'] {
  const lowerName = toolName.toLowerCase();

  if (['read', 'cat', 'head', 'tail'].some((t) => lowerName.includes(t))) {
    return 'file_read';
  }
  if (['write', 'edit', 'notebookedit'].some((t) => lowerName.includes(t))) {
    return 'file_write';
  }
  if (['glob', 'grep', 'search', 'find'].some((t) => lowerName.includes(t))) {
    return 'file_read'; // Search is read-only
  }
  if (['bash', 'shell', 'exec'].some((t) => lowerName.includes(t))) {
    return 'shell';
  }
  if (['web', 'fetch', 'websearch'].some((t) => lowerName.includes(t))) {
    return 'web';
  }
  if (['lsp', 'definition', 'reference'].some((t) => lowerName.includes(t))) {
    return 'code_intel';
  }
  if (lowerName.startsWith('mcp_')) {
    return 'mcp';
  }

  return 'unknown';
}

/**
 * Create a new Claude Code adapter instance
 */
export function createClaudeCodeAdapter(): ClaudeCodeAdapter {
  return new ClaudeCodeAdapter();
}

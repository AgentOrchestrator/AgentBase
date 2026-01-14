/**
 * Codex Adapter
 *
 * Translates Codex Op/Event system into vendor-agnostic AgentEvents.
 *
 * Codex uses two types of messages:
 * - Operations (Op): User-initiated actions (UserInput, ExecApproval, Interrupt, Compact)
 * - Events: Agent-emitted events (AgentMessageDelta, ExecApprovalRequest, etc.)
 */

import { randomUUID } from 'crypto';
import type { AgentType } from '../../loaders/types.js';
import type {
  AgentEvent,
  AgentEventType,
  SessionPayload,
  PermissionPayload,
  ToolPayload,
  ContextPayload,
  AgentOutputPayload,
  UserInputPayload,
} from '../types.js';
import type { IAgentAdapter } from './base.js';

// =============================================================================
// CODEX EVENT TYPES
// =============================================================================

/**
 * Codex Operation types (user-initiated)
 */
export type CodexOpType =
  | 'UserInput'
  | 'ExecApproval'
  | 'Interrupt'
  | 'Compact'
  | 'NewTurn';

/**
 * Codex Event types (agent-emitted)
 */
export type CodexEventType =
  | 'AgentMessageDelta'
  | 'AgentThinkingDelta'
  | 'ExecApprovalRequest'
  | 'ExecCommandBegin'
  | 'ExecOutputDelta'
  | 'ExecCommandEnd'
  | 'TurnComplete';

/**
 * Raw Codex Operation data
 */
export interface CodexOp {
  type: CodexOpType;
  // UserInput
  message?: string;
  // ExecApproval
  approval?: 'approve' | 'deny';
  request_id?: string;
}

/**
 * Raw Codex Event data
 */
export interface CodexEvent {
  type: CodexEventType;

  // AgentMessageDelta / AgentThinkingDelta
  delta?: string;

  // ExecApprovalRequest
  request?: {
    id: string;
    command: string;
    args?: string[];
    cwd?: string;
    tool_name?: string;
  };

  // ExecCommandBegin / ExecCommandEnd
  metadata?: {
    tool_name?: string;
    command?: string;
    args?: string[];
    exit_code?: number;
    duration_ms?: number;
  };

  // ExecOutputDelta
  output?: string;
  stream?: 'stdout' | 'stderr';

  // TurnComplete
  summary?: {
    tokens_used?: number;
    turn_id?: string;
  };
}

/**
 * Combined Codex message (can be Op or Event)
 */
export type CodexMessage = (CodexOp | CodexEvent) & {
  session_id?: string;
  timestamp?: string;
};

// =============================================================================
// EVENT TYPE MAPPING
// =============================================================================

/**
 * Map Codex Op types to vendor-agnostic event types
 */
const CODEX_OP_MAP: Record<CodexOpType, AgentEventType> = {
  UserInput: 'user_input:complete',
  ExecApproval: 'permission:approve', // May be :deny based on payload
  Interrupt: 'session:pause',
  Compact: 'context:compact',
  NewTurn: 'session:resume',
};

/**
 * Map Codex Event types to vendor-agnostic event types
 */
const CODEX_EVENT_MAP: Record<CodexEventType, AgentEventType> = {
  AgentMessageDelta: 'agent_output:delta',
  AgentThinkingDelta: 'agent_output:delta',
  ExecApprovalRequest: 'permission:request',
  ExecCommandBegin: 'tool:begin',
  ExecOutputDelta: 'tool:output',
  ExecCommandEnd: 'tool:complete',
  TurnComplete: 'agent_output:complete',
};

// =============================================================================
// TERMINAL OUTPUT PATTERNS
// =============================================================================

/**
 * Regex patterns for detecting Codex events in terminal output
 */
const TERMINAL_PATTERNS = {
  // Codex approval request
  approvalRequest:
    /(?:\[APPROVAL\s*REQUIRED\]|Allow|Confirm)\s*[:\s]*([^\n]+)/i,

  // Tool execution
  toolBegin: /(?:Executing|Running)\s+(?:tool\s+)?["']?(\w+)["']?/i,

  // Session markers
  turnComplete: /(?:Turn|Response)\s+(?:complete|finished)/i,
};

// =============================================================================
// CODEX ADAPTER
// =============================================================================

/**
 * Adapter for Codex Op/Event system
 */
export class CodexAdapter implements IAgentAdapter {
  readonly agentType: AgentType = 'codex';

  /**
   * Parse raw Codex message into an AgentEvent
   */
  parse(rawData: unknown): AgentEvent | null {
    if (!isCodexMessage(rawData)) {
      return null;
    }

    const eventType = this.mapEventType(rawData.type);
    if (!eventType) {
      return null;
    }

    // Special handling for ExecApproval - check if it's approve or deny
    let finalEventType = eventType;
    if (rawData.type === 'ExecApproval' && 'approval' in rawData) {
      finalEventType =
        rawData.approval === 'deny' ? 'permission:deny' : 'permission:approve';
    }

    const baseEvent = {
      id: randomUUID(),
      type: finalEventType,
      agent: this.agentType,
      sessionId: rawData.session_id,
      timestamp: rawData.timestamp ?? new Date().toISOString(),
      raw: rawData,
    };

    const payload = this.buildPayload(rawData);

    return {
      ...baseEvent,
      payload,
    };
  }

  /**
   * Parse terminal output to detect Codex events
   */
  parseTerminalOutput(output: string): AgentEvent[] {
    const events: AgentEvent[] = [];

    // Check for approval request
    const approvalMatch = output.match(TERMINAL_PATTERNS.approvalRequest);
    if (approvalMatch) {
      events.push({
        id: randomUUID(),
        type: 'permission:request',
        agent: this.agentType,
        timestamp: new Date().toISOString(),
        payload: {
          toolName: 'shell',
          command: approvalMatch[1],
          rawPrompt: output,
        } as PermissionPayload,
      });
    }

    // Check for tool begin
    const toolMatch = output.match(TERMINAL_PATTERNS.toolBegin);
    if (toolMatch) {
      events.push({
        id: randomUUID(),
        type: 'tool:begin',
        agent: this.agentType,
        timestamp: new Date().toISOString(),
        payload: {
          toolName: toolMatch[1],
          toolCategory: 'shell',
        } as ToolPayload,
      });
    }

    return events;
  }

  /**
   * Map Codex message type to AgentEventType
   */
  mapEventType(vendorType: string): AgentEventType | null {
    return (
      CODEX_OP_MAP[vendorType as CodexOpType] ??
      CODEX_EVENT_MAP[vendorType as CodexEventType] ??
      null
    );
  }

  /**
   * Build event payload based on message type
   */
  private buildPayload(data: CodexMessage): unknown {
    if ('type' in data) {
      switch (data.type) {
        case 'UserInput':
          return {
            content: (data as CodexOp).message ?? '',
            hasFiles: false,
          } satisfies UserInputPayload;

        case 'ExecApproval':
          return {
            toolName: 'shell',
            decision: (data as CodexOp).approval === 'deny' ? 'deny' : 'allow',
            decidedBy: 'user',
          } satisfies PermissionPayload;

        case 'Interrupt':
          return {
            sessionId: data.session_id ?? '',
            reason: 'interrupted',
          } satisfies SessionPayload;

        case 'Compact':
          return {
            operation: 'compact',
          } satisfies ContextPayload;

        case 'AgentMessageDelta':
          return {
            content: (data as CodexEvent).delta ?? '',
            outputType: 'text',
            isStreaming: true,
          } satisfies AgentOutputPayload;

        case 'AgentThinkingDelta':
          return {
            content: (data as CodexEvent).delta ?? '',
            outputType: 'thinking',
            isStreaming: true,
          } satisfies AgentOutputPayload;

        case 'ExecApprovalRequest': {
          const request = (data as CodexEvent).request;
          return {
            toolName: request?.tool_name ?? 'shell',
            command: request?.command,
            args: request?.args,
            workingDirectory: request?.cwd,
          } satisfies PermissionPayload;
        }

        case 'ExecCommandBegin': {
          const metadata = (data as CodexEvent).metadata;
          return {
            toolName: metadata?.tool_name ?? 'shell',
            toolCategory: 'shell',
            status: 'running',
          } satisfies ToolPayload;
        }

        case 'ExecOutputDelta':
          return {
            toolName: 'shell',
            toolCategory: 'shell',
            output: (data as CodexEvent).output,
            status: 'running',
          } satisfies ToolPayload;

        case 'ExecCommandEnd': {
          const metadata = (data as CodexEvent).metadata;
          return {
            toolName: metadata?.tool_name ?? 'shell',
            toolCategory: 'shell',
            status:
              metadata?.exit_code === 0 ? 'success' : 'error',
            duration: metadata?.duration_ms,
          } satisfies ToolPayload;
        }

        case 'TurnComplete':
          return {
            content: '',
            outputType: 'text',
            isStreaming: false,
          } satisfies AgentOutputPayload;

        default:
          return {};
      }
    }

    return {};
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type guard for CodexMessage
 */
function isCodexMessage(data: unknown): data is CodexMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    typeof (data as CodexMessage).type === 'string'
  );
}

/**
 * Create a new Codex adapter instance
 */
export function createCodexAdapter(): CodexAdapter {
  return new CodexAdapter();
}

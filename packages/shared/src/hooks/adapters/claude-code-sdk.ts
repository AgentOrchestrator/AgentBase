/**
 * Claude Code SDK Hook Bridge
 *
 * Bridges the Claude Code Agent SDK's native hooks to our vendor-agnostic
 * EventRegistry system. This provides reliable, SDK-guaranteed hook events
 * instead of terminal output parsing.
 *
 * Usage:
 * ```typescript
 * import { query } from "@anthropic-ai/claude-agent-sdk";
 * import { createEventRegistry, createSDKHookBridge } from "@agent-orchestrator/shared";
 *
 * const registry = createEventRegistry();
 * const { hooks, cleanup } = createSDKHookBridge(registry);
 *
 * // Use hooks with the SDK
 * for await (const message of query({
 *   prompt: "...",
 *   options: { hooks }
 * })) {
 *   // Events automatically emitted to registry
 * }
 * ```
 */

import type {
  HookCallback,
  HookCallbackMatcher,
  HookEvent,
  HookInput,
  HookJSONOutput,
  NotificationHookInput,
  PermissionRequestHookInput,
  PostToolUseFailureHookInput,
  PostToolUseHookInput,
  PreCompactHookInput,
  PreToolUseHookInput,
  SessionEndHookInput,
  SessionStartHookInput,
  StopHookInput,
  SubagentStartHookInput,
  SubagentStopHookInput,
  UserPromptSubmitHookInput,
} from '@anthropic-ai/claude-agent-sdk';

// Use globalThis.crypto for cross-platform UUID generation (Node.js 19+ and browsers)
const randomUUID = (): string => globalThis.crypto.randomUUID();

import type { EventRegistry } from '../registry.js';
import type {
  AgentEvent,
  AgentEventType,
  ContextPayload,
  DelegationPayload,
  EventResult,
  PermissionPayload,
  SessionPayload,
  SystemPayload,
  ToolPayload,
  UserInputPayload,
} from '../types.js';

// =============================================================================
// SDK HOOK → VENDOR-AGNOSTIC EVENT MAPPING
// =============================================================================

/**
 * Maps SDK hook events to vendor-agnostic event types
 */
const SDK_EVENT_MAP: Record<HookEvent, AgentEventType> = {
  PreToolUse: 'tool:begin',
  PostToolUse: 'tool:complete',
  PostToolUseFailure: 'tool:error',
  UserPromptSubmit: 'user_input:complete',
  SessionStart: 'session:start',
  SessionEnd: 'session:end',
  Stop: 'session:end',
  SubagentStart: 'delegation:start',
  SubagentStop: 'delegation:end',
  PreCompact: 'context:compact',
  PermissionRequest: 'permission:request',
  Notification: 'system:info',
};

// =============================================================================
// PAYLOAD BUILDERS
// =============================================================================

/**
 * Build vendor-agnostic payload from SDK PreToolUse input
 */
function buildToolBeginPayload(input: PreToolUseHookInput): ToolPayload {
  return {
    toolName: input.tool_name,
    toolCategory: categorizeToolName(input.tool_name),
    input: input.tool_input as Record<string, unknown>,
    status: 'pending',
  };
}

/**
 * Build vendor-agnostic payload from SDK PostToolUse input
 */
function buildToolCompletePayload(input: PostToolUseHookInput): ToolPayload {
  return {
    toolName: input.tool_name,
    toolCategory: categorizeToolName(input.tool_name),
    input: input.tool_input as Record<string, unknown>,
    output: input.tool_response,
    status: 'success',
  };
}

/**
 * Build vendor-agnostic payload from SDK PostToolUseFailure input
 */
function buildToolErrorPayload(input: PostToolUseFailureHookInput): ToolPayload {
  return {
    toolName: input.tool_name,
    toolCategory: categorizeToolName(input.tool_name),
    input: input.tool_input as Record<string, unknown>,
    status: 'error',
    error: input.error,
  };
}

/**
 * Build vendor-agnostic payload from SDK UserPromptSubmit input
 */
function buildUserInputPayload(input: UserPromptSubmitHookInput): UserInputPayload {
  return {
    content: input.prompt,
    hasFiles: false, // SDK doesn't expose this directly
  };
}

/**
 * Build vendor-agnostic payload from SDK SessionStart input
 */
function buildSessionStartPayload(input: SessionStartHookInput): SessionPayload {
  return {
    sessionId: input.session_id,
    workspacePath: input.cwd,
    reason: input.source,
  };
}

/**
 * Build vendor-agnostic payload from SDK SessionEnd input
 */
function buildSessionEndPayload(input: SessionEndHookInput): SessionPayload {
  return {
    sessionId: input.session_id,
    workspacePath: input.cwd,
    reason: input.reason,
  };
}

/**
 * Build vendor-agnostic payload from SDK Stop input
 */
function buildStopPayload(input: StopHookInput): SessionPayload {
  return {
    sessionId: input.session_id,
    workspacePath: input.cwd,
    reason: input.stop_hook_active ? 'stop_hook' : 'stopped',
  };
}

/**
 * Build vendor-agnostic payload from SDK SubagentStart input
 */
function buildDelegationStartPayload(input: SubagentStartHookInput): DelegationPayload {
  return {
    subagentId: input.agent_id,
    subagentType: input.agent_type,
  };
}

/**
 * Build vendor-agnostic payload from SDK SubagentStop input
 */
function buildDelegationEndPayload(input: SubagentStopHookInput): DelegationPayload {
  return {
    subagentId: '', // Not available in stop input
    transcript: input.transcript_path,
  };
}

/**
 * Build vendor-agnostic payload from SDK PreCompact input
 */
function buildContextPayload(_input: PreCompactHookInput): ContextPayload {
  return {
    operation: 'compact',
    // Token counts not available in SDK input
  };
}

/**
 * Build vendor-agnostic payload from SDK PermissionRequest input
 */
function buildPermissionPayload(input: PermissionRequestHookInput): PermissionPayload {
  const toolInput = input.tool_input as Record<string, unknown> | undefined;
  return {
    toolName: input.tool_name,
    command: toolInput?.command as string | undefined,
    args: toolInput?.args as string[] | undefined,
    filePath: toolInput?.file_path as string | undefined,
    workingDirectory: input.cwd,
  };
}

/**
 * Build vendor-agnostic payload from SDK Notification input
 */
function buildSystemPayload(input: NotificationHookInput): SystemPayload {
  return {
    level: 'info',
    message: input.message,
    code: input.title,
  };
}

// =============================================================================
// TOOL CATEGORIZATION
// =============================================================================

/**
 * Categorize tool name to ToolCategory
 */
function categorizeToolName(toolName: string): ToolPayload['toolCategory'] {
  const lowerName = toolName.toLowerCase();

  if (['read', 'cat', 'head', 'tail'].some((t) => lowerName.includes(t))) {
    return 'file_read';
  }
  if (['write', 'edit', 'notebookedit'].some((t) => lowerName.includes(t))) {
    return 'file_write';
  }
  if (['glob', 'grep', 'search', 'find'].some((t) => lowerName.includes(t))) {
    return 'file_read';
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
  if (lowerName.startsWith('mcp_') || lowerName.startsWith('mcp__')) {
    return 'mcp';
  }

  return 'unknown';
}

// =============================================================================
// HOOK BRIDGE FACTORY
// =============================================================================

/**
 * Context required for building AgentEvents
 */
export interface SDKHookContext {
  agentId: string;
  gitBranch: string;
}

/**
 * Options for creating the SDK hook bridge
 */
export interface SDKHookBridgeOptions {
  /**
   * Whether to log hook events to console
   * @default false
   */
  debug?: boolean;

  /**
   * Function to get the current context (agentId, gitBranch) for building events.
   * If not provided, defaults to 'unknown' values.
   */
  getContext?: () => SDKHookContext;

  /**
   * Custom handler for converting EventResult to HookJSONOutput
   * By default, 'deny' results block the operation
   */
  resultMapper?: (result: EventResult) => HookJSONOutput;
}

/**
 * Result from createSDKHookBridge
 */
export interface SDKHookBridge {
  /**
   * Hook configuration to pass to SDK query() options
   */
  hooks: Partial<Record<HookEvent, HookCallbackMatcher[]>>;

  /**
   * Cleanup function to call when done
   */
  cleanup: () => void;
}

/**
 * Create a bridge between SDK hooks and the vendor-agnostic EventRegistry
 *
 * @param registry - EventRegistry to emit events to
 * @param options - Bridge options
 * @returns SDK hooks configuration and cleanup function
 *
 * @example
 * ```typescript
 * const registry = createEventRegistry();
 * const { hooks, cleanup } = createSDKHookBridge(registry);
 *
 * // Register handlers
 * registry.on('tool:begin', async (event) => {
 *   console.log('Tool starting:', event.payload);
 *   return { action: 'continue' };
 * });
 *
 * // Use with SDK
 * for await (const msg of query({ prompt: "...", options: { hooks } })) {
 *   // ...
 * }
 *
 * cleanup();
 * ```
 */
export function createSDKHookBridge(
  registry: EventRegistry,
  options: SDKHookBridgeOptions = {}
): SDKHookBridge {
  const { debug = false, resultMapper, getContext } = options;

  /**
   * Create a hook callback that bridges to the registry
   */
  function createBridgeCallback<T extends HookInput>(
    eventType: AgentEventType,
    payloadBuilder: (input: T) => unknown
  ): HookCallback {
    return async (input, _toolUseId, _context): Promise<HookJSONOutput> => {
      // Get context from provider - REQUIRED
      if (!getContext) {
        throw new Error(
          `[SDKHookBridge] getContext is required. Cannot create event without agentId and gitBranch context.`
        );
      }
      const ctx = getContext();

      // Validate required context from input
      if (!input.session_id) {
        throw new Error(`[SDKHookBridge] input.session_id is required for event ${eventType}`);
      }
      if (!input.cwd) {
        throw new Error(`[SDKHookBridge] input.cwd is required for event ${eventType}`);
      }

      // Build vendor-agnostic event
      const event: AgentEvent = {
        id: randomUUID(),
        type: eventType,
        agent: 'claude_code',
        agentId: ctx.agentId,
        sessionId: input.session_id,
        workspacePath: input.cwd,
        gitBranch: ctx.gitBranch,
        timestamp: new Date().toISOString(),
        payload: payloadBuilder(input as T),
        raw: input,
      };

      if (debug) {
        console.log(`[SDKHookBridge] ${eventType}`, event.payload);
      }

      // Emit to registry and collect results
      const results = await registry.emit(event);

      // Check if any handler wants to block/deny
      const denyResult = results.find((r) => r.action === 'deny');
      if (denyResult) {
        if (resultMapper) {
          return resultMapper(denyResult);
        }

        // Use hookSpecificOutput only for PreToolUse (the only hook that supports permissionDecision)
        if (input.hook_event_name === 'PreToolUse') {
          return {
            hookSpecificOutput: {
              hookEventName: 'PreToolUse' as const,
              permissionDecision: 'deny' as const,
              permissionDecisionReason: denyResult.message || 'Blocked by policy',
            },
          };
        }

        // For other hooks, use continue: false
        return { continue: false, stopReason: denyResult.message };
      }

      // Check for modifications (only supported by PreToolUse)
      const modifyResult = results.find((r) => r.action === 'modify');
      if (modifyResult?.modifiedPayload && input.hook_event_name === 'PreToolUse') {
        return {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse' as const,
            permissionDecision: 'allow' as const,
            updatedInput: modifyResult.modifiedPayload as Record<string, unknown>,
          },
        };
      }

      // Default: continue
      return {};
    };
  }

  // Build hooks configuration for all SDK hook events
  const hooks: Partial<Record<HookEvent, HookCallbackMatcher[]>> = {
    PreToolUse: [
      {
        hooks: [createBridgeCallback<PreToolUseHookInput>('tool:begin', buildToolBeginPayload)],
      },
    ],
    PostToolUse: [
      {
        hooks: [
          createBridgeCallback<PostToolUseHookInput>('tool:complete', buildToolCompletePayload),
        ],
      },
    ],
    PostToolUseFailure: [
      {
        hooks: [
          createBridgeCallback<PostToolUseFailureHookInput>('tool:error', buildToolErrorPayload),
        ],
      },
    ],
    UserPromptSubmit: [
      {
        hooks: [
          createBridgeCallback<UserPromptSubmitHookInput>(
            'user_input:complete',
            buildUserInputPayload
          ),
        ],
      },
    ],
    SessionStart: [
      {
        hooks: [
          createBridgeCallback<SessionStartHookInput>('session:start', buildSessionStartPayload),
        ],
      },
    ],
    SessionEnd: [
      {
        hooks: [createBridgeCallback<SessionEndHookInput>('session:end', buildSessionEndPayload)],
      },
    ],
    Stop: [
      {
        hooks: [createBridgeCallback<StopHookInput>('session:end', buildStopPayload)],
      },
    ],
    SubagentStart: [
      {
        hooks: [
          createBridgeCallback<SubagentStartHookInput>(
            'delegation:start',
            buildDelegationStartPayload
          ),
        ],
      },
    ],
    SubagentStop: [
      {
        hooks: [
          createBridgeCallback<SubagentStopHookInput>('delegation:end', buildDelegationEndPayload),
        ],
      },
    ],
    PreCompact: [
      {
        hooks: [createBridgeCallback<PreCompactHookInput>('context:compact', buildContextPayload)],
      },
    ],
    PermissionRequest: [
      {
        hooks: [
          createBridgeCallback<PermissionRequestHookInput>(
            'permission:request',
            buildPermissionPayload
          ),
        ],
      },
    ],
    Notification: [
      {
        hooks: [createBridgeCallback<NotificationHookInput>('system:info', buildSystemPayload)],
      },
    ],
  };

  return {
    hooks,
    cleanup: () => {
      // Currently no cleanup needed, but kept for future use
      if (debug) {
        console.log('[SDKHookBridge] Cleanup complete');
      }
    },
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export { SDK_EVENT_MAP };

/**
 * All SDK hook event types
 */
export const SDK_HOOK_EVENTS: HookEvent[] = [
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'UserPromptSubmit',
  'SessionStart',
  'SessionEnd',
  'Stop',
  'SubagentStart',
  'SubagentStop',
  'PreCompact',
  'PermissionRequest',
  'Notification',
];

/**
 * Conversation Type Definitions
 *
 * Types for Claude Code conversation data based on JSONL format from ~/.claude/projects/
 * These represent the external data contract from Claude Code.
 */

// =============================================================================
// Content Element Types
// =============================================================================

/**
 * Text content element
 */
export interface TextContent {
  type: 'text';
  text: string;
}

/**
 * Tool use content element
 */
export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Tool result content element
 */
export interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string | TextContent[];
}

/**
 * Thinking/reasoning content element
 */
export interface ThinkingContent {
  type: 'thinking';
  thinking: string;
  signature: string;
}

/**
 * Union of all content element types
 */
export type MessageContent = TextContent | ToolUseContent | ToolResultContent | ThinkingContent;

// =============================================================================
// Message Structure
// =============================================================================

/**
 * Claude message structure from JSONL
 */
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: MessageContent[];
  model?: string;
  id?: string;
  stop_reason?: string | null;
  stop_sequence?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation?: {
      ephemeral_5m_input_tokens?: number;
      ephemeral_1h_input_tokens?: number;
    };
    service_tier?: string;
  };
}

// =============================================================================
// Top-Level Entry Types
// =============================================================================

/**
 * Queue operation entry in JSONL
 */
export interface QueueOperationEntry {
  type: 'queue-operation';
  operation: string;
  timestamp: string;
  sessionId: string;
}

/**
 * File history snapshot entry in JSONL
 */
export interface FileHistorySnapshotEntry {
  type: 'file-history-snapshot';
  messageId: string;
  snapshot: unknown;
  isSnapshotUpdate: boolean;
}

/**
 * User message entry in JSONL
 */
export interface UserMessageEntry {
  type: 'user';
  parentUuid: string | null;
  isSidechain: boolean;
  userType: string;
  cwd: string;
  sessionId: string;
  version: string;
  gitBranch: string;
  slug?: string;
  message: ClaudeMessage;
  uuid: string;
  timestamp: string;
}

/**
 * Assistant message entry in JSONL
 */
export interface AssistantMessageEntry {
  type: 'assistant';
  parentUuid: string | null;
  isSidechain: boolean;
  cwd: string;
  sessionId: string;
  version: string;
  gitBranch: string;
  message: ClaudeMessage;
  uuid: string;
  timestamp: string;
  requestId?: string;
  toolUseResult?: unknown;
  sourceToolAssistantUUID?: string;
}

/**
 * Union of all conversation entry types
 */
export type ConversationEntry =
  | QueueOperationEntry
  | FileHistorySnapshotEntry
  | UserMessageEntry
  | AssistantMessageEntry;

// =============================================================================
// Grouped Messages for UI Display
// =============================================================================

/**
 * Grouped user messages for UI rendering
 */
export interface UserMessageGroup {
  type: 'user';
  uuid: string;
  timestamp: string;
  /** Combined text content */
  text: string;
  parentUuid: string | null;
  entry: UserMessageEntry;
}

/**
 * Grouped assistant messages for UI rendering
 */
export interface AssistantMessageGroup {
  type: 'assistant';
  uuid: string;
  timestamp: string;
  /** All assistant entries until next user message */
  entries: AssistantMessageEntry[];
  parentUuid: string | null;
  model?: string;
}

/**
 * Union of message group types
 */
export type MessageGroup = UserMessageGroup | AssistantMessageGroup;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if entry is a user message
 */
export function isUserMessageEntry(entry: ConversationEntry): entry is UserMessageEntry {
  return entry.type === 'user';
}

/**
 * Type guard to check if entry is an assistant message
 */
export function isAssistantMessageEntry(entry: ConversationEntry): entry is AssistantMessageEntry {
  return entry.type === 'assistant';
}

/**
 * Type guard to check if entry is a queue operation
 */
export function isQueueOperationEntry(entry: ConversationEntry): entry is QueueOperationEntry {
  return entry.type === 'queue-operation';
}

/**
 * Type guard to check if entry is a file history snapshot
 */
export function isFileHistorySnapshotEntry(
  entry: ConversationEntry
): entry is FileHistorySnapshotEntry {
  return entry.type === 'file-history-snapshot';
}

/**
 * Type guard to check if content is text
 */
export function isTextContent(content: MessageContent): content is TextContent {
  return content.type === 'text';
}

/**
 * Type guard to check if content is tool use
 */
export function isToolUseContent(content: MessageContent): content is ToolUseContent {
  return content.type === 'tool_use';
}

/**
 * Type guard to check if content is tool result
 */
export function isToolResultContent(content: MessageContent): content is ToolResultContent {
  return content.type === 'tool_result';
}

/**
 * Type guard to check if content is thinking
 */
export function isThinkingContent(content: MessageContent): content is ThinkingContent {
  return content.type === 'thinking';
}

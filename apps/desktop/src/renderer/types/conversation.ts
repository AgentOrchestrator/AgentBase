/**
 * Types for Claude Code conversation data
 * Based on JSONL format from ~/.claude/projects/
 */

// Content element types that can appear in messages
export interface TextContent {
  type: 'text';
  text: string;
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Array<TextContent>;
}

export interface ThinkingContent {
  type: 'thinking';
  thinking: string;
  signature: string;
}

export type MessageContent = TextContent | ToolUseContent | ToolResultContent | ThinkingContent;

// Message structure
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

// Top-level entry types
export interface QueueOperationEntry {
  type: 'queue-operation';
  operation: string;
  timestamp: string;
  sessionId: string;
}

export interface FileHistorySnapshotEntry {
  type: 'file-history-snapshot';
  messageId: string;
  snapshot: any;
  isSnapshotUpdate: boolean;
}

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
  toolUseResult?: any;
  sourceToolAssistantUUID?: string;
}

export type ConversationEntry =
  | QueueOperationEntry
  | FileHistorySnapshotEntry
  | UserMessageEntry
  | AssistantMessageEntry;

// Grouped messages for UI display
export interface UserMessageGroup {
  type: 'user';
  uuid: string;
  timestamp: string;
  text: string; // Combined text content
  parentUuid: string | null;
  entry: UserMessageEntry;
}

export interface AssistantMessageGroup {
  type: 'assistant';
  uuid: string;
  timestamp: string;
  entries: AssistantMessageEntry[]; // All assistant entries until next user message
  parentUuid: string | null;
  model?: string;
}

export type MessageGroup = UserMessageGroup | AssistantMessageGroup;

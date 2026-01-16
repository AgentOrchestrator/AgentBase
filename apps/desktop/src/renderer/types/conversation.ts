/**
 * Conversation Type Definitions
 *
 * Re-exports conversation types from @agent-orchestrator/shared.
 * This file is kept for backwards compatibility with existing imports.
 */

export type {
  // Content types
  TextContent,
  ToolUseContent,
  ToolResultContent,
  ThinkingContent,
  MessageContent,
  // Message types
  ClaudeMessage,
  // Entry types
  QueueOperationEntry,
  FileHistorySnapshotEntry,
  UserMessageEntry,
  AssistantMessageEntry,
  ConversationEntry,
  // Group types
  UserMessageGroup,
  AssistantMessageGroup,
  MessageGroup,
} from '@agent-orchestrator/shared';

export {
  // Type guards
  isUserMessageEntry,
  isAssistantMessageEntry,
  isQueueOperationEntry,
  isFileHistorySnapshotEntry,
  isTextContent,
  isToolUseContent,
  isToolResultContent,
  isThinkingContent,
} from '@agent-orchestrator/shared';

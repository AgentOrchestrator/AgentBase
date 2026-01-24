/**
 * ActionPill Services Exports
 */

export { actionPillService } from './ActionPillService';
export type { IActionPillService } from './IActionPillService';

// MessageChannel - unified message delivery abstraction
export type { AgentMessageEvent, MessageChannel } from './MessageChannel';
export { createMessageChannel, messageDispatcher } from './MessageChannel';

// ToolCompletionService - auto-dismisses actions when tools complete
export type { IToolCompletionService } from './ToolCompletionService';
export { toolCompletionService } from './ToolCompletionService';

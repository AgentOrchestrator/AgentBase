/**
 * ActionPill Feature Exports
 *
 * Public API for the ActionPill feature.
 */

// Main components
export { ActionPill } from './ActionPill';
// Hooks
export type { ActionPillHighlightState, ActiveAgentState, MessageChannel } from './hooks';
export { useActionPillHighlight, useActiveAgent } from './hooks';
export { MessagePill } from './MessagePill';
// Services - ActionPill
// Services - MessageChannel & Dispatcher
export type { AgentMessageEvent, IActionPillService } from './services';
export { actionPillService, createMessageChannel, messageDispatcher } from './services';

// Store - ActionPill & MessagePill
export type { ActionPillState, MessagePillState, PillAnimationState, SentMessage } from './store';
export {
  selectActionCount,
  selectCanSend,
  selectHasActions,
  selectHasInput,
  selectRecentHistory,
  selectSortedActions,
  selectTopmostAction,
  useActionPillStore,
  useMessagePillStore,
} from './store';

/**
 * ActionPill Feature Exports
 *
 * Public API for the ActionPill feature.
 */

// Main components
export { ActionPill } from './ActionPill';
// Hooks
export type {
  ActionPillHighlightState,
  AgentSelectionState,
  MessageChannel,
  SelectedAgentState,
} from './hooks';
export { useActionPillHighlight, useAgentSelection, useSelectedAgent } from './hooks';
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
  selectSelectedAction,
  selectSortedActions,
  selectTopmostAction,
  useActionPillStore,
  useMessagePillStore,
} from './store';

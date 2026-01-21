/**
 * ActionPill Feature Exports
 *
 * Public API for the ActionPill feature.
 */

// Main components
export { ActionPill } from './ActionPill';
export type { ActionPillHighlightState } from './hooks';

// Hooks
export { useActionPillHighlight } from './hooks';
export { MessagePill } from './MessagePill';
export type {
  IActionPillService,
  IMessagePillService,
  SendMessageOptions,
  SendMessageResult,
} from './services';
// Services - ActionPill
// Services - MessagePill
export { actionPillService, messagePillService } from './services';
export type { ActionPillState, MessagePillState, PillAnimationState, SentMessage } from './store';
// Store - ActionPill
// Store - MessagePill
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

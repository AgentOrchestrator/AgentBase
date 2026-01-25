/**
 * ActionPill Feature Exports
 *
 * Public API for the ActionPill feature.
 */

// Main component
export { ActionPill } from './ActionPill';
export type { ActionPillHighlightState } from './hooks';
// Hooks
export { useActionPillHighlight } from './hooks';
export type { IActionPillService } from './services';
// Services
export { actionPillService } from './services';
export type { ActionPillState, PillAnimationState } from './store';
// Store
export {
  selectActionCount,
  selectHasActions,
  selectSortedActions,
  selectTopmostAction,
  useActionPillStore,
} from './store';

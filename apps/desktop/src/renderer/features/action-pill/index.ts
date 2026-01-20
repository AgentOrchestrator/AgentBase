/**
 * ActionPill Feature Exports
 *
 * Public API for the ActionPill feature.
 */

// Main component
export { ActionPill } from './ActionPill';

// Store
export {
  selectActionCount,
  selectHasActions,
  selectSortedActions,
  selectTopmostAction,
  useActionPillStore,
} from './store';
export type { ActionPillState, PillAnimationState } from './store';

// Hooks
export { useActionPillHighlight } from './hooks';
export type { ActionPillHighlightState } from './hooks';

// Services
export { actionPillService } from './services';
export type { IActionPillService } from './services';

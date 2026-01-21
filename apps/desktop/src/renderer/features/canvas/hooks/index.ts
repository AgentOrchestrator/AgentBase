/**
 * Canvas Hooks
 *
 * Hooks for canvas state management, actions, and interactions.
 * All state hooks use Zustand stores for global state management.
 */
export {
  type UseCanvasActionsInput,
  type UseCanvasActionsReturn,
  useCanvasActions,
} from './useCanvasActions';
export {
  type LinearIssue,
  type UseCanvasDropOptions,
  type UseCanvasDropReturn,
  useCanvasDrop,
} from './useCanvasDrop';
export {
  type CanvasPersistenceStore,
  useCanvasPersistenceStore,
} from './useCanvasPersistenceStore';
export {
  type CanvasUIStore,
  type UseCanvasUIStateReturn,
  useCanvasUIState,
} from './useCanvasUIState';
export {
  type ContextMenuPosition,
  type ContextMenuStore,
  type UseContextMenuReturn,
  useContextMenu,
  useContextMenuStore,
} from './useContextMenu';
export {
  type ForkConfirmError,
  type ForkConfirmResult,
  type ForkModalData,
  type UseForkModalInput,
  type UseForkModalReturn,
  useForkModal,
} from './useForkModal';
export {
  type KeyboardModifiersStore,
  type UseKeyboardModifiersReturn,
  useKeyboardModifiers,
} from './useKeyboardModifiers';
// NOTE: useNodeOperations is no longer exported publicly.
// It's used internally by Canvas.tsx for operations like highlighting.
// Child components should use useNodeActions() from NodeActionsContext instead.
export {
  type PendingAgentPosition,
  type PendingAgentStore,
  type UsePendingAgentReturn,
  usePendingAgent,
} from './usePendingAgent';

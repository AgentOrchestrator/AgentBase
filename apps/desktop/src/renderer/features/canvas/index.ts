/**
 * Canvas Feature
 *
 * Contains canvas-specific UI components like context menu,
 * zoom controls, floating action buttons, and utility components.
 * Also includes hooks for canvas state management, actions, and interactions,
 * and the NodeActionsContext for direct node updates (replacing event-based pattern).
 */

// Components
export { ContextMenu, type ContextMenuProps } from './components/ContextMenu';
export {
  FloatingActionButtons,
  type FloatingActionButtonsProps,
} from './components/FloatingActionButtons';
export { ForkErrorToast, type ForkErrorToastProps } from './components/ForkErrorToast';
export { SaveIndicator, type SaveIndicatorProps } from './components/SaveIndicator';
export {
  SidebarExpandButton,
  type SidebarExpandButtonProps,
} from './components/SidebarExpandButton';
export { ZoomControls, type ZoomControlsProps } from './components/ZoomControls';

// Context
export {
  type NodeActionsContextValue,
  NodeActionsProvider,
  type NodeActionsProviderProps,
  useNodeActions,
  useNodeActionsOptional,
} from './context';

// Hooks
export {
  type UseCanvasActionsInput,
  type UseCanvasActionsReturn,
  useCanvasActions,
} from './hooks/useCanvasActions';
export {
  type LinearIssue,
  type UseCanvasDropOptions,
  type UseCanvasDropReturn,
  useCanvasDrop,
} from './hooks/useCanvasDrop';
export {
  type CanvasPersistenceStore,
  useCanvasPersistenceStore,
} from './hooks/useCanvasPersistenceStore';
export { type UseCanvasUIStateReturn, useCanvasUIState } from './hooks/useCanvasUIState';
export {
  type ContextMenuPosition,
  type UseContextMenuReturn,
  useContextMenu,
} from './hooks/useContextMenu';
export {
  type ForkConfirmError,
  type ForkConfirmResult,
  type ForkModalData,
  type UseForkModalInput,
  type UseForkModalReturn,
  useForkModal,
} from './hooks/useForkModal';
export {
  type UseKeyboardModifiersReturn,
  useKeyboardModifiers,
} from './hooks/useKeyboardModifiers';
export {
  type PendingAgentPosition,
  type UsePendingAgentReturn,
  usePendingAgent,
} from './hooks/usePendingAgent';

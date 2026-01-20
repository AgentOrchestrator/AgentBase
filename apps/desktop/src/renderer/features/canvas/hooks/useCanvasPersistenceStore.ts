import type { Edge, Node, Viewport } from '@xyflow/react';
import { create } from 'zustand';
import type { CanvasState } from '../../../../main/types/database';
import '../../../main.d'; // Import type declarations for Window.canvasAPI
import {
  canvasEdgesToEdges,
  canvasNodesToNodes,
  dbViewportToViewport,
  edgesToCanvasEdges,
  generateCanvasId,
  nodesToCanvasNodes,
  viewportToDbViewport,
} from '../../../hooks/canvasConverters';

/**
 * Canvas Persistence Store
 *
 * Manages canvas persistence state with explicit initialization pattern:
 * - Store holds state and actions
 * - Component explicitly calls restore() to initialize
 * - Component explicitly sets up beforeunload listener with flush()
 *
 * No magic - all lifecycle events are explicitly triggered by the component.
 */

// =============================================================================
// Types
// =============================================================================

interface CanvasPersistenceState {
  /** Current canvas ID */
  canvasId: string | null;
  /** Whether the store is loading initial data */
  isLoading: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Timestamp of last successful save */
  lastSavedAt: Date | null;
  /** Last error message */
  error: string | null;

  /** Initial nodes loaded from persistence (for hydration) */
  initialNodes: Node[];
  /** Initial edges loaded from persistence (for hydration) */
  initialEdges: Edge[];
  /** Initial viewport loaded from persistence (for hydration) */
  initialViewport: Viewport | undefined;
}

interface CanvasPersistenceActions {
  /**
   * Restore canvas from persistence. Call this explicitly on mount.
   * Guards against double-calls.
   */
  restore: () => Promise<void>;

  /** Update nodes and trigger debounced save */
  persistNodes: (nodes: Node[]) => void;

  /** Update edges and trigger debounced save */
  persistEdges: (edges: Edge[]) => void;

  /** Update viewport and trigger debounced save */
  persistViewport: (viewport: Viewport) => void;

  /** Save immediately, cancelling any pending debounced save */
  saveNow: () => Promise<void>;

  /** Flush any pending debounced save (synchronous, for beforeunload) */
  flush: () => void;

  /** Configure store options */
  configure: (options: { debounceMs?: number }) => void;

  /** Reset store to initial state */
  reset: () => void;
}

export type CanvasPersistenceStore = CanvasPersistenceState & CanvasPersistenceActions;

// =============================================================================
// Initial State
// =============================================================================

const initialState: CanvasPersistenceState = {
  canvasId: null,
  isLoading: true,
  isSaving: false,
  lastSavedAt: null,
  error: null,
  initialNodes: [],
  initialEdges: [],
  initialViewport: undefined,
};

// =============================================================================
// Store Implementation
// =============================================================================

// Internal state (not exposed in store, managed in closure)
let currentNodes: Node[] = [];
let currentEdges: Edge[] = [];
let currentViewport: Viewport | undefined;
let restoreAttempted = false;
let debounceMs = 1000;
let debounceTimeoutId: ReturnType<typeof setTimeout> | null = null;
let pendingSave: (() => void) | null = null;

export const useCanvasPersistenceStore = create<CanvasPersistenceStore>((set, get) => {
  // ---------------------------------------------------------------------------
  // Internal Save Function
  // ---------------------------------------------------------------------------

  const saveCanvas = async () => {
    const { canvasId } = get();

    console.log(`[CanvasPersistenceStore] saveCanvas: starting`, {
      canvasId,
      hasCanvasAPI: !!window.canvasAPI,
    });

    if (!canvasId || !window.canvasAPI) {
      console.log(`[CanvasPersistenceStore] saveCanvas: aborting - missing canvasId or canvasAPI`);
      return;
    }

    set({ isSaving: true });

    try {
      const convertedNodes = nodesToCanvasNodes(currentNodes);
      const convertedEdges = edgesToCanvasEdges(currentEdges);
      const convertedViewport = currentViewport ? viewportToDbViewport(currentViewport) : undefined;

      console.log(`[CanvasPersistenceStore] saveCanvas: preparing state`, {
        nodeCount: convertedNodes.length,
        edgeCount: convertedEdges.length,
        hasViewport: !!convertedViewport,
      });

      const state: CanvasState = {
        id: canvasId,
        nodes: convertedNodes,
        edges: convertedEdges,
        viewport: convertedViewport,
      };

      await window.canvasAPI.saveCanvas(canvasId, state);

      console.log(`[CanvasPersistenceStore] saveCanvas: SUCCESS`);
      set({ lastSavedAt: new Date(), error: null, isSaving: false });
    } catch (err) {
      console.error(`[CanvasPersistenceStore] saveCanvas: FAILED`, err);
      set({
        error: err instanceof Error ? err.message : 'Failed to save canvas',
        isSaving: false,
      });
    }
  };

  // ---------------------------------------------------------------------------
  // Debounced Save
  // ---------------------------------------------------------------------------

  const scheduleDebouncedSave = () => {
    const { canvasId } = get();
    if (!canvasId) return;

    pendingSave = saveCanvas;

    if (debounceTimeoutId) {
      clearTimeout(debounceTimeoutId);
    }

    debounceTimeoutId = setTimeout(() => {
      if (pendingSave) {
        pendingSave();
        pendingSave = null;
      }
      debounceTimeoutId = null;
    }, debounceMs);
  };

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  return {
    // Initial state
    ...initialState,

    // Actions
    restore: async () => {
      // Guard against double restore
      if (restoreAttempted) {
        return;
      }
      restoreAttempted = true;

      if (!window.canvasAPI) {
        console.warn('[CanvasPersistenceStore] Canvas API not available');
        set({ isLoading: false });
        return;
      }

      try {
        const currentId = await window.canvasAPI.getCurrentCanvasId();

        if (currentId) {
          const loadedState = await window.canvasAPI.loadCanvas(currentId);

          if (loadedState) {
            console.log('[CanvasPersistenceStore] Restored canvas:', loadedState.id);

            const nodes = canvasNodesToNodes(loadedState.nodes);
            const edges = canvasEdgesToEdges(loadedState.edges);
            const viewport = loadedState.viewport
              ? dbViewportToViewport(loadedState.viewport)
              : undefined;

            // Update internal refs
            currentNodes = nodes;
            currentEdges = edges;
            currentViewport = viewport;

            set({
              canvasId: loadedState.id,
              initialNodes: nodes,
              initialEdges: edges,
              initialViewport: viewport,
              isLoading: false,
              error: null,
            });
          } else {
            // Canvas ID exists but canvas not found - create new
            const newId = generateCanvasId();
            await window.canvasAPI.setCurrentCanvasId(newId);
            set({ canvasId: newId, isLoading: false, error: null });
          }
        } else {
          // No current canvas - create new
          const newId = generateCanvasId();
          await window.canvasAPI.setCurrentCanvasId(newId);
          set({ canvasId: newId, isLoading: false, error: null });
        }
      } catch (err) {
        console.error('[CanvasPersistenceStore] Restore error:', err);
        const fallbackId = generateCanvasId();
        set({
          error: err instanceof Error ? err.message : 'Failed to restore canvas',
          canvasId: fallbackId,
          isLoading: false,
        });
      }
    },

    persistNodes: (nodes: Node[]) => {
      console.log(`[CanvasPersistenceStore] persistNodes: ${nodes.length} nodes`);
      currentNodes = nodes;
      scheduleDebouncedSave();
    },

    persistEdges: (edges: Edge[]) => {
      console.log(`[CanvasPersistenceStore] persistEdges: ${edges.length} edges`);
      currentEdges = edges;
      scheduleDebouncedSave();
    },

    persistViewport: (viewport: Viewport) => {
      console.log(`[CanvasPersistenceStore] persistViewport:`, viewport);
      currentViewport = viewport;
      scheduleDebouncedSave();
    },

    saveNow: async () => {
      // Cancel any pending debounced save
      if (debounceTimeoutId) {
        clearTimeout(debounceTimeoutId);
        debounceTimeoutId = null;
        pendingSave = null;
      }
      await saveCanvas();
    },

    flush: () => {
      if (debounceTimeoutId && pendingSave) {
        clearTimeout(debounceTimeoutId);
        debounceTimeoutId = null;
        pendingSave();
        pendingSave = null;
      }
    },

    configure: (options: { debounceMs?: number }) => {
      if (options.debounceMs !== undefined) {
        debounceMs = options.debounceMs;
      }
    },

    reset: () => {
      // Cancel any pending save
      if (debounceTimeoutId) {
        clearTimeout(debounceTimeoutId);
        debounceTimeoutId = null;
        pendingSave = null;
      }

      // Reset internal state
      currentNodes = [];
      currentEdges = [];
      currentViewport = undefined;
      restoreAttempted = false;
      debounceMs = 1000;

      // Reset store state
      set(initialState);
    },
  };
});

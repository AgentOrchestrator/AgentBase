import type { Edge, Node, Viewport } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

interface UseCanvasPersistenceOptions {
  debounceMs?: number;
  autoSave?: boolean;
  autoRestore?: boolean;
}

interface UseCanvasPersistenceReturn {
  canvasId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  error: string | null;

  initialNodes: Node[];
  initialEdges: Edge[];
  initialViewport: Viewport | undefined;

  persistNodes: (nodes: Node[]) => void;
  persistEdges: (edges: Edge[]) => void;
  persistViewport: (viewport: Viewport) => void;
  saveNow: () => Promise<void>;
}

/**
 * Simple debounce utility
 */
function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): T & { cancel: () => void; flush: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingFunc: (() => void) | null = null;

  const debounced = (...args: Parameters<T>) => {
    pendingFunc = () => func(...args);
    if (timeoutId) {
      console.log(`[CanvasPersistence] Debounce: rescheduling (had pending timeout)`);
      clearTimeout(timeoutId);
    }
    console.log(`[CanvasPersistence] Debounce: scheduling save in ${wait}ms`);
    timeoutId = setTimeout(() => {
      console.log(`[CanvasPersistence] Debounce: executing scheduled save`);
      if (pendingFunc) pendingFunc();
      timeoutId = null;
      pendingFunc = null;
    }, wait);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      console.log(`[CanvasPersistence] Debounce: cancelled pending save`);
      clearTimeout(timeoutId);
      timeoutId = null;
      pendingFunc = null;
    }
  };

  debounced.flush = () => {
    if (timeoutId && pendingFunc) {
      console.log(`[CanvasPersistence] Debounce: flushing - executing immediately`);
      clearTimeout(timeoutId);
      pendingFunc();
      timeoutId = null;
      pendingFunc = null;
    }
  };

  return debounced as T & { cancel: () => void; flush: () => void };
}

export function useCanvasPersistence(
  options: UseCanvasPersistenceOptions = {}
): UseCanvasPersistenceReturn {
  const { debounceMs = 1000, autoSave = true, autoRestore = true } = options;

  // State
  const [canvasId, setCanvasId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Hydration state (for initial load)
  const [initialNodes, setInitialNodes] = useState<Node[]>([]);
  const [initialEdges, setInitialEdges] = useState<Edge[]>([]);
  const [initialViewport, setInitialViewport] = useState<Viewport | undefined>();

  // Current state refs (to avoid stale closures in debounce)
  const currentNodesRef = useRef<Node[]>([]);
  const currentEdgesRef = useRef<Edge[]>([]);
  const currentViewportRef = useRef<Viewport | undefined>(undefined);
  const canvasIdRef = useRef<string | null>(null);
  const restoreAttemptedRef = useRef(false);

  // Keep canvasIdRef in sync
  useEffect(() => {
    canvasIdRef.current = canvasId;
  }, [canvasId]);

  // Save function
  const saveCanvas = useCallback(async () => {
    const id = canvasIdRef.current;
    console.log(`[CanvasPersistence] saveCanvas: starting`, {
      canvasId: id,
      hasCanvasAPI: !!window.canvasAPI,
    });

    if (!id || !window.canvasAPI) {
      console.log(`[CanvasPersistence] saveCanvas: aborting - missing canvasId or canvasAPI`);
      return;
    }

    setIsSaving(true);
    try {
      const convertedNodes = nodesToCanvasNodes(currentNodesRef.current);
      const convertedEdges = edgesToCanvasEdges(currentEdgesRef.current);
      const convertedViewport = currentViewportRef.current
        ? viewportToDbViewport(currentViewportRef.current)
        : undefined;

      console.log(`[CanvasPersistence] saveCanvas: preparing state`, {
        inputNodeCount: currentNodesRef.current.length,
        convertedNodeCount: convertedNodes.length,
        edgeCount: convertedEdges.length,
        viewport: convertedViewport,
      });

      // Log each converted node for debugging
      convertedNodes.forEach((node) => {
        console.log(`[CanvasPersistence] saveCanvas: converted node`, {
          id: node.id,
          type: node.type,
          position: node.position,
        });
      });

      const state: CanvasState = {
        id,
        nodes: convertedNodes,
        edges: convertedEdges,
        viewport: convertedViewport,
      };

      await window.canvasAPI.saveCanvas(id, state);
      console.log(`[CanvasPersistence] saveCanvas: SUCCESS - saved ${convertedNodes.length} nodes`);
      setLastSavedAt(new Date());
      setError(null);
    } catch (err) {
      console.error(`[CanvasPersistence] saveCanvas: FAILED`, err);
      setError(err instanceof Error ? err.message : 'Failed to save canvas');
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Debounced save
  const debouncedSave = useMemo(() => debounce(saveCanvas, debounceMs), [saveCanvas, debounceMs]);

  // Auto-restore on mount
  useEffect(() => {
    // Guard against multiple restore attempts (e.g., React StrictMode double-mount)
    if (restoreAttemptedRef.current) {
      return;
    }
    restoreAttemptedRef.current = true;

    if (!autoRestore) {
      setIsLoading(false);
      return;
    }

    const restoreCanvas = async () => {
      if (!window.canvasAPI) {
        console.warn('Canvas API not available');
        setIsLoading(false);
        return;
      }

      try {
        // Get current canvas ID
        const currentId = await window.canvasAPI.getCurrentCanvasId();

        if (currentId) {
          // Load existing canvas
          const loadedState = await window.canvasAPI.loadCanvas(currentId);

          if (loadedState) {
            console.log('[CanvasPersistence] Restored canvas:', loadedState);

            setCanvasId(loadedState.id);
            setInitialNodes(canvasNodesToNodes(loadedState.nodes));
            setInitialEdges(canvasEdgesToEdges(loadedState.edges));
            if (loadedState.viewport) {
              setInitialViewport(dbViewportToViewport(loadedState.viewport));
            }
            // Initialize refs with loaded data
            currentNodesRef.current = canvasNodesToNodes(loadedState.nodes);
            currentEdgesRef.current = canvasEdgesToEdges(loadedState.edges);
            currentViewportRef.current = loadedState.viewport
              ? dbViewportToViewport(loadedState.viewport)
              : undefined;
          } else {
            // Canvas ID exists but canvas not found - create new
            const newId = generateCanvasId();
            await window.canvasAPI.setCurrentCanvasId(newId);
            setCanvasId(newId);
          }
        } else {
          // No current canvas - create new
          const newId = generateCanvasId();
          await window.canvasAPI.setCurrentCanvasId(newId);
          setCanvasId(newId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to restore canvas');
        console.error('Canvas restore error:', err);
        // Still set a canvas ID so the app can function
        const fallbackId = generateCanvasId();
        setCanvasId(fallbackId);
      } finally {
        setIsLoading(false);
      }
    };

    restoreCanvas();
  }, [autoRestore]);

  // Flush on unmount and window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      debouncedSave.flush();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      debouncedSave.flush();
    };
  }, [debouncedSave]);

  // Change handlers that trigger auto-save
  const persistNodes = useCallback(
    (nodes: Node[]) => {
      console.log(`[CanvasPersistence] persistNodes: received ${nodes.length} nodes`, {
        nodeIds: nodes.map((n) => n.id),
        autoSave,
        canvasId: canvasIdRef.current,
      });
      currentNodesRef.current = nodes;
      if (autoSave && canvasIdRef.current) {
        console.log(`[CanvasPersistence] persistNodes: triggering debounced save`);
        debouncedSave();
      } else {
        console.log(`[CanvasPersistence] persistNodes: skipping save`, {
          autoSave,
          hasCanvasId: !!canvasIdRef.current,
        });
      }
    },
    [autoSave, debouncedSave]
  );

  const persistEdges = useCallback(
    (edges: Edge[]) => {
      currentEdgesRef.current = edges;
      if (autoSave && canvasIdRef.current) {
        debouncedSave();
      }
    },
    [autoSave, debouncedSave]
  );

  const persistViewport = useCallback(
    (viewport: Viewport) => {
      currentViewportRef.current = viewport;
      if (autoSave && canvasIdRef.current) {
        debouncedSave();
      }
    },
    [autoSave, debouncedSave]
  );

  const saveNow = useCallback(async () => {
    debouncedSave.cancel();
    await saveCanvas();
  }, [debouncedSave, saveCanvas]);

  return {
    canvasId,
    isLoading,
    isSaving,
    lastSavedAt,
    error,
    initialNodes,
    initialEdges,
    initialViewport,
    persistNodes,
    persistEdges,
    persistViewport,
    saveNow,
  };
}

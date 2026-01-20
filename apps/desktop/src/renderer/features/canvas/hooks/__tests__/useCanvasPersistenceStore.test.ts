/**
 * Tests for useCanvasPersistenceStore (Zustand)
 *
 * Tests the canvas persistence store with explicit initialization pattern:
 * - Store holds state and actions
 * - Component explicitly calls restore() to initialize
 * - Component explicitly sets up beforeunload listener with flush()
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasState } from '../../../../../main/types/database';

// =============================================================================
// Mock Setup
// =============================================================================

// Mock canvasAPI
const mockCanvasAPI = {
  saveCanvas: vi.fn(),
  loadCanvas: vi.fn(),
  getCurrentCanvasId: vi.fn(),
  setCurrentCanvasId: vi.fn(),
  listCanvases: vi.fn(),
  deleteCanvas: vi.fn(),
};

// Mock canvasConverters
vi.mock('../../../../hooks/canvasConverters', () => ({
  nodesToCanvasNodes: vi.fn((nodes) => nodes),
  canvasNodesToNodes: vi.fn((nodes) => nodes),
  edgesToCanvasEdges: vi.fn((edges) => edges),
  canvasEdgesToEdges: vi.fn((edges) => edges),
  viewportToDbViewport: vi.fn((viewport) => viewport),
  dbViewportToViewport: vi.fn((viewport) => viewport),
  generateCanvasId: vi.fn(() => 'generated-canvas-id'),
}));

// Set up window.canvasAPI before importing the store
beforeEach(() => {
  vi.stubGlobal('window', { canvasAPI: mockCanvasAPI });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

// Import after mocks are set up
// We'll need to dynamically import to reset store state between tests
async function getStore() {
  // Clear module cache to get fresh store instance
  vi.resetModules();
  const module = await import('../useCanvasPersistenceStore');
  return module.useCanvasPersistenceStore;
}

// =============================================================================
// Test Data
// =============================================================================

const mockNode = {
  id: 'node-1',
  type: 'agent' as const,
  position: { x: 100, y: 200 },
  data: { label: 'Test Node' },
};

const mockEdge = {
  id: 'edge-1',
  source: 'node-1',
  target: 'node-2',
};

const mockViewport = {
  x: 0,
  y: 0,
  zoom: 1,
};

const mockCanvasState: CanvasState = {
  id: 'existing-canvas-id',
  nodes: [mockNode],
  edges: [mockEdge],
  viewport: mockViewport,
};

// =============================================================================
// Test Suite
// =============================================================================

describe('useCanvasPersistenceStore', () => {
  // ===========================================================================
  // Initial State
  // ===========================================================================

  describe('Initial State', () => {
    it('should have correct initial state', async () => {
      const useStore = await getStore();
      const state = useStore.getState();

      expect(state.canvasId).toBeNull();
      expect(state.isLoading).toBe(true);
      expect(state.isSaving).toBe(false);
      expect(state.lastSavedAt).toBeNull();
      expect(state.error).toBeNull();
      expect(state.initialNodes).toEqual([]);
      expect(state.initialEdges).toEqual([]);
      expect(state.initialViewport).toBeUndefined();
    });
  });

  // ===========================================================================
  // restore() - Canvas Restoration
  // ===========================================================================

  describe('restore()', () => {
    it('should load existing canvas when ID exists', async () => {
      mockCanvasAPI.getCurrentCanvasId.mockResolvedValue('existing-canvas-id');
      mockCanvasAPI.loadCanvas.mockResolvedValue(mockCanvasState);

      const useStore = await getStore();
      await useStore.getState().restore();

      const state = useStore.getState();
      expect(state.canvasId).toBe('existing-canvas-id');
      expect(state.isLoading).toBe(false);
      expect(state.initialNodes).toEqual([mockNode]);
      expect(state.initialEdges).toEqual([mockEdge]);
      expect(state.initialViewport).toEqual(mockViewport);
      expect(state.error).toBeNull();
    });

    it('should create new canvas when no ID exists', async () => {
      mockCanvasAPI.getCurrentCanvasId.mockResolvedValue(null);

      const useStore = await getStore();
      await useStore.getState().restore();

      const state = useStore.getState();
      expect(state.canvasId).toBe('generated-canvas-id');
      expect(state.isLoading).toBe(false);
      expect(mockCanvasAPI.setCurrentCanvasId).toHaveBeenCalledWith('generated-canvas-id');
    });

    it('should create new canvas when ID exists but canvas not found', async () => {
      mockCanvasAPI.getCurrentCanvasId.mockResolvedValue('missing-canvas-id');
      mockCanvasAPI.loadCanvas.mockResolvedValue(null);

      const useStore = await getStore();
      await useStore.getState().restore();

      const state = useStore.getState();
      expect(state.canvasId).toBe('generated-canvas-id');
      expect(state.isLoading).toBe(false);
      expect(mockCanvasAPI.setCurrentCanvasId).toHaveBeenCalledWith('generated-canvas-id');
    });

    it('should handle API errors gracefully', async () => {
      mockCanvasAPI.getCurrentCanvasId.mockRejectedValue(new Error('API Error'));

      const useStore = await getStore();
      await useStore.getState().restore();

      const state = useStore.getState();
      expect(state.error).toBe('API Error');
      expect(state.isLoading).toBe(false);
      // Should still have a fallback canvas ID
      expect(state.canvasId).toBe('generated-canvas-id');
    });

    it('should not restore twice (guard against double calls)', async () => {
      mockCanvasAPI.getCurrentCanvasId.mockResolvedValue('existing-canvas-id');
      mockCanvasAPI.loadCanvas.mockResolvedValue(mockCanvasState);

      const useStore = await getStore();

      // Call restore twice
      await useStore.getState().restore();
      await useStore.getState().restore();

      // Should only call API once
      expect(mockCanvasAPI.getCurrentCanvasId).toHaveBeenCalledTimes(1);
    });

    it('should handle missing canvasAPI', async () => {
      vi.stubGlobal('window', { canvasAPI: undefined });

      const useStore = await getStore();
      await useStore.getState().restore();

      const state = useStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.canvasId).toBeNull();
    });
  });

  // ===========================================================================
  // persistNodes() - Node Persistence
  // ===========================================================================

  describe('persistNodes()', () => {
    it('should update current nodes and trigger debounced save', async () => {
      mockCanvasAPI.getCurrentCanvasId.mockResolvedValue('canvas-id');
      mockCanvasAPI.loadCanvas.mockResolvedValue({ ...mockCanvasState, id: 'canvas-id' });
      mockCanvasAPI.saveCanvas.mockResolvedValue(undefined);

      const useStore = await getStore();
      await useStore.getState().restore();

      const nodes = [mockNode, { ...mockNode, id: 'node-2' }];
      useStore.getState().persistNodes(nodes);

      // Should not save immediately (debounced)
      expect(mockCanvasAPI.saveCanvas).not.toHaveBeenCalled();

      // Wait for debounce (default 1000ms, but we'll use vi.advanceTimersByTime)
      vi.useFakeTimers();
      useStore.getState().persistNodes(nodes);
      await vi.advanceTimersByTimeAsync(1100);
      vi.useRealTimers();

      expect(mockCanvasAPI.saveCanvas).toHaveBeenCalled();
    });

    it('should not save when canvasId is null', async () => {
      const useStore = await getStore();

      // Don't call restore, so canvasId stays null
      useStore.getState().persistNodes([mockNode]);

      vi.useFakeTimers();
      await vi.advanceTimersByTimeAsync(1100);
      vi.useRealTimers();

      expect(mockCanvasAPI.saveCanvas).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // persistEdges() - Edge Persistence
  // ===========================================================================

  describe('persistEdges()', () => {
    it('should update current edges and trigger debounced save', async () => {
      mockCanvasAPI.getCurrentCanvasId.mockResolvedValue('canvas-id');
      mockCanvasAPI.loadCanvas.mockResolvedValue({ ...mockCanvasState, id: 'canvas-id' });
      mockCanvasAPI.saveCanvas.mockResolvedValue(undefined);

      const useStore = await getStore();
      await useStore.getState().restore();

      vi.useFakeTimers();
      useStore.getState().persistEdges([mockEdge]);
      await vi.advanceTimersByTimeAsync(1100);
      vi.useRealTimers();

      expect(mockCanvasAPI.saveCanvas).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // persistViewport() - Viewport Persistence
  // ===========================================================================

  describe('persistViewport()', () => {
    it('should update current viewport and trigger debounced save', async () => {
      mockCanvasAPI.getCurrentCanvasId.mockResolvedValue('canvas-id');
      mockCanvasAPI.loadCanvas.mockResolvedValue({ ...mockCanvasState, id: 'canvas-id' });
      mockCanvasAPI.saveCanvas.mockResolvedValue(undefined);

      const useStore = await getStore();
      await useStore.getState().restore();

      vi.useFakeTimers();
      useStore.getState().persistViewport({ x: 10, y: 20, zoom: 1.5 });
      await vi.advanceTimersByTimeAsync(1100);
      vi.useRealTimers();

      expect(mockCanvasAPI.saveCanvas).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // saveNow() - Immediate Save
  // ===========================================================================

  describe('saveNow()', () => {
    it('should save immediately without waiting for debounce', async () => {
      mockCanvasAPI.getCurrentCanvasId.mockResolvedValue('canvas-id');
      mockCanvasAPI.loadCanvas.mockResolvedValue({ ...mockCanvasState, id: 'canvas-id' });
      mockCanvasAPI.saveCanvas.mockResolvedValue(undefined);

      const useStore = await getStore();
      await useStore.getState().restore();

      useStore.getState().persistNodes([mockNode]);
      await useStore.getState().saveNow();

      expect(mockCanvasAPI.saveCanvas).toHaveBeenCalled();
    });

    it('should update lastSavedAt on successful save', async () => {
      mockCanvasAPI.getCurrentCanvasId.mockResolvedValue('canvas-id');
      mockCanvasAPI.loadCanvas.mockResolvedValue({ ...mockCanvasState, id: 'canvas-id' });
      mockCanvasAPI.saveCanvas.mockResolvedValue(undefined);

      const useStore = await getStore();
      await useStore.getState().restore();

      const beforeSave = Date.now();
      await useStore.getState().saveNow();
      const afterSave = Date.now();

      const state = useStore.getState();
      expect(state.lastSavedAt).not.toBeNull();
      expect(state.lastSavedAt!.getTime()).toBeGreaterThanOrEqual(beforeSave);
      expect(state.lastSavedAt!.getTime()).toBeLessThanOrEqual(afterSave);
    });

    it('should set isSaving during save operation', async () => {
      let resolveSave: (value?: unknown) => void;
      mockCanvasAPI.saveCanvas.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSave = resolve;
          })
      );
      mockCanvasAPI.getCurrentCanvasId.mockResolvedValue('canvas-id');
      mockCanvasAPI.loadCanvas.mockResolvedValue({ ...mockCanvasState, id: 'canvas-id' });

      const useStore = await getStore();
      await useStore.getState().restore();

      const savePromise = useStore.getState().saveNow();

      // Should be saving
      expect(useStore.getState().isSaving).toBe(true);

      // Resolve save
      resolveSave!();
      await savePromise;

      // Should no longer be saving
      expect(useStore.getState().isSaving).toBe(false);
    });

    it('should set error on save failure', async () => {
      mockCanvasAPI.getCurrentCanvasId.mockResolvedValue('canvas-id');
      mockCanvasAPI.loadCanvas.mockResolvedValue({ ...mockCanvasState, id: 'canvas-id' });
      mockCanvasAPI.saveCanvas.mockRejectedValue(new Error('Save failed'));

      const useStore = await getStore();
      await useStore.getState().restore();

      await useStore.getState().saveNow();

      expect(useStore.getState().error).toBe('Save failed');
    });
  });

  // ===========================================================================
  // flush() - Flush Pending Save
  // ===========================================================================

  describe('flush()', () => {
    it('should execute pending debounced save immediately', async () => {
      mockCanvasAPI.getCurrentCanvasId.mockResolvedValue('canvas-id');
      mockCanvasAPI.loadCanvas.mockResolvedValue({ ...mockCanvasState, id: 'canvas-id' });
      mockCanvasAPI.saveCanvas.mockResolvedValue(undefined);

      const useStore = await getStore();
      await useStore.getState().restore();

      vi.useFakeTimers();
      useStore.getState().persistNodes([mockNode]);

      // Should not have saved yet
      expect(mockCanvasAPI.saveCanvas).not.toHaveBeenCalled();

      // Flush should trigger immediate save
      useStore.getState().flush();
      await vi.advanceTimersByTimeAsync(0);
      vi.useRealTimers();

      expect(mockCanvasAPI.saveCanvas).toHaveBeenCalled();
    });

    it('should do nothing when no pending save', async () => {
      mockCanvasAPI.getCurrentCanvasId.mockResolvedValue('canvas-id');
      mockCanvasAPI.loadCanvas.mockResolvedValue({ ...mockCanvasState, id: 'canvas-id' });

      const useStore = await getStore();
      await useStore.getState().restore();

      // No persist calls, just flush
      useStore.getState().flush();

      expect(mockCanvasAPI.saveCanvas).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Debounce Behavior
  // ===========================================================================

  describe('Debounce Behavior', () => {
    it('should coalesce multiple persist calls into single save', async () => {
      mockCanvasAPI.getCurrentCanvasId.mockResolvedValue('canvas-id');
      mockCanvasAPI.loadCanvas.mockResolvedValue({ ...mockCanvasState, id: 'canvas-id' });
      mockCanvasAPI.saveCanvas.mockResolvedValue(undefined);

      const useStore = await getStore();
      await useStore.getState().restore();

      vi.useFakeTimers();

      // Multiple rapid persist calls
      useStore.getState().persistNodes([mockNode]);
      useStore.getState().persistNodes([mockNode, { ...mockNode, id: 'node-2' }]);
      useStore.getState().persistEdges([mockEdge]);
      useStore.getState().persistViewport(mockViewport);

      // Wait for debounce
      await vi.advanceTimersByTimeAsync(1100);
      vi.useRealTimers();

      // Should only save once
      expect(mockCanvasAPI.saveCanvas).toHaveBeenCalledTimes(1);
    });

    it('should reset debounce timer on each persist call', async () => {
      mockCanvasAPI.getCurrentCanvasId.mockResolvedValue('canvas-id');
      mockCanvasAPI.loadCanvas.mockResolvedValue({ ...mockCanvasState, id: 'canvas-id' });
      mockCanvasAPI.saveCanvas.mockResolvedValue(undefined);

      const useStore = await getStore();
      await useStore.getState().restore();

      vi.useFakeTimers();

      // First persist
      useStore.getState().persistNodes([mockNode]);

      // Wait 500ms (half of debounce time)
      await vi.advanceTimersByTimeAsync(500);

      // Second persist - should reset timer
      useStore.getState().persistNodes([{ ...mockNode, id: 'node-2' }]);

      // Wait another 500ms - still shouldn't have saved
      await vi.advanceTimersByTimeAsync(500);
      expect(mockCanvasAPI.saveCanvas).not.toHaveBeenCalled();

      // Wait full debounce time from last persist
      await vi.advanceTimersByTimeAsync(600);
      vi.useRealTimers();

      expect(mockCanvasAPI.saveCanvas).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // Configuration
  // ===========================================================================

  describe('Configuration', () => {
    it('should use custom debounce time when configured', async () => {
      mockCanvasAPI.getCurrentCanvasId.mockResolvedValue('canvas-id');
      mockCanvasAPI.loadCanvas.mockResolvedValue({ ...mockCanvasState, id: 'canvas-id' });
      mockCanvasAPI.saveCanvas.mockResolvedValue(undefined);

      const useStore = await getStore();
      await useStore.getState().restore();

      // Configure custom debounce time
      useStore.getState().configure({ debounceMs: 500 });

      vi.useFakeTimers();
      useStore.getState().persistNodes([mockNode]);

      // Wait 400ms - should not have saved yet
      await vi.advanceTimersByTimeAsync(400);
      expect(mockCanvasAPI.saveCanvas).not.toHaveBeenCalled();

      // Wait additional 200ms - should have saved now
      await vi.advanceTimersByTimeAsync(200);
      vi.useRealTimers();

      expect(mockCanvasAPI.saveCanvas).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Reset
  // ===========================================================================

  describe('reset()', () => {
    it('should reset store to initial state', async () => {
      mockCanvasAPI.getCurrentCanvasId.mockResolvedValue('canvas-id');
      mockCanvasAPI.loadCanvas.mockResolvedValue({ ...mockCanvasState, id: 'canvas-id' });

      const useStore = await getStore();
      await useStore.getState().restore();

      // Verify state was set
      expect(useStore.getState().canvasId).toBe('canvas-id');

      // Reset
      useStore.getState().reset();

      // Should be back to initial state
      const state = useStore.getState();
      expect(state.canvasId).toBeNull();
      expect(state.isLoading).toBe(true);
      expect(state.initialNodes).toEqual([]);
      expect(state.initialEdges).toEqual([]);
    });
  });
});

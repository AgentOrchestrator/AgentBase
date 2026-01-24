/**
 * Node Change Utils Tests
 *
 * Tests for the extracted utility functions that detect ReactFlow change types.
 * These utilities are used by handleNodesChange in Canvas.tsx to determine
 * when to persist canvas state.
 *
 * BUG FIXED: Keyboard node deletion (Delete/Backspace) was not triggering
 * canvas persistence because handleNodesChange only checked for 'position'
 * type changes, ignoring 'remove' type changes.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hasPositionChanges,
  hasRemoveChanges,
  type NodeChangeForDetection,
} from '../../utils/nodeChangeUtils';

describe('nodeChangeUtils', () => {
  describe('hasRemoveChanges', () => {
    it('should return true when changes include a remove type', () => {
      const changes: NodeChangeForDetection[] = [{ type: 'remove', id: 'node-1' }];

      expect(hasRemoveChanges(changes)).toBe(true);
    });

    it('should return false when changes do not include a remove type', () => {
      const changes: NodeChangeForDetection[] = [
        { type: 'position', id: 'node-1', position: { x: 100, y: 200 } },
        { type: 'select', id: 'node-2' },
      ];

      expect(hasRemoveChanges(changes)).toBe(false);
    });

    it('should return true when mixed changes include a remove type', () => {
      const changes: NodeChangeForDetection[] = [
        { type: 'select', id: 'node-1' },
        { type: 'remove', id: 'node-2' },
        { type: 'position', id: 'node-3', position: { x: 0, y: 0 } },
      ];

      expect(hasRemoveChanges(changes)).toBe(true);
    });

    it('should return false for empty changes array', () => {
      const changes: NodeChangeForDetection[] = [];

      expect(hasRemoveChanges(changes)).toBe(false);
    });

    it('should return true when multiple nodes are removed simultaneously', () => {
      const changes: NodeChangeForDetection[] = [
        { type: 'remove', id: 'node-1' },
        { type: 'remove', id: 'node-2' },
        { type: 'remove', id: 'node-3' },
      ];

      expect(hasRemoveChanges(changes)).toBe(true);
    });
  });

  describe('hasPositionChanges', () => {
    it('should return true when changes include a position type', () => {
      const changes: NodeChangeForDetection[] = [
        { type: 'position', id: 'node-1', position: { x: 100, y: 200 } },
      ];

      expect(hasPositionChanges(changes)).toBe(true);
    });

    it('should return false when changes do not include a position type', () => {
      const changes: NodeChangeForDetection[] = [
        { type: 'remove', id: 'node-1' },
        { type: 'select', id: 'node-2' },
      ];

      expect(hasPositionChanges(changes)).toBe(false);
    });

    it('should return false for empty changes array', () => {
      const changes: NodeChangeForDetection[] = [];

      expect(hasPositionChanges(changes)).toBe(false);
    });
  });

  describe('integration: persistence triggering logic', () => {
    /**
     * This test documents the expected behavior of handleNodesChange:
     * - Remove changes SHOULD trigger persistence
     * - Position changes should NOT trigger persistence (handled by debounced effect)
     * - Select changes should NOT trigger persistence
     */

    type MockNode = { id: string; type: string; position: { x: number; y: number }; data: object };
    let mockPersistNodes: ReturnType<typeof vi.fn<(nodes: MockNode[]) => void>>;
    let mockGetNodes: ReturnType<typeof vi.fn<() => MockNode[]>>;

    beforeEach(() => {
      mockPersistNodes = vi.fn<(nodes: MockNode[]) => void>();
      mockGetNodes = vi.fn<() => MockNode[]>();
    });

    it('should trigger persistNodes when remove change is detected', () => {
      const nodesAfterRemoval = [
        { id: 'node-2', type: 'agent', position: { x: 100, y: 0 }, data: {} },
      ];
      mockGetNodes.mockReturnValue(nodesAfterRemoval);

      const changes: NodeChangeForDetection[] = [{ type: 'remove', id: 'node-1' }];

      // Simulate handleNodesChange logic:
      // After processing changes, check if persistence is needed
      if (hasRemoveChanges(changes)) {
        const updatedNodes = mockGetNodes();
        mockPersistNodes(updatedNodes);
      }

      expect(mockPersistNodes).toHaveBeenCalledTimes(1);
      expect(mockPersistNodes).toHaveBeenCalledWith(nodesAfterRemoval);
    });

    it('should NOT trigger persistNodes for position changes', () => {
      const changes: NodeChangeForDetection[] = [
        { type: 'position', id: 'node-1', position: { x: 50, y: 50 } },
      ];

      // Position changes are handled by a separate debounced effect
      if (hasRemoveChanges(changes)) {
        mockPersistNodes(mockGetNodes());
      }

      expect(mockPersistNodes).not.toHaveBeenCalled();
    });

    it('should NOT trigger persistNodes for select changes', () => {
      const changes: NodeChangeForDetection[] = [{ type: 'select', id: 'node-1' }];

      if (hasRemoveChanges(changes)) {
        mockPersistNodes(mockGetNodes());
      }

      expect(mockPersistNodes).not.toHaveBeenCalled();
    });

    it('should persist once when multiple nodes are deleted simultaneously', () => {
      const nodesAfterRemoval = [
        { id: 'node-3', type: 'agent', position: { x: 200, y: 0 }, data: {} },
      ];
      mockGetNodes.mockReturnValue(nodesAfterRemoval);

      const changes: NodeChangeForDetection[] = [
        { type: 'remove', id: 'node-1' },
        { type: 'remove', id: 'node-2' },
      ];

      // hasRemoveChanges returns true once for the whole batch
      if (hasRemoveChanges(changes)) {
        const updatedNodes = mockGetNodes();
        mockPersistNodes(updatedNodes);
      }

      // Should only persist once, not once per removed node
      expect(mockPersistNodes).toHaveBeenCalledTimes(1);
      expect(mockPersistNodes).toHaveBeenCalledWith(nodesAfterRemoval);
    });

    it('should persist empty array when last node is deleted', () => {
      const nodesAfterRemoval: MockNode[] = [];
      mockGetNodes.mockReturnValue(nodesAfterRemoval);

      const changes: NodeChangeForDetection[] = [{ type: 'remove', id: 'node-1' }];

      if (hasRemoveChanges(changes)) {
        const updatedNodes = mockGetNodes();
        mockPersistNodes(updatedNodes);
      }

      expect(mockPersistNodes).toHaveBeenCalledTimes(1);
      expect(mockPersistNodes).toHaveBeenCalledWith([]);
    });
  });
});

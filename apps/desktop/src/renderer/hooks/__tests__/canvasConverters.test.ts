/**
 * Canvas Converters Tests
 *
 * Tests the PURE CONVERSION logic between React Flow types and database types.
 * These converters handle the transformation of nodes, edges, and viewports.
 *
 * Key behaviors tested:
 * - Deep cloning to prevent shared reference issues
 * - Round-trip conversion (RF -> DB -> RF) preserves data
 * - Optional fields are handled correctly
 */

import type { Edge, Node, Viewport } from '@xyflow/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasEdge, CanvasNode, Viewport as DbViewport } from '../../../main/types/database';

// Mock nodeRegistry before importing canvasConverters
vi.mock('../../nodes/registry', () => ({
  nodeRegistry: {
    isPersistedType: vi.fn((type: string) => type !== 'starter'),
    validateNodeData: vi.fn(() => ({ success: true })),
  },
}));

import { nodeRegistry } from '../../nodes/registry';
import {
  canvasEdgesToEdges,
  canvasNodesToNodes,
  dbViewportToViewport,
  edgesToCanvasEdges,
  generateCanvasId,
  nodesToCanvasNodes,
  viewportToDbViewport,
} from '../canvasConverters';

describe('canvasConverters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // canvasNodesToNodes (pure function - no registry dependency)
  // ===========================================================================

  describe('canvasNodesToNodes', () => {
    it('converts canvas nodes to React Flow nodes', () => {
      const canvasNodes: CanvasNode[] = [
        {
          id: 'node-1',
          type: 'agent',
          position: { x: 100, y: 200 },
          data: { label: 'Test Agent' },
        },
      ];

      const result = canvasNodesToNodes(canvasNodes);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('node-1');
      expect(result[0].type).toBe('agent');
      expect(result[0].position).toEqual({ x: 100, y: 200 });
      expect(result[0].data).toEqual({ label: 'Test Agent' });
    });

    it('deep clones data to prevent shared references', () => {
      const canvasNodes: CanvasNode[] = [
        {
          id: 'node-1',
          type: 'agent',
          position: { x: 0, y: 0 },
          data: { nested: { value: 1 } },
        },
      ];

      const result1 = canvasNodesToNodes(canvasNodes);
      const result2 = canvasNodesToNodes(canvasNodes);

      // Mutating one shouldn't affect the other
      (result1[0].data as Record<string, unknown>).nested = { value: 999 };
      expect((result2[0].data as Record<string, { value: number }>).nested.value).toBe(1);
    });

    it('clones position to prevent shared references', () => {
      const canvasNodes: CanvasNode[] = [
        {
          id: 'node-1',
          type: 'agent',
          position: { x: 10, y: 20 },
          data: {},
        },
      ];

      const result = canvasNodesToNodes(canvasNodes);

      // Mutating result position shouldn't affect original
      result[0].position.x = 999;
      expect(canvasNodes[0].position.x).toBe(10);
    });

    it('handles style property', () => {
      const canvasNodes: CanvasNode[] = [
        {
          id: 'node-1',
          type: 'custom',
          position: { x: 0, y: 0 },
          data: {},
          style: { width: 200, height: 100 },
        },
      ];

      const result = canvasNodesToNodes(canvasNodes);

      expect(result[0].style).toEqual({ width: 200, height: 100 });
    });

    it('handles undefined style', () => {
      const canvasNodes: CanvasNode[] = [
        {
          id: 'node-1',
          type: 'agent',
          position: { x: 0, y: 0 },
          data: {},
        },
      ];

      const result = canvasNodesToNodes(canvasNodes);

      expect(result[0].style).toBeUndefined();
    });

    it('converts multiple nodes', () => {
      const canvasNodes: CanvasNode[] = [
        { id: 'node-1', type: 'agent', position: { x: 0, y: 0 }, data: { a: 1 } },
        { id: 'node-2', type: 'terminal', position: { x: 100, y: 100 }, data: { b: 2 } },
        { id: 'node-3', type: 'custom', position: { x: 200, y: 200 }, data: { c: 3 } },
      ];

      const result = canvasNodesToNodes(canvasNodes);

      expect(result).toHaveLength(3);
      expect(result.map((n) => n.id)).toEqual(['node-1', 'node-2', 'node-3']);
    });

    it('handles empty array', () => {
      const result = canvasNodesToNodes([]);
      expect(result).toEqual([]);
    });
  });

  // ===========================================================================
  // nodesToCanvasNodes (depends on nodeRegistry - mocked)
  // ===========================================================================

  describe('nodesToCanvasNodes', () => {
    it('converts React Flow nodes to canvas nodes', () => {
      const nodes: Node[] = [
        {
          id: 'node-1',
          type: 'agent',
          position: { x: 100, y: 200 },
          data: { label: 'Test' },
        },
      ];

      const result = nodesToCanvasNodes(nodes);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('node-1');
      expect(result[0].type).toBe('agent');
      expect(result[0].position).toEqual({ x: 100, y: 200 });
    });

    it('filters out non-persistent node types', () => {
      const nodes: Node[] = [
        { id: 'node-1', type: 'agent', position: { x: 0, y: 0 }, data: {} },
        { id: 'node-2', type: 'starter', position: { x: 100, y: 0 }, data: {} }, // Non-persistent
        { id: 'node-3', type: 'terminal', position: { x: 200, y: 0 }, data: {} },
      ];

      const result = nodesToCanvasNodes(nodes);

      expect(result).toHaveLength(2);
      expect(result.map((n) => n.id)).toEqual(['node-1', 'node-3']);
      expect(nodeRegistry.isPersistedType).toHaveBeenCalledWith('starter');
    });

    it('defaults to "custom" type when type is undefined', () => {
      const nodes: Node[] = [
        { id: 'node-1', position: { x: 0, y: 0 }, data: { label: 'No type' } },
      ];

      const result = nodesToCanvasNodes(nodes);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('custom');
    });

    it('validates node data against schema', () => {
      const nodes: Node[] = [
        { id: 'node-1', type: 'agent', position: { x: 0, y: 0 }, data: { invalid: true } },
      ];

      nodesToCanvasNodes(nodes);

      expect(nodeRegistry.validateNodeData).toHaveBeenCalledWith('agent', { invalid: true });
    });

    it('includes style in converted nodes', () => {
      const nodes: Node[] = [
        {
          id: 'node-1',
          type: 'custom',
          position: { x: 0, y: 0 },
          data: {},
          style: { width: 300 },
        },
      ];

      const result = nodesToCanvasNodes(nodes);

      expect(result[0].style).toEqual({ width: 300 });
    });
  });

  // ===========================================================================
  // Edge Converters (pure functions)
  // ===========================================================================

  describe('edgesToCanvasEdges', () => {
    it('converts React Flow edges to canvas edges', () => {
      const edges: Edge[] = [{ id: 'edge-1', source: 'node-1', target: 'node-2' }];

      const result = edgesToCanvasEdges(edges);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        type: undefined,
        data: undefined,
        style: undefined,
      });
    });

    it('preserves edge type and data', () => {
      const edges: Edge[] = [
        {
          id: 'edge-1',
          source: 'node-1',
          target: 'node-2',
          type: 'smoothstep',
          data: { label: 'Connection' },
        },
      ];

      const result = edgesToCanvasEdges(edges);

      expect(result[0].type).toBe('smoothstep');
      expect(result[0].data).toEqual({ label: 'Connection' });
    });

    it('converts multiple edges', () => {
      const edges: Edge[] = [
        { id: 'edge-1', source: 'a', target: 'b' },
        { id: 'edge-2', source: 'b', target: 'c' },
        { id: 'edge-3', source: 'c', target: 'd' },
      ];

      const result = edgesToCanvasEdges(edges);

      expect(result).toHaveLength(3);
    });
  });

  describe('canvasEdgesToEdges', () => {
    it('converts canvas edges to React Flow edges', () => {
      const canvasEdges: CanvasEdge[] = [{ id: 'edge-1', source: 'node-1', target: 'node-2' }];

      const result = canvasEdgesToEdges(canvasEdges);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('edge-1');
      expect(result[0].source).toBe('node-1');
      expect(result[0].target).toBe('node-2');
    });

    it('preserves optional properties', () => {
      const canvasEdges: CanvasEdge[] = [
        {
          id: 'edge-1',
          source: 'node-1',
          target: 'node-2',
          type: 'bezier',
          data: { weight: 5 },
          style: { stroke: '#red' },
        },
      ];

      const result = canvasEdgesToEdges(canvasEdges);

      expect(result[0].type).toBe('bezier');
      expect(result[0].data).toEqual({ weight: 5 });
      expect(result[0].style).toEqual({ stroke: '#red' });
    });
  });

  describe('edge round-trip conversion', () => {
    it('round-trips edges correctly', () => {
      const originalEdges: Edge[] = [
        { id: 'edge-1', source: 'node-1', target: 'node-2' },
        { id: 'edge-2', source: 'node-2', target: 'node-3', type: 'step' },
      ];

      const canvas = edgesToCanvasEdges(originalEdges);
      const result = canvasEdgesToEdges(canvas);

      expect(result[0].id).toBe('edge-1');
      expect(result[0].source).toBe('node-1');
      expect(result[0].target).toBe('node-2');
      expect(result[1].type).toBe('step');
    });
  });

  // ===========================================================================
  // Viewport Converters (pure functions)
  // ===========================================================================

  describe('viewportToDbViewport', () => {
    it('converts React Flow viewport to database viewport', () => {
      const viewport: Viewport = { x: 10, y: 20, zoom: 1.5 };

      const result = viewportToDbViewport(viewport);

      expect(result).toEqual({ x: 10, y: 20, zoom: 1.5 });
    });
  });

  describe('dbViewportToViewport', () => {
    it('converts database viewport to React Flow viewport', () => {
      const dbViewport: DbViewport = { x: -50, y: 100, zoom: 0.8 };

      const result = dbViewportToViewport(dbViewport);

      expect(result).toEqual({ x: -50, y: 100, zoom: 0.8 });
    });
  });

  describe('viewport round-trip conversion', () => {
    it('round-trips viewport correctly', () => {
      const original: Viewport = { x: 123.45, y: -67.89, zoom: 2.0 };

      const db = viewportToDbViewport(original);
      const result = dbViewportToViewport(db);

      expect(result).toEqual(original);
    });
  });

  // ===========================================================================
  // generateCanvasId
  // ===========================================================================

  describe('generateCanvasId', () => {
    it('generates unique IDs', () => {
      const id1 = generateCanvasId();
      const id2 = generateCanvasId();

      expect(id1).not.toBe(id2);
    });

    it('starts with "canvas-" prefix', () => {
      const id = generateCanvasId();

      expect(id.startsWith('canvas-')).toBe(true);
    });

    it('contains timestamp and random suffix', () => {
      const id = generateCanvasId();
      const parts = id.split('-');

      // Format: canvas-<timestamp>-<random>
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('canvas');
      expect(Number(parts[1])).toBeGreaterThan(0); // Timestamp
      expect(parts[2].length).toBeGreaterThan(0); // Random suffix
    });
  });
});

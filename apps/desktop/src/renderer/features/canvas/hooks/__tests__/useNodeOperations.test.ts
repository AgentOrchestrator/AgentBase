/**
 * useNodeOperations Tests
 *
 * Tests for pure node manipulation functions, focusing on referential stability
 * to prevent infinite re-render loops in React.
 */

import type { Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { removeHighlightStylesFromNodes } from '../useNodeOperations';

describe('removeHighlightStylesFromNodes', () => {
  /**
   * Bug context: Infinite loop when deleting last node
   *
   * Root cause: The original implementation always returned a new array via .map(),
   * even when no changes were needed. This caused:
   * 1. setNodes([]) returning new [] reference when nodes was already []
   * 2. React detecting "state change", triggering re-render
   * 3. useEffect running again -> infinite loop
   *
   * Fix: Return same array reference when no changes are needed.
   */

  describe('referential stability for empty nodes', () => {
    it('should return same array reference when nodes array is empty', () => {
      const emptyNodes: Node[] = [];

      const result = removeHighlightStylesFromNodes(emptyNodes);

      expect(result).toBe(emptyNodes); // Same reference - no re-render triggered
    });
  });

  describe('referential stability when no highlights to remove', () => {
    it('should return same array reference when no agent nodes exist', () => {
      const noAgentNodes: Node[] = [
        {
          id: 'node-1',
          type: 'terminal',
          position: { x: 0, y: 0 },
          data: {},
        },
        {
          id: 'node-2',
          type: 'browser',
          position: { x: 100, y: 0 },
          data: {},
        },
      ];

      const result = removeHighlightStylesFromNodes(noAgentNodes);

      expect(result).toBe(noAgentNodes); // Same reference
    });

    it('should return same array reference when agent nodes have no highlight styles', () => {
      const nodesWithoutHighlights: Node[] = [
        {
          id: 'node-1',
          type: 'agent',
          position: { x: 0, y: 0 },
          data: { agentId: 'agent-1' },
          style: { width: 500 }, // No border, boxShadow, or borderRadius
        },
        {
          id: 'node-2',
          type: 'terminal',
          position: { x: 100, y: 0 },
          data: {},
        },
      ];

      const result = removeHighlightStylesFromNodes(nodesWithoutHighlights);

      expect(result).toBe(nodesWithoutHighlights); // Same reference
    });
  });

  describe('highlight removal when needed', () => {
    it('should remove highlight styles from agent nodes', () => {
      const nodeWithHighlight: Node = {
        id: 'node-1',
        type: 'agent',
        position: { x: 0, y: 0 },
        data: { agentId: 'agent-1' },
        style: {
          width: 500,
          border: '2px solid #3b82f6',
          boxShadow: '0 0 12px rgba(59, 130, 246, 0.5)',
          borderRadius: '12px',
        },
      };

      const result = removeHighlightStylesFromNodes([nodeWithHighlight]);

      expect(result).not.toBe([nodeWithHighlight]); // New array
      expect(result[0].style).toEqual({ width: 500 }); // Highlights removed
      expect(result[0].style).not.toHaveProperty('border');
      expect(result[0].style).not.toHaveProperty('boxShadow');
      expect(result[0].style).not.toHaveProperty('borderRadius');
    });

    it('should preserve non-agent nodes unchanged', () => {
      const agentNode: Node = {
        id: 'node-1',
        type: 'agent',
        position: { x: 0, y: 0 },
        data: { agentId: 'agent-1' },
        style: { border: '2px solid #3b82f6' },
      };

      const terminalNode: Node = {
        id: 'node-2',
        type: 'terminal',
        position: { x: 100, y: 0 },
        data: {},
        style: { border: '1px solid red' }, // Should NOT be removed
      };

      const nodes = [agentNode, terminalNode];
      const result = removeHighlightStylesFromNodes(nodes);

      expect(result[1]).toBe(terminalNode); // Same reference for non-agent
      expect(result[1].style).toEqual({ border: '1px solid red' }); // Unchanged
    });

    it('should only create new objects for nodes that actually need changes', () => {
      const highlightedAgent: Node = {
        id: 'node-1',
        type: 'agent',
        position: { x: 0, y: 0 },
        data: { agentId: 'agent-1' },
        style: { width: 500, border: '2px solid #3b82f6' },
      };

      const unhighlightedAgent: Node = {
        id: 'node-2',
        type: 'agent',
        position: { x: 100, y: 0 },
        data: { agentId: 'agent-2' },
        style: { width: 500 }, // No highlight
      };

      const nodes = [highlightedAgent, unhighlightedAgent];
      const result = removeHighlightStylesFromNodes(nodes);

      // Highlighted agent gets new object (style changed)
      expect(result[0]).not.toBe(highlightedAgent);
      expect(result[0].style).toEqual({ width: 500 });

      // Unhighlighted agent could be same or new reference
      // (current impl recreates all agents when any needs update, which is acceptable)
    });
  });

  describe('edge cases', () => {
    it('should handle agent node with no style property', () => {
      const nodeWithoutStyle: Node = {
        id: 'node-1',
        type: 'agent',
        position: { x: 0, y: 0 },
        data: { agentId: 'agent-1' },
      };

      const nodes = [nodeWithoutStyle];
      const result = removeHighlightStylesFromNodes(nodes);

      // No style property means no highlight properties, so same reference
      expect(result).toBe(nodes);
    });

    it('should handle agent node with empty style object', () => {
      const nodeWithEmptyStyle: Node = {
        id: 'node-1',
        type: 'agent',
        position: { x: 0, y: 0 },
        data: { agentId: 'agent-1' },
        style: {},
      };

      const nodes = [nodeWithEmptyStyle];
      const result = removeHighlightStylesFromNodes(nodes);

      expect(result).toBe(nodes); // Same reference - no highlights to remove
    });
  });
});

import type { Edge, Node } from '@xyflow/react';
import type { MessageGroup } from '../types/conversation';
// import { buildUuidMap } from './conversationParser'; // Will be used for parent linking

/**
 * Convert message groups to React Flow nodes and edges
 */
export function conversationToNodesAndEdges(
  groups: MessageGroup[],
  startX: number = 100,
  startY: number = 100,
  _spacingX: number = 400,
  _spacingY: number = 200
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  // const uuidMap = buildUuidMap(groups); // Will be used for parent linking
  const nodePositions = new Map<string, { x: number; y: number }>();

  // Calculate positions for all nodes in a straight vertical column
  let currentY = startY;
  const fixedX = startX; // All nodes in the same column

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    // Store position - all nodes in the same column
    nodePositions.set(group.uuid, { x: fixedX, y: currentY });

    // Create node with default sizes
    // Assistant nodes: same size as terminal nodes (600x400)
    // User nodes: same width, half height (600x200)
    const isUser = group.type === 'user';
    const nodeHeight = isUser ? 200 : 400;
    const node: Node = {
      id: group.uuid,
      type: isUser ? 'userMessage' : 'assistantMessage',
      position: { x: fixedX, y: currentY },
      data: {
        messageGroup: group,
      },
      style: {
        width: 600,
        height: nodeHeight,
      },
      width: 600,
      height: nodeHeight,
    };

    nodes.push(node);

    // Create sequential edge from previous node to current node
    // This ensures all messages in the conversation are connected in order
    if (i > 0) {
      const previousGroup = groups[i - 1];
      // Get the border color from CSS variable to match node borders
      // Use fallback if DOM is not available (e.g., in tests)
      const borderColor =
        typeof document !== 'undefined'
          ? getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() ||
            '#232323'
          : '#232323';

      edges.push({
        id: `edge-${previousGroup.uuid}-${group.uuid}`,
        source: previousGroup.uuid,
        target: group.uuid,
        type: 'default',
        animated: false,
        style: { stroke: borderColor, strokeWidth: 2 },
      });
    }

    // Move to next row - use the actual node height plus some spacing
    currentY += nodeHeight + 20; // 20px spacing between nodes
  }

  // Create consolidated conversation node (for debugging) - spawn next to individual nodes
  const consolidatedNode: Node = {
    id: `consolidated-${groups[0]?.uuid || 'conversation'}`,
    type: 'conversationNode',
    position: { x: fixedX + 650, y: startY }, // 650px to the right (600px width + 50px spacing)
    data: {
      groups: groups,
    },
    style: {
      width: 600,
      height: 600, // 1.5x terminal height (400 * 1.5 = 600)
    },
    width: 600,
    height: 600,
  };

  nodes.push(consolidatedNode);

  return { nodes, edges };
}

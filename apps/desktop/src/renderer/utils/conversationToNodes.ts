import type { Node, Edge } from '@xyflow/react';
import type { MessageGroup } from '../types/conversation';
import { buildUuidMap } from './conversationParser';

/**
 * Convert message groups to React Flow nodes and edges
 */
export function conversationToNodesAndEdges(
  groups: MessageGroup[],
  startX: number = 100,
  startY: number = 100,
  spacingX: number = 400,
  spacingY: number = 200
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const uuidMap = buildUuidMap(groups);
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
      edges.push({
        id: `edge-${previousGroup.uuid}-${group.uuid}`,
        source: previousGroup.uuid,
        target: group.uuid,
        type: 'smooth',
        animated: false,
        style: { stroke: '#4a5568', strokeWidth: 2 },
      });
    }

    // Move to next row - use the actual node height plus some spacing
    currentY += nodeHeight + 20; // 20px spacing between nodes
  }

  return { nodes, edges };
}

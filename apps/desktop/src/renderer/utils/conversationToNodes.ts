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

  for (const group of groups) {
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

    // Create edge to parent if exists
    if (group.parentUuid && uuidMap.has(group.parentUuid)) {
      edges.push({
        id: `edge-${group.parentUuid}-${group.uuid}`,
        source: group.parentUuid,
        target: group.uuid,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#4a5568', strokeWidth: 2 },
      });
    }

    // Move to next row - use the actual node height plus some spacing
    currentY += nodeHeight + 20; // 20px spacing between nodes
  }

  return { nodes, edges };
}

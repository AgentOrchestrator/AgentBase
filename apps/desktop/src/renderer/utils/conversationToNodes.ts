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

  // Calculate positions for all nodes
  let currentY = startY;
  let maxX = startX;

  for (const group of groups) {
    // Find parent node position if exists
    let x = startX;
    if (group.parentUuid) {
      const parentPos = nodePositions.get(group.parentUuid);
      if (parentPos) {
        x = parentPos.x + spacingX;
      }
    }

    // Store position
    nodePositions.set(group.uuid, { x, y: currentY });
    maxX = Math.max(maxX, x);

    // Create node
    const node: Node = {
      id: group.uuid,
      type: group.type === 'user' ? 'userMessage' : 'assistantMessage',
      position: { x, y: currentY },
      data: {
        messageGroup: group,
      },
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

    // Move to next row
    currentY += spacingY;
  }

  return { nodes, edges };
}

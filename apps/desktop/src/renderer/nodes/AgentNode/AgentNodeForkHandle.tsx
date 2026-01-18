import { Handle, Position } from '@xyflow/react';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface AgentNodeForkHandleProps {
  nodeId?: string;
}

/**
 * Distance from the edge (in pixels) within which handles become visible.
 */
const EDGE_THRESHOLD = 50;

/**
 * Defines the discrete anchor points around the node border.
 * Each point has a position (which edge), an ID, and percentage along that edge.
 */
interface AnchorPoint {
  id: string;
  position: Position;
  percent: number; // 0-100, position along the edge
}

/**
 * Generate anchor points around the border.
 * 12 total points: 4 corners + 2 per side (middle positions)
 */
const ANCHOR_POINTS: AnchorPoint[] = [
  // Corners (positioned at edges, React Flow will place at corner intersections)
  { id: 'fork-corner-tl', position: Position.Top, percent: 0 }, // Top-left
  { id: 'fork-corner-tr', position: Position.Top, percent: 100 }, // Top-right
  { id: 'fork-corner-br', position: Position.Bottom, percent: 100 }, // Bottom-right
  { id: 'fork-corner-bl', position: Position.Bottom, percent: 0 }, // Bottom-left
  // Top edge (2 points)
  { id: 'fork-top-1', position: Position.Top, percent: 33 },
  { id: 'fork-top-2', position: Position.Top, percent: 67 },
  // Right edge (2 points)
  { id: 'fork-right-1', position: Position.Right, percent: 33 },
  { id: 'fork-right-2', position: Position.Right, percent: 67 },
  // Bottom edge (2 points)
  { id: 'fork-bottom-1', position: Position.Bottom, percent: 33 },
  { id: 'fork-bottom-2', position: Position.Bottom, percent: 67 },
  // Left edge (2 points)
  { id: 'fork-left-1', position: Position.Left, percent: 33 },
  { id: 'fork-left-2', position: Position.Left, percent: 67 },
];

/**
 * Find the closest anchor point to the mouse position.
 */
function findClosestAnchor(mouseX: number, mouseY: number, nodeRect: DOMRect): AnchorPoint | null {
  const { left, top, width, height } = nodeRect;
  const right = left + width;
  const bottom = top + height;

  // Check if mouse is near any edge
  const distToTop = Math.abs(mouseY - top);
  const distToBottom = Math.abs(mouseY - bottom);
  const distToLeft = Math.abs(mouseX - left);
  const distToRight = Math.abs(mouseX - right);

  const minDist = Math.min(distToTop, distToBottom, distToLeft, distToRight);

  // Only show if within threshold of an edge
  if (minDist > EDGE_THRESHOLD) {
    return null;
  }

  // Calculate anchor positions in screen coordinates and find closest
  let closestAnchor: AnchorPoint | null = null;
  let closestDistance = Infinity;

  for (const anchor of ANCHOR_POINTS) {
    let anchorX: number;
    let anchorY: number;

    switch (anchor.position) {
      case Position.Top:
        anchorX = left + (width * anchor.percent) / 100;
        anchorY = top;
        break;
      case Position.Bottom:
        anchorX = left + (width * anchor.percent) / 100;
        anchorY = bottom;
        break;
      case Position.Left:
        anchorX = left;
        anchorY = top + (height * anchor.percent) / 100;
        break;
      case Position.Right:
        anchorX = right;
        anchorY = top + (height * anchor.percent) / 100;
        break;
      default:
        continue;
    }

    const distance = Math.sqrt((mouseX - anchorX) ** 2 + (mouseY - anchorY) ** 2);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestAnchor = anchor;
    }
  }

  // Only return if within reasonable distance to the anchor
  if (closestDistance > EDGE_THRESHOLD * 1.5) {
    return null;
  }

  return closestAnchor;
}

/**
 * Extra padding outside the node where we still track mouse movement.
 * This should be at least as large as the handle offset (16px) plus some buffer.
 */
const OUTER_PADDING = 30;

export function AgentNodeForkHandle({ nodeId }: AgentNodeForkHandleProps) {
  const [activeAnchor, setActiveAnchor] = useState<AnchorPoint | null>(null);
  const nodeRef = useRef<HTMLElement | null>(null);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!nodeRef.current) {
        const nodeElement = document.querySelector(`[data-id="${nodeId}"]`) as HTMLElement;
        if (!nodeElement) return;
        nodeRef.current = nodeElement;
      }

      const nodeRect = nodeRef.current.getBoundingClientRect();

      // Check if mouse is within the expanded bounding box (node + outer padding)
      const expandedLeft = nodeRect.left - OUTER_PADDING;
      const expandedRight = nodeRect.right + OUTER_PADDING;
      const expandedTop = nodeRect.top - OUTER_PADDING;
      const expandedBottom = nodeRect.bottom + OUTER_PADDING;

      const isInExpandedArea =
        e.clientX >= expandedLeft &&
        e.clientX <= expandedRight &&
        e.clientY >= expandedTop &&
        e.clientY <= expandedBottom;

      if (!isInExpandedArea) {
        setActiveAnchor(null);
        return;
      }

      const closest = findClosestAnchor(e.clientX, e.clientY, nodeRect);
      setActiveAnchor(closest);
    },
    [nodeId]
  );

  useEffect(() => {
    if (!nodeId) return;

    const nodeElement = document.querySelector(`[data-id="${nodeId}"]`) as HTMLElement;
    if (!nodeElement) return;
    nodeRef.current = nodeElement;

    // Listen on document to capture mouse movement outside the node
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [nodeId, handleMouseMove]);

  const getStyleForAnchor = (anchor: AnchorPoint): React.CSSProperties => {
    switch (anchor.position) {
      case Position.Top:
        return { left: `${anchor.percent}%`, top: 0 };
      case Position.Bottom:
        return { left: `${anchor.percent}%`, bottom: 0 };
      case Position.Left:
        return { left: 0, top: `${anchor.percent}%` };
      case Position.Right:
        return { right: 0, top: `${anchor.percent}%` };
      default:
        return {};
    }
  };

  const handleForkClick = useCallback(
    (anchor: AnchorPoint) => {
      if (!nodeId) return;
      window.dispatchEvent(
        new CustomEvent('agent-node:fork-click', {
          detail: { nodeId, position: anchor.position },
        })
      );
    },
    [nodeId]
  );

  const createMouseDownHandler = (anchor: AnchorPoint) => (e: React.MouseEvent) => {
    if (!nodeId) return;
    e.stopPropagation();

    let hasMoved = false;
    const startX = e.clientX;
    const startY = e.clientY;

    const handleMouseMoveOnDrag = (moveEvent: MouseEvent) => {
      const deltaX = Math.abs(moveEvent.clientX - startX);
      const deltaY = Math.abs(moveEvent.clientY - startY);
      if (deltaX > 5 || deltaY > 5) {
        hasMoved = true;
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMoveOnDrag);
      document.removeEventListener('mouseup', handleMouseUp);
      if (!hasMoved) {
        upEvent.stopPropagation();
        handleForkClick(anchor);
      }
    };

    document.addEventListener('mousemove', handleMouseMoveOnDrag);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <>
      {ANCHOR_POINTS.map((anchor) => {
        const isActive = activeAnchor?.id === anchor.id;
        const style = getStyleForAnchor(anchor);

        return (
          <Handle
            key={anchor.id}
            type="source"
            position={anchor.position}
            id={anchor.id}
            className={`agent-node-fork-anchor ${isActive ? 'active' : ''}`}
            style={{
              ...style,
              opacity: isActive ? 1 : 0,
              pointerEvents: isActive ? 'auto' : 'none',
            }}
            onMouseDown={createMouseDownHandler(anchor)}
          />
        );
      })}
    </>
  );
}

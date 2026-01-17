import { Handle, Position } from '@xyflow/react';

export interface AgentNodeForkHandleProps {
  nodeId?: string;
}

export function AgentNodeForkHandle({ nodeId }: AgentNodeForkHandleProps) {
  return (
    <div className="agent-node-fork-button-wrapper">
      <Handle
        type="source"
        position={Position.Bottom}
        id="fork-source"
        className="agent-node-bottom-handle"
        onMouseDown={(e) => {
          // Allow drag to still work - only treat as click if there's no movement.
          if (!nodeId) return;
          e.stopPropagation();
          let hasMoved = false;
          const startX = e.clientX;
          const startY = e.clientY;
          const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = Math.abs(moveEvent.clientX - startX);
            const deltaY = Math.abs(moveEvent.clientY - startY);
            if (deltaX > 5 || deltaY > 5) {
              hasMoved = true;
            }
          };
          const handleMouseUp = (upEvent: MouseEvent) => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            // If mouse didn't move, it was a click, not a drag.
            if (!hasMoved) {
              upEvent.stopPropagation();
              window.dispatchEvent(
                new CustomEvent('agent-node:fork-click', {
                  detail: { nodeId },
                })
              );
            }
          };
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        }}
      />
    </div>
  );
}

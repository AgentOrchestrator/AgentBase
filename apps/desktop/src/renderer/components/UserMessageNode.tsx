import { Handle, type NodeProps, Position } from '@xyflow/react';
import { useEffect, useRef } from 'react';
import type { UserMessageGroup } from '../types/conversation';
import './UserMessageNode.css';

interface UserMessageNodeData {
  messageGroup: UserMessageGroup;
}

function UserMessageNode({ data, id: _id, selected }: NodeProps) {
  const nodeData = data as unknown as UserMessageNodeData;
  const { messageGroup } = nodeData;
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle scroll events when node is selected
  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement || !selected) return;

    const handleWheel = (e: WheelEvent) => {
      // Always prevent canvas scrolling when node is selected
      // This prevents the "snap" effect when reaching boundaries
      e.stopPropagation();
    };

    contentElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      contentElement.removeEventListener('wheel', handleWheel);
    };
  }, [selected]);

  return (
    <div className={`user-message-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} />

      <div className="user-message-header">
        <span className="user-message-label">User</span>
      </div>

      <div ref={contentRef} className="user-message-content">
        {messageGroup.text}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default UserMessageNode;

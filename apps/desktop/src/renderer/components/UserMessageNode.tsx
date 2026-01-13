import React from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import type { UserMessageGroup } from '../types/conversation';
import './UserMessageNode.css';

interface UserMessageNodeData {
  messageGroup: UserMessageGroup;
}

function UserMessageNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as UserMessageNodeData;
  const { messageGroup } = nodeData;

  return (
    <div className={`user-message-node ${selected ? 'selected' : ''}`}>
      <NodeResizer minWidth={200} minHeight={100} />
      <Handle type="target" position={Position.Top} />
      
      <div className="user-message-header">
        <span className="user-message-label">User</span>
        <span className="user-message-timestamp">
          {new Date(messageGroup.timestamp).toLocaleTimeString()}
        </span>
      </div>
      
      <div className="user-message-content">
        {messageGroup.text}
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default UserMessageNode;

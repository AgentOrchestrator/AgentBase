import React, { useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import './WorkspaceNode.css';

interface WorkspaceNodeData {
  path: string;
  name?: string;
  projectType?: string;
}

function WorkspaceNode({ data }: NodeProps) {
  const nodeData = data as unknown as WorkspaceNodeData;
  const [isEditing, setIsEditing] = useState(false);
  const [path, setPath] = useState(nodeData.path || '');

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    // Update the node data
    nodeData.path = path;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditing(false);
      nodeData.path = path;
    } else if (e.key === 'Escape') {
      setPath(nodeData.path || '');
      setIsEditing(false);
    }
  };

  // Handle drag start to attach workspace to terminal nodes
  const handleDragStart = (e: React.DragEvent) => {
    if (!path) {
      e.preventDefault();
      return;
    }

    const workspaceData = {
      path,
      name: nodeData.name,
      projectType: nodeData.projectType,
    };

    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify(workspaceData));
    e.dataTransfer.setData('text/plain', `Workspace: ${path}`);
    e.dataTransfer.setData('attachment-type', 'workspace-metadata');
  };

  return (
    <div
      className="workspace-node"
      draggable={!isEditing && !!path}
      onDragStart={handleDragStart}
    >
      <Handle type="target" position={Position.Top} />
      <div className="workspace-node-header">
        <span className="workspace-icon">📁</span>
        <span className="workspace-label">Workspace</span>
        {path && <span className="drag-hint" title="Drag to attach to terminal">⋮⋮</span>}
      </div>
      <div className="workspace-node-content">
        {isEditing ? (
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
            className="workspace-path-input"
            placeholder="/path/to/workspace"
          />
        ) : (
          <div
            className="workspace-path"
            onDoubleClick={handleDoubleClick}
            title={path || 'Double-click to set workspace path'}
          >
            {path || 'No path set'}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default WorkspaceNode;

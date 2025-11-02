import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Handle,
  Position,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import TerminalNode from './TerminalNode';
import './Canvas.css';

// Custom node component
const CustomNode = ({ data }: { data: { label: string } }) => {
  return (
    <div className="custom-node">
      <Handle type="target" position={Position.Top} />
      <div className="custom-node-content">
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

// Define node types
const nodeTypes = {
  custom: CustomNode,
  terminal: TerminalNode,
};

const initialNodes: Node[] = [];

const initialEdges: Edge[] = [];

type ContextMenu = {
  x: number;
  y: number;
} | null;

function CanvasFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const terminalCounterRef = useRef(1);
  const [isNodeDragEnabled, setIsNodeDragEnabled] = useState(false);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  const addTerminalNode = useCallback((position?: { x: number; y: number }) => {
    let nodePosition = position;

    // If no position provided and context menu is open, use context menu position
    if (!nodePosition && contextMenu) {
      nodePosition = screenToFlowPosition({
        x: contextMenu.x,
        y: contextMenu.y,
      });
    }

    // If still no position, use center of viewport
    if (!nodePosition) {
      // Default to center of canvas view
      nodePosition = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
    }

    const terminalId = `terminal-${terminalCounterRef.current++}`;
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'terminal',
      position: nodePosition,
      data: {
        terminalId,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setContextMenu(null);
  }, [contextMenu, screenToFlowPosition, setNodes]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as HTMLElement)) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [contextMenu]);

  // Keyboard shortcut: CMD+K (Mac) or CTRL+K (Windows/Linux) to add terminal
  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    const handleKeyDown = (event: KeyboardEvent) => {
      const modifierKey = isMac ? event.metaKey : event.ctrlKey;

      // CMD+K / CTRL+K to add terminal
      if (modifierKey && event.key === 'k') {
        event.preventDefault(); // Prevent default browser behavior
        addTerminalNode();
      }

      // Enable node drag mode while holding CMD (Mac) or CTRL (Windows/Linux)
      if ((isMac && event.metaKey) || (!isMac && event.ctrlKey)) {
        if (!isNodeDragEnabled) {
          setIsNodeDragEnabled(true);
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      // Disable node drag mode when CMD/CTRL key is released
      if ((isMac && event.key === 'Meta') || (!isMac && event.key === 'Control')) {
        setIsNodeDragEnabled(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [addTerminalNode, isNodeDragEnabled]);

  return (
    <div className={`canvas-container ${isNodeDragEnabled ? 'drag-mode' : ''}`}>
      {/* Mode indicator */}
      <div className={`mode-indicator ${isNodeDragEnabled ? 'drag-mode' : 'terminal-mode'}`}>
        <span className="mode-icon">{isNodeDragEnabled ? '🔄' : '⌨️'}</span>
        <span className="mode-text">
          {isNodeDragEnabled ? 'Node Drag Mode' : 'Terminal Mode'}
        </span>
        <span className="mode-hint">
          {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? 'Hold ⌘ to drag nodes' : 'Hold Ctrl to drag nodes'}
        </span>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        style={{ backgroundColor: '#1e1e1e' }}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.1}
        maxZoom={4}
        panOnScroll={true}
        zoomOnScroll={true}
        panOnDrag={isNodeDragEnabled}
        zoomOnPinch={true}
        nodesDraggable={isNodeDragEnabled}
        nodesConnectable={isNodeDragEnabled}
        elementsSelectable={true}
      >
        <Controls />
        <MiniMap />
        <Background variant="dots" gap={12} size={1} />
      </ReactFlow>
      
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-item" onClick={() => addTerminalNode()}>
            <span>Add Terminal</span>
            <span className="context-menu-shortcut">
              {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘K' : 'Ctrl+K'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasFlow />
    </ReactFlowProvider>
  );
}


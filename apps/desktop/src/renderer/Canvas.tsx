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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [linearApiKey, setLinearApiKey] = useState('');
  const [isLinearConnected, setIsLinearConnected] = useState(false);

  // Issues pill state
  const [isPillExpanded, setIsPillExpanded] = useState(false);
  const [isPillSquare, setIsPillSquare] = useState(false);
  const [showPillContent, setShowPillContent] = useState(false);
  const [isContentVisible, setIsContentVisible] = useState(false);
  const [isTextVisible, setIsTextVisible] = useState(true);
  const [issues, setIssues] = useState<any[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);

  // Load Linear API key from localStorage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('linear_api_key');
    if (storedKey) {
      setLinearApiKey(storedKey);
      setIsLinearConnected(true);
    }
  }, []);

  const handleLinearConnect = useCallback(() => {
    if (linearApiKey.trim()) {
      localStorage.setItem('linear_api_key', linearApiKey);
      setIsLinearConnected(true);
    }
  }, [linearApiKey]);

  const handleLinearDisconnect = useCallback(() => {
    localStorage.removeItem('linear_api_key');
    setLinearApiKey('');
    setIsLinearConnected(false);
  }, []);

  const fetchLinearIssues = useCallback(async () => {
    const apiKey = localStorage.getItem('linear_api_key');
    if (!apiKey) return;

    setLoadingIssues(true);
    try {
      const query = `
        query {
          issues(filter: { state: { type: { in: ["started", "unstarted"] } } }, first: 10) {
            nodes {
              id
              title
              identifier
              state {
                name
                color
              }
              priority
              assignee {
                name
                avatarUrl
              }
              createdAt
              updatedAt
            }
          }
        }
      `;

      const response = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey,
        },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();
      if (data.data?.issues?.nodes) {
        setIssues(data.data.issues.nodes);
      }
    } catch (error) {
      console.error('Error fetching Linear issues:', error);
    } finally {
      setLoadingIssues(false);
    }
  }, []);

  const togglePill = useCallback(() => {
    if (!isPillExpanded) {
      // Fetch issues when expanding
      fetchLinearIssues();

      // Hide text immediately when expanding
      setIsTextVisible(false);
      // Both phases start simultaneously
      setIsPillExpanded(true);
      setIsPillSquare(true);
      // Show pill content after expansion completes (300ms) + 50ms delay
      setTimeout(() => {
        setShowPillContent(true);
        // Start content animation after pill content is shown
        setTimeout(() => {
          setIsContentVisible(true);
        }, 100);
      }, 350);
    } else {
      // Hide animations immediately when collapsing
      setIsContentVisible(false);
      // Hide pill content immediately when collapsing
      setShowPillContent(false);
      // Both phases collapse simultaneously
      setIsPillSquare(false);
      setIsPillExpanded(false);
      // Start text fade-in animation after collapse completes (300ms + 50ms delay)
      setTimeout(() => {
        setIsTextVisible(true);
      }, 350);
    }
  }, [isPillExpanded, fetchLinearIssues]);

  const collapsePill = useCallback(() => {
    // First hide animations immediately
    setIsContentVisible(false);
    // First hide content with 50ms delay
    setShowPillContent(false);
    setTimeout(() => {
      // Then collapse the pill
      setIsPillSquare(false);
      setIsPillExpanded(false);
      // Start text fade-in animation after collapse completes (300ms + 50ms delay)
      setTimeout(() => {
        setIsTextVisible(true);
      }, 350);
    }, 50);
  }, []);

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

      {/* Settings FAB */}
      <button
        className="settings-fab"
        onClick={() => setIsSettingsOpen(true)}
        aria-label="Settings"
      >
        ⚙️
      </button>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="settings-modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h2>Settings</h2>
              <button className="settings-close-button" onClick={() => setIsSettingsOpen(false)}>
                ✕
              </button>
            </div>
            <div className="settings-modal-content">
              <div className="settings-section">
                <h3>Integrations</h3>
                <div className="settings-integration">
                  <div className="integration-header">
                    <div className="integration-info">
                      <span className="integration-name">Linear</span>
                      <span className={`integration-status ${isLinearConnected ? 'connected' : 'disconnected'}`}>
                        {isLinearConnected ? '● Connected' : '○ Not connected'}
                      </span>
                    </div>
                  </div>
                  <div className="integration-content">
                    <input
                      type="password"
                      placeholder="Enter Linear API Key"
                      value={linearApiKey}
                      onChange={(e) => setLinearApiKey(e.target.value)}
                      className="integration-input"
                      disabled={isLinearConnected}
                    />
                    {isLinearConnected ? (
                      <button
                        onClick={handleLinearDisconnect}
                        className="integration-button disconnect"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={handleLinearConnect}
                        className="integration-button connect"
                        disabled={!linearApiKey.trim()}
                      >
                        Connect
                      </button>
                    )}
                  </div>
                  <div className="integration-help">
                    Get your API key from{' '}
                    <a
                      href="https://linear.app/settings/api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="integration-link"
                    >
                      Linear Settings → API
                    </a>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <h3>Keyboard Shortcuts</h3>
                <div className="settings-item">
                  <span>Add Terminal</span>
                  <span className="settings-shortcut">
                    {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘K' : 'Ctrl+K'}
                  </span>
                </div>
                <div className="settings-item">
                  <span>Node Drag Mode</span>
                  <span className="settings-shortcut">
                    {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? 'Hold ⌘' : 'Hold Ctrl'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Issues Pill */}
      {isLinearConnected && (
        <div
          onClick={!isPillSquare ? togglePill : undefined}
          className={`issues-pill ${!isPillSquare ? 'cursor-pointer' : 'cursor-default'} ${
            isPillExpanded ? 'expanded' : ''
          } ${isPillSquare ? 'square' : ''}`}
          style={{
            borderRadius: isPillSquare ? '24px' : '20px'
          }}
        >
          {!isPillSquare ? (
            <div className={`pill-text ${isTextVisible ? 'visible' : ''}`}>
              View Issues...
            </div>
          ) : showPillContent ? (
            <div className="pill-content-wrapper" onClick={(e) => e.stopPropagation()}>
              {/* Collapse nozzle at top */}
              <div
                className={`collapse-nozzle ${isContentVisible ? 'visible' : ''}`}
                onClick={collapsePill}
                title="Collapse issues"
              />

              {/* Issues list */}
              <div className={`issues-list ${isContentVisible ? 'visible' : ''}`}>
                {loadingIssues ? (
                  <div className="loading-state">Loading issues...</div>
                ) : issues.length === 0 ? (
                  <div className="empty-state">No open issues found</div>
                ) : (
                  issues.map((issue) => (
                    <div key={issue.id} className="issue-card">
                      <div className="issue-header">
                        <span className="issue-identifier">{issue.identifier}</span>
                        <span
                          className="issue-status"
                          style={{ backgroundColor: issue.state.color }}
                        >
                          {issue.state.name}
                        </span>
                      </div>
                      <div className="issue-title">{issue.title}</div>
                      {issue.assignee && (
                        <div className="issue-assignee">
                          {issue.assignee.avatarUrl && (
                            <img
                              src={issue.assignee.avatarUrl}
                              alt={issue.assignee.name}
                              className="assignee-avatar"
                            />
                          )}
                          <span className="assignee-name">{issue.assignee.name}</span>
                        </div>
                      )}
                      <div className="issue-priority">
                        Priority: {issue.priority === 0 ? 'None' : issue.priority === 1 ? 'Urgent' : issue.priority === 2 ? 'High' : issue.priority === 3 ? 'Medium' : 'Low'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
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


import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
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
import WorkspaceNode from './WorkspaceNode';
import AgentNode from './AgentNode';
import './Canvas.css';
import { agentStore } from './stores';
import { createDefaultAgentTitle } from './types/agent-node';
import { createLinearIssueAttachment, createWorkspaceMetadataAttachment } from './types/attachments';
import { useCanvasPersistence } from './hooks';

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
  workspace: WorkspaceNode,
  agent: AgentNode,
};

const defaultNodes: Node[] = [];

const defaultEdges: Edge[] = [];

type LinearProject = {
  id: string;
  name: string;
};

type LinearMilestone = {
  id: string;
  name: string;
  project?: LinearProject;
};

type LinearWorkflowState = {
  id: string;
  name: string;
  color: string;
  type?: string;
};

type LinearIssue = {
  id: string;
  title: string;
  identifier: string;
  state: LinearWorkflowState;
  priority: number;
  assignee?: {
    name: string;
    avatarUrl?: string;
  };
  project?: LinearProject;
  projectMilestone?: LinearMilestone;
  createdAt: string;
  updatedAt: string;
};

type ContextMenu = {
  x: number;
  y: number;
} | null;

function CanvasFlow() {
  // Canvas persistence hook - centralized save/restore logic
  const {
    isLoading: isCanvasLoading,
    isSaving,
    lastSavedAt,
    initialNodes,
    initialEdges,
    // initialViewport and persistViewport available for future viewport persistence
    persistNodes,
    persistEdges,
  } = useCanvasPersistence({ debounceMs: 1000 });

  // Initialize React Flow state with restored data or defaults
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialNodes.length > 0 ? initialNodes : defaultNodes
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialEdges.length > 0 ? initialEdges : defaultEdges
  );

  // Track if initial state has been applied
  const initialStateApplied = useRef(false);

  // Apply restored state when it becomes available
  useEffect(() => {
    if (!isCanvasLoading && initialNodes.length > 0 && !initialStateApplied.current) {
      setNodes(initialNodes);
      setEdges(initialEdges);
      initialStateApplied.current = true;
    }
  }, [isCanvasLoading, initialNodes, initialEdges, setNodes, setEdges]);

  // Persist nodes when they change
  const prevNodesRef = useRef<Node[]>(nodes);
  useEffect(() => {
    if (!isCanvasLoading && nodes !== prevNodesRef.current) {
      prevNodesRef.current = nodes;
      persistNodes(nodes);
    }
  }, [nodes, isCanvasLoading, persistNodes]);

  // Persist edges when they change
  const prevEdgesRef = useRef<Edge[]>(edges);
  useEffect(() => {
    if (!isCanvasLoading && edges !== prevEdgesRef.current) {
      prevEdgesRef.current = edges;
      persistEdges(edges);
    }
  }, [edges, isCanvasLoading, persistEdges]);

  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
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
  const [issues, setIssues] = useState<LinearIssue[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [linearWorkspaceName, setLinearWorkspaceName] = useState('');
  const [linearProjects, setLinearProjects] = useState<LinearProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState('all');
  const [selectedStatusId, setSelectedStatusId] = useState('all');

  // Load Linear API key from localStorage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('linear_api_key');
    if (storedKey) {
      setLinearApiKey(storedKey);
      setIsLinearConnected(true);
    }
  }, []);

  const fetchLinearProjects = useCallback(async () => {
    const apiKey = localStorage.getItem('linear_api_key');
    if (!apiKey) return;

    try {
      const query = `
        query {
          projects(first: 100) {
            nodes {
              id
              name
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
      if (data.data?.projects?.nodes) {
        setLinearProjects(data.data.projects.nodes);
      }
    } catch (error) {
      console.error('Error fetching Linear projects:', error);
    }
  }, []);

  // Listen for node update events from TerminalNode
  useEffect(() => {
    const handleUpdateNode = (event: CustomEvent) => {
      const { nodeId, data } = event.detail;
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...data } }
            : node
        )
      );
    };

    window.addEventListener('update-node', handleUpdateNode as EventListener);
    return () => {
      window.removeEventListener('update-node', handleUpdateNode as EventListener);
    };
  }, [setNodes]);

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
    setLinearWorkspaceName('');
    setLinearProjects([]);
  }, []);

  const fetchLinearIssues = useCallback(async () => {
    const apiKey = localStorage.getItem('linear_api_key');
    if (!apiKey) return;

    setLoadingIssues(true);
    try {
      const query = `
        query {
          viewer {
            organization {
              name
            }
          }
          issues(
            filter: { state: { type: { in: ["triage", "backlog", "unstarted", "started"] } } }
            first: 50
          ) {
            nodes {
              id
              title
              identifier
              state {
                id
                name
                color
                type
              }
              priority
              assignee {
                name
                avatarUrl
              }
              project {
                id
                name
              }
              projectMilestone {
                id
                name
                project {
                  id
                  name
                }
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
      const workspaceName =
        data.data?.viewer?.organization?.name ?? data.data?.organization?.name ?? '';
      if (workspaceName) {
        setLinearWorkspaceName(workspaceName);
      }
    } catch (error) {
      console.error('Error fetching Linear issues:', error);
    } finally {
      setLoadingIssues(false);
    }
  }, []);

  const projectOptions = useMemo(() => {
    const map = new Map<string, LinearProject>();
    linearProjects.forEach((project) => {
      if (project.id) {
        map.set(project.id, project);
      }
    });
    issues.forEach((issue) => {
      if (issue.project?.id) {
        map.set(issue.project.id, issue.project);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [issues, linearProjects]);

  const milestoneOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; label: string; projectId?: string }>();
    issues.forEach((issue) => {
      if (issue.projectMilestone?.id) {
        const milestone = issue.projectMilestone;
        const label = milestone.project?.name
          ? `${milestone.project.name} / ${milestone.name}`
          : milestone.name;
        map.set(milestone.id, {
          id: milestone.id,
          name: milestone.name,
          label,
          projectId: milestone.project?.id,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [issues]);

  const statusOptions = useMemo(() => {
    const map = new Map<string, LinearWorkflowState>();
    issues.forEach((issue) => {
      if (issue.state?.id) {
        map.set(issue.state.id, issue.state);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [issues]);

  const hasUnassignedProject = useMemo(
    () => issues.some((issue) => !issue.project),
    [issues]
  );

  const hasUnassignedMilestone = useMemo(
    () => issues.some((issue) => !issue.projectMilestone),
    [issues]
  );

  const visibleMilestoneOptions = useMemo(() => {
    if (selectedProjectId === 'all') {
      return milestoneOptions;
    }
    if (selectedProjectId === 'none') {
      return [];
    }
    return milestoneOptions.filter((milestone) => milestone.projectId === selectedProjectId);
  }, [milestoneOptions, selectedProjectId]);

  useEffect(() => {
    if (
      selectedProjectId !== 'all' &&
      selectedProjectId !== 'none' &&
      !projectOptions.some((project) => project.id === selectedProjectId)
    ) {
      setSelectedProjectId('all');
    }
  }, [projectOptions, selectedProjectId]);

  useEffect(() => {
    if (
      selectedMilestoneId !== 'all' &&
      selectedMilestoneId !== 'none' &&
      !visibleMilestoneOptions.some((milestone) => milestone.id === selectedMilestoneId)
    ) {
      setSelectedMilestoneId('all');
    }
  }, [visibleMilestoneOptions, selectedMilestoneId]);

  useEffect(() => {
    if (selectedStatusId !== 'all' && !statusOptions.some((state) => state.id === selectedStatusId)) {
      setSelectedStatusId('all');
    }
  }, [statusOptions, selectedStatusId]);

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (selectedProjectId === 'none' && issue.project) {
        return false;
      }
      if (
        selectedProjectId !== 'all' &&
        selectedProjectId !== 'none' &&
        issue.project?.id !== selectedProjectId
      ) {
        return false;
      }
      if (selectedMilestoneId === 'none' && issue.projectMilestone) {
        return false;
      }
      if (
        selectedMilestoneId !== 'all' &&
        selectedMilestoneId !== 'none' &&
        issue.projectMilestone?.id !== selectedMilestoneId
      ) {
        return false;
      }
      if (selectedStatusId !== 'all' && issue.state?.id !== selectedStatusId) {
        return false;
      }
      return true;
    });
  }, [issues, selectedProjectId, selectedMilestoneId, selectedStatusId]);

  const togglePill = useCallback(() => {
    if (!isPillExpanded) {
      // Fetch issues and projects when expanding
      fetchLinearIssues();
      fetchLinearProjects();

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
  }, [isPillExpanded, fetchLinearIssues, fetchLinearProjects]);

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

  // Drag and drop handlers for issue cards
  const handleIssueDragStart = useCallback((e: React.DragEvent, issue: LinearIssue) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify(issue));
    e.dataTransfer.setData('text/plain', `${issue.identifier}: ${issue.title}`);
  }, []);

  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();

    try {
      const jsonData = e.dataTransfer.getData('application/json');
      if (!jsonData) return;

      const data = JSON.parse(jsonData);
      const attachmentType = e.dataTransfer.getData('attachment-type');

      // Get the drop position relative to the ReactFlow canvas
      const position = screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const terminalId = `terminal-${crypto.randomUUID()}`;

      // Create attachment based on type
      let attachment;
      if (attachmentType === 'workspace-metadata') {
        attachment = createWorkspaceMetadataAttachment(data);
      } else {
        // Default to Linear issue if no type specified (for backward compatibility)
        attachment = createLinearIssueAttachment(data);
      }

      const newNode: Node = {
        id: `node-${Date.now()}`,
        type: 'terminal',
        position,
        data: {
          terminalId,
          attachments: [attachment],
        },
        style: {
          width: 600,
          height: 400,
        },
      };

      setNodes((nds) => [...nds, newNode]);

      // Close the issues pill after dropping
      if (isPillExpanded) {
        collapsePill();
      }
    } catch (error) {
      console.error('Error handling drop:', error);
    }
  }, [screenToFlowPosition, setNodes, isPillExpanded, collapsePill]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
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

    const terminalId = `terminal-${crypto.randomUUID()}`;
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'terminal',
      position: nodePosition,
      data: {
        terminalId,
      },
      style: {
        width: 600,
        height: 400,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setContextMenu(null);
  }, [contextMenu, screenToFlowPosition, setNodes]);

  const addWorkspaceNode = useCallback((position?: { x: number; y: number }) => {
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

    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'workspace',
      position: nodePosition,
      data: {
        path: '',
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setContextMenu(null);
  }, [contextMenu, screenToFlowPosition, setNodes]);

  const addAgentNode = useCallback((position?: { x: number; y: number }) => {
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
      nodePosition = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
    }

    // Get first mock agent from store for demo purposes
    const mockAgents = agentStore.getAllAgents();
    const mockAgent = mockAgents[0];

    const agentId = `agent-${crypto.randomUUID()}`;
    const terminalId = `terminal-${crypto.randomUUID()}`;

    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'agent',
      position: nodePosition,
      data: mockAgent || {
        agentId,
        terminalId,
        agentType: 'claude_code',
        status: 'idle',
        title: createDefaultAgentTitle(),
        summary: null,
        progress: null,
        attachments: [],
        activeView: 'overview',
      },
      style: {
        width: 500,
        height: 450,
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

  // Keyboard shortcuts: CMD+K to add terminal, CMD+W to add workspace
  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    const handleKeyDown = (event: KeyboardEvent) => {
      const modifierKey = isMac ? event.metaKey : event.ctrlKey;

      // CMD+K / CTRL+K to add terminal
      if (modifierKey && event.key === 'k') {
        event.preventDefault(); // Prevent default browser behavior
        addTerminalNode();
      }

      // CMD+W / CTRL+W to add workspace
      if (modifierKey && event.key === 'w') {
        event.preventDefault(); // Prevent default browser behavior
        addWorkspaceNode();
      }

      // CMD+Shift+A / CTRL+Shift+A to add agent
      if (modifierKey && event.shiftKey && event.key === 'A') {
        event.preventDefault();
        addAgentNode();
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
  }, [addTerminalNode, addWorkspaceNode, addAgentNode, isNodeDragEnabled]);

  // Show loading state while canvas is being restored
  if (isCanvasLoading) {
    return (
      <div className="canvas-loading">
        <div className="canvas-loading-content">
          <div className="canvas-loading-spinner" />
          <span>Restoring canvas...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`canvas-container ${isNodeDragEnabled ? 'drag-mode' : ''}`}>
      {/* Top right toolbar */}
      <div className="top-right-toolbar">
        <div className={`toolbar-button save-button ${isSaving ? 'saving' : ''}`}>
          {isSaving ? '💾' : '✓'}
        </div>
        <button
          className="toolbar-button settings-button"
          onClick={() => setIsSettingsOpen(true)}
          aria-label="Settings"
        >
          ⚙️
        </button>
      </div>

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
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
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
        nodesFocusable={true}
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
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
          <div className="context-menu-item" onClick={() => addWorkspaceNode()}>
            <span>Add Workspace</span>
            <span className="context-menu-shortcut">
              {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘W' : 'Ctrl+W'}
            </span>
          </div>
          <div className="context-menu-item" onClick={() => addAgentNode()}>
            <span>Add Agent</span>
            <span className="context-menu-shortcut">
              {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⇧⌘A' : 'Ctrl+Shift+A'}
            </span>
          </div>
        </div>
      )}

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
                  <span>Add Workspace</span>
                  <span className="settings-shortcut">
                    {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘W' : 'Ctrl+W'}
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
                <div className="issues-toolbar">
                  <div className="issues-workspace">
                    <span className="issues-workspace-label">Workspace</span>
                    <span className="issues-workspace-name">
                      {linearWorkspaceName || (loadingIssues ? 'Loading...' : 'Unknown')}
                    </span>
                  </div>
                  <div className="issues-filters">
                    <div className="issues-filter">
                      <label htmlFor="issues-filter-project">Project</label>
                      <select
                        id="issues-filter-project"
                        className="issues-select"
                        value={selectedProjectId}
                        onChange={(event) => setSelectedProjectId(event.target.value)}
                      >
                        <option value="all">All projects</option>
                        {hasUnassignedProject && <option value="none">No project</option>}
                        {projectOptions.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="issues-filter">
                      <label htmlFor="issues-filter-milestone">Milestone</label>
                      <select
                        id="issues-filter-milestone"
                        className="issues-select"
                        value={selectedMilestoneId}
                        onChange={(event) => setSelectedMilestoneId(event.target.value)}
                      >
                        <option value="all">All milestones</option>
                        {hasUnassignedMilestone && <option value="none">No milestone</option>}
                        {visibleMilestoneOptions.map((milestone) => (
                          <option key={milestone.id} value={milestone.id}>
                            {milestone.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="issues-filter">
                      <label htmlFor="issues-filter-status">Status</label>
                      <select
                        id="issues-filter-status"
                        className="issues-select"
                        value={selectedStatusId}
                        onChange={(event) => setSelectedStatusId(event.target.value)}
                      >
                        <option value="all">All statuses</option>
                        {statusOptions.map((state) => (
                          <option key={state.id} value={state.id}>
                            {state.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {loadingIssues ? (
                  <div className="loading-state">Loading issues...</div>
                ) : filteredIssues.length === 0 ? (
                  <div className="empty-state">
                    {issues.length === 0 ? 'No open issues found' : 'No issues match these filters'}
                  </div>
                ) : (
                  filteredIssues.map((issue) => {
                    const projectLabel = issue.project?.name;
                    const milestoneLabel = issue.projectMilestone?.name;
                    return (
                      <div
                        key={issue.id}
                        className="issue-card"
                        draggable
                        onDragStart={(e) => handleIssueDragStart(e, issue)}
                      >
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
                        {(projectLabel || milestoneLabel) && (
                          <div className="issue-meta">
                            {projectLabel && <span>Project: {projectLabel}</span>}
                            {projectLabel && milestoneLabel && (
                              <span className="issue-meta-sep">|</span>
                            )}
                            {milestoneLabel && <span>Milestone: {milestoneLabel}</span>}
                          </div>
                        )}
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
                    );
                  })
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

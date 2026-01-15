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
  useReactFlow,
  OnConnectStartParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ForkGhostNode from './ForkGhostNode';
import ForkSessionModal from './ForkSessionModal';
import './Canvas.css';
import { forkStore, nodeStore } from './stores';
import {
  useCanvasPersistence,
  useLinear,
  useAgentHierarchy,
  useForkModal,
  useCanvasActions,
  useFolderLock,
  useSidebarState,
  usePillState,
  useCanvasDrop,
  type LinearIssue,
} from './hooks';
import { nodeRegistry } from './nodes/registry';
import UserMessageNode from './components/UserMessageNode';
import AssistantMessageNode from './components/AssistantMessageNode';
import ConversationNode from './components/ConversationNode';
import { CommandPalette, type CommandAction } from './components/CommandPalette';
import { NewAgentModal } from './components/NewAgentModal';
import { ActionPill } from './components/ActionPill';
import { useTheme } from './context';

// Use node types from the registry (single source of truth)
// Also include conversation node types for debugging
const nodeTypes = {
  ...nodeRegistry.reactFlowNodeTypes,
  userMessage: UserMessageNode,
  assistantMessage: AssistantMessageNode,
  conversationNode: ConversationNode,
};

const defaultNodes: Node[] = [];
const defaultEdges: Edge[] = [];

type ContextMenu = {
  x: number;
  y: number;
} | null;

function CanvasFlow() {
  // Theme hook
  const { theme, setTheme } = useTheme();

  // Canvas persistence hook - centralized save/restore logic
  const {
    isLoading: isCanvasLoading,
    isSaving,
    lastSavedAt,
    initialNodes,
    initialEdges,
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
    if (!isCanvasLoading) {
      if (!initialStateApplied.current && (initialNodes.length > 0 || initialEdges.length > 0)) {
        console.log('[Canvas] Restoring nodes from persistence:', initialNodes.map(n => ({
          nodeId: n.id,
          agentId: (n.data as Record<string, unknown>)?.agentId,
          title: ((n.data as Record<string, unknown>)?.title as { value?: string })?.value,
        })));
        setNodes(initialNodes);
        setEdges(initialEdges);
        initialStateApplied.current = true;
      }
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

  // Core UI state (kept in Canvas)
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [isNodeDragEnabled, setIsNodeDragEnabled] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNewAgentModalOpen, setIsNewAgentModalOpen] = useState(false);
  const [pendingAgentPosition, setPendingAgentPosition] = useState<{ x: number; y: number } | undefined>(undefined);

  // =============================================================================
  // Hook-based state management
  // =============================================================================

  // Linear integration
  const linear = useLinear();

  // Sidebar collapse state
  const sidebar = useSidebarState();

  // Agent hierarchy computation
  const { hierarchy: agentHierarchy, folderPathMap } = useAgentHierarchy(nodes, edges);

  // Folder lock state
  const folderLock = useFolderLock(agentHierarchy, folderPathMap);

  // Pill animation state
  const pill = usePillState(() => {
    // onExpand callback - fetch issues when pill expands
    linear.fetchIssues();
    linear.fetchProjects();
  });

  // Fork modal state and operations
  const forkModal = useForkModal({
    nodes,
    onNodeUpdate: (nodeId, data) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n))
      );
    },
  });

  // Canvas drop handlers
  const canvasDrop = useCanvasDrop({
    screenToFlowPosition,
    setNodes,
    isPillExpanded: pill.isPillExpanded,
    collapsePill: pill.collapsePill,
  });

  // Canvas node creation actions
  const canvasActions = useCanvasActions({
    setNodes,
    contextMenu,
    closeContextMenu: () => setContextMenu(null),
    lockedFolderPath: folderLock.lockedFolderPath,
    onShowAgentModal: (pos) => {
      setPendingAgentPosition(pos);
      setIsNewAgentModalOpen(true);
    },
  });

  // Check if there are any agents
  const hasAgents = useMemo(() => {
    return nodes.some((node) => node.type === 'agent');
  }, [nodes]);

  // =============================================================================
  // Node store sync
  // =============================================================================

  // Sync nodeStore with React Flow's nodes state
  useEffect(() => {
    nodeStore.setNodes(nodes);
  }, []); // Only run once on mount

  // Listen for node update events and delegate to nodeStore
  useEffect(() => {
    const handleUpdateNode = (event: CustomEvent) => {
      const { nodeId, data } = event.detail;
      const existingNode = nodeStore.getNode(nodeId);
      console.warn('[Canvas] handleUpdateNode BEFORE', {
        nodeId,
        agentId: (data as Record<string, unknown>)?.agentId,
        existingData: existingNode?.data,
        incomingData: data,
      });
      nodeStore.updateNode(nodeId, data as Record<string, unknown>);
      setNodes((nds) =>
        nds.map((node) => (node.id === nodeId ? { ...node, data: { ...data } } : node))
      );
      console.warn('[Canvas] handleUpdateNode AFTER', {
        nodeId,
        agentId: (data as Record<string, unknown>)?.agentId,
        updatedData: data,
      });
    };

    const handleDeleteNode = (event: CustomEvent) => {
      const { nodeId } = event.detail;
      nodeStore.deleteNode(nodeId);
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    };

    window.addEventListener('update-node', handleUpdateNode as EventListener);
    window.addEventListener('delete-node', handleDeleteNode as EventListener);
    return () => {
      window.removeEventListener('update-node', handleUpdateNode as EventListener);
      window.removeEventListener('delete-node', handleDeleteNode as EventListener);
    };
  }, [setNodes]);

  // =============================================================================
  // Starter node handling
  // =============================================================================

  useEffect(() => {
    const handleStarterSubmit = (event: CustomEvent) => {
      const { nodeId, message } = event.detail;

      const starterNode = nodes.find((n) => n.id === nodeId);
      if (!starterNode) return;

      const electronAPI = (window as unknown as { electronAPI?: { getHomeDir: () => string } }).electronAPI;
      const workingDirectory = electronAPI?.getHomeDir() || '/';

      const terminalId = `terminal-${crypto.randomUUID()}`;
      const agentId = `agent-${Date.now()}`;
      const sessionId = crypto.randomUUID();
      const createdAt = Date.now();

      console.log('[Canvas] Creating agent node from starter', {
        agentId,
        terminalId,
        createdAt: new Date(createdAt).toISOString(),
        workingDirectory,
      });

      const agentNode = {
        id: `node-${createdAt}`,
        type: 'agent',
        position: {
          x: starterNode.position.x,
          y: starterNode.position.y + 150,
        },
        data: {
          agentId,
          terminalId,
          agentType: 'claude_code',
          status: 'idle',
          title: { value: message.slice(0, 50) + (message.length > 50 ? '...' : ''), isManuallySet: false },
          summary: null,
          progress: null,
          initialPrompt: message,
          workingDirectory,
          sessionId,
          createdAt,
        },
        style: { width: 600 },
      };

      setNodes((nds) => [...nds.filter((n) => n.id !== nodeId), agentNode]);
    };

    window.addEventListener('starter-node-submit', handleStarterSubmit as EventListener);
    return () => {
      window.removeEventListener('starter-node-submit', handleStarterSubmit as EventListener);
    };
  }, [nodes, setNodes]);

  // =============================================================================
  // ReactFlow event handlers
  // =============================================================================

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onConnectStart = useCallback(
    (_event: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
      if (params.nodeId && params.handleType) {
        forkStore.startDrag(params.nodeId, params.handleType);
      }
    },
    []
  );

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const state = forkStore.getState();

      if (!state.isDragging || !state.sourceNodeId) {
        forkStore.cancelDrag();
        return;
      }

      const target = event.target as HTMLElement;
      const isDropOnHandle = target.classList.contains('react-flow__handle');

      if (!isDropOnHandle) {
        const clientX = 'clientX' in event ? event.clientX : event.touches?.[0]?.clientX ?? 0;
        const clientY = 'clientY' in event ? event.clientY : event.touches?.[0]?.clientY ?? 0;

        const position = screenToFlowPosition({ x: clientX, y: clientY });
        forkModal.open(state.sourceNodeId, position);
      }

      forkStore.cancelDrag();
    },
    [screenToFlowPosition, forkModal]
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

  // =============================================================================
  // Fork modal confirmation handler
  // =============================================================================

  const handleForkConfirm = useCallback(
    async (forkTitle: string) => {
      const result = await forkModal.confirm(forkTitle);
      if (result.success) {
        setNodes((nds) => [...nds, result.forkedNode]);
        setEdges((eds) => [...eds, result.newEdge]);
      }
    },
    [forkModal, setNodes, setEdges]
  );

  // =============================================================================
  // Fork keyboard shortcut
  // =============================================================================

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isForkShortcut =
        event.shiftKey &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 's';

      if (!isForkShortcut) return;

      event.preventDefault();

      const selectedNode = nodes.find(
        (n) => n.selected && n.type === 'agentNode'
      );

      if (!selectedNode) {
        console.log('[Canvas] No AgentNode selected for fork shortcut');
        return;
      }

      const forkPosition = {
        x: (selectedNode.position?.x ?? 0) + 350,
        y: (selectedNode.position?.y ?? 0) + 50,
      };

      console.log('[Canvas] Fork shortcut triggered for node:', selectedNode.id);
      forkModal.open(selectedNode.id, forkPosition);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, forkModal]);

  // Listen for fork button clicks from agent nodes
  useEffect(() => {
    const handleForkClick = (event: Event) => {
      const customEvent = event as CustomEvent<{ nodeId: string }>;
      const { nodeId } = customEvent.detail;

      const sourceNode = nodes.find((n) => n.id === nodeId);
      if (!sourceNode) {
        console.error('[Canvas] Source node not found for fork click:', nodeId);
        return;
      }

      const forkPosition = {
        x: (sourceNode.position?.x ?? 0) + 350,
        y: (sourceNode.position?.y ?? 0) + 50,
      };

      console.log('[Canvas] Fork button clicked for node:', nodeId);
      forkModal.open(nodeId, forkPosition);
    };

    window.addEventListener('agent-node:fork-click', handleForkClick as EventListener);
    return () => window.removeEventListener('agent-node:fork-click', handleForkClick as EventListener);
  }, [nodes, forkModal]);

  // =============================================================================
  // Linear ticket creation (kept as is - uses linear hook)
  // =============================================================================

  const createLinearTicket = useCallback(async () => {
    if (!linear.isConnected) {
      alert('Please connect to Linear first in the settings');
      return;
    }

    const title = prompt('Enter ticket title:');
    if (!title) return;

    const result = await linear.createTicket(title);
    if (result.success && result.issue) {
      alert(`Ticket created: ${result.issue.identifier} - ${result.issue.title}\n${result.issue.url}`);
    } else {
      alert('Failed to create ticket: ' + (result.error || 'Unknown error'));
    }
  }, [linear]);

  // =============================================================================
  // Context menu outside click handler
  // =============================================================================

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

  // =============================================================================
  // Command palette commands
  // =============================================================================

  const commandActions = useMemo<CommandAction[]>(() => [
    {
      id: 'add-agent',
      label: 'Add Agent',
      shortcut: 'c',
      action: () => canvasActions.addAgentNode(),
    },
    {
      id: 'add-terminal',
      label: 'Add Terminal',
      shortcut: 'v',
      action: () => canvasActions.addTerminalNode(),
    },
    {
      id: 'add-claude-terminal',
      label: 'Add Claude Code Terminal',
      shortcut: 'b',
      action: () => canvasActions.addClaudeCodeTerminal(),
    },
    {
      id: 'load-conversation',
      label: 'Load Conversation',
      shortcut: 'n',
      action: () => canvasActions.addConversationNode({ id: '' } as never, screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      })),
    },
    {
      id: 'create-linear-ticket',
      label: 'Create Linear Ticket',
      shortcut: 'm',
      action: () => createLinearTicket(),
    },
  ], [canvasActions, createLinearTicket, screenToFlowPosition]);

  // =============================================================================
  // Keyboard shortcuts
  // =============================================================================

  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    const handleKeyDown = (event: KeyboardEvent) => {
      const modifierKey = isMac ? event.metaKey : event.ctrlKey;

      if (modifierKey && event.key === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (modifierKey && event.key === 't') {
        event.preventDefault();
        if (isNewAgentModalOpen) {
          setIsNewAgentModalOpen(false);
          setPendingAgentPosition(undefined);
        } else {
          canvasActions.addAgentNode();
        }
        return;
      }

      if (modifierKey && event.key === 'w') {
        event.preventDefault();
        canvasActions.addWorkspaceNode();
      }

      if (modifierKey && event.shiftKey && event.key === 'A') {
        event.preventDefault();
        canvasActions.addAgentNode();
      }

      if (modifierKey && event.key === 'n') {
        event.preventDefault();
        canvasActions.addStarterNode();
      }

      if (modifierKey && event.shiftKey && event.key === 'L') {
        event.preventDefault();
        canvasActions.addConversationNode({ id: '' } as never, screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        }));
      }

      if ((isMac && event.metaKey) || (!isMac && event.ctrlKey)) {
        if (!isNodeDragEnabled) {
          setIsNodeDragEnabled(true);
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
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
  }, [canvasActions, isNodeDragEnabled, isNewAgentModalOpen, screenToFlowPosition]);

  // =============================================================================
  // Loading state
  // =============================================================================

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

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className={`canvas-container ${isNodeDragEnabled ? 'drag-mode' : ''}`}>
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={commandActions}
      />
      <NewAgentModal
        isOpen={isNewAgentModalOpen}
        onClose={() => {
          setIsNewAgentModalOpen(false);
          setPendingAgentPosition(undefined);
        }}
        onCreate={(data) => {
          canvasActions.createAgentWithData({
            position: pendingAgentPosition,
            modalData: {
              title: data.title,
              description: data.description,
              workspacePath: data.workspacePath,
            },
            lockedFolderPath: data.workspacePath || folderLock.lockedFolderPath,
          });
          setIsNewAgentModalOpen(false);
        }}
        initialPosition={pendingAgentPosition}
        initialWorkspacePath={folderLock.lockedFolderPath}
      />

      {/* Sidebar Panel */}
      <div className={`canvas-sidebar ${sidebar.isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <h2 className="sidebar-title">Canvas</h2>
          <button
            className="sidebar-toggle"
            onClick={sidebar.toggleSidebar}
            aria-label="Collapse sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>

        {!sidebar.isSidebarCollapsed && (
          <div className="sidebar-content">
            {hasAgents && (
              <div className="sidebar-section">
                {Object.entries(agentHierarchy).map(([projectName, branches]) => {
                  const isProjectCollapsed = sidebar.collapsedProjects.has(projectName);
                  const projectPath = folderPathMap[projectName];
                  const isLocked = folderLock.lockedFolderPath === projectPath;
                  const isHovered = folderLock.hoveredFolderPath === projectPath;
                  const showLock = isLocked || (isHovered && !isLocked);

                  return (
                    <div
                      key={projectName}
                      className="sidebar-folder"
                      onMouseEnter={() => folderLock.setHoveredFolderPath(projectPath || null)}
                      onMouseLeave={() => folderLock.setHoveredFolderPath(null)}
                    >
                      <div className="sidebar-folder-header-wrapper">
                        <button
                          className="sidebar-folder-header"
                          onClick={() => sidebar.toggleProject(projectName)}
                        >
                          <span className={`sidebar-folder-icon ${isProjectCollapsed ? 'collapsed' : 'expanded'}`}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="15 18 9 12 15 6" />
                            </svg>
                          </span>
                          {isProjectCollapsed ? (
                            <svg
                              className="sidebar-folder-svg"
                              width="14"
                              height="14"
                              viewBox="0 0 800 800"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M100 304L100.001 187.5C100.001 170.924 106.586 155.027 118.307 143.306C130.028 131.585 145.925 125 162.501 125H281.079C293.42 125 305.484 128.654 315.751 135.5L359.251 164.5C369.519 171.346 381.583 175 393.923 175H637.501C654.077 175 669.974 181.585 681.695 193.306C693.417 205.027 700.001 220.924 700.001 237.5V304"
                                stroke="currentColor"
                                strokeWidth="50"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M727.072 353.984L724.499 612.5C724.499 629.057 717.929 644.938 706.232 656.656C694.535 668.373 678.666 674.971 662.109 675H137.893C121.336 674.971 105.467 668.373 93.7692 656.656C82.0718 644.938 75.5021 629.057 75.5021 612.5L74.0028 353.984C73.4527 347.104 74.3332 340.185 76.5886 333.662C78.844 327.138 82.4255 321.153 87.1077 316.082C91.7898 311.01 97.4712 306.964 103.794 304.196C110.117 301.428 116.944 300 123.847 300L677.385 300C684.274 300.021 691.084 301.466 697.388 304.243C703.692 307.02 709.355 311.07 714.02 316.139C718.686 321.208 722.253 327.186 724.499 333.698C726.745 340.211 727.621 347.117 727.072 353.984Z"
                                stroke="currentColor"
                                strokeWidth="50"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="sidebar-folder-svg"
                              width="14"
                              height="14"
                              viewBox="0 0 512 512"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M64,192V120a40,40,0,0,1,40-40h75.89a40,40,0,0,1,22.19,6.72l27.84,18.56A40,40,0,0,0,252.11,112H408a40,40,0,0,1,40,40v40"
                                fill="none"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="32"
                              />
                              <path
                                d="M479.9,226.55,463.68,392a40,40,0,0,1-39.93,40H88.25a40,40,0,0,1-39.93-40L32.1,226.55A32,32,0,0,1,64,192h384.1A32,32,0,0,1,479.9,226.55Z"
                                fill="none"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="32"
                              />
                            </svg>
                          )}
                          <span className="sidebar-folder-name">{projectName}</span>
                        </button>
                        {showLock && projectPath && (
                          <button
                            type="button"
                            className={`sidebar-folder-lock ${isLocked ? 'locked' : ''}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (isLocked) {
                                folderLock.setLockedFolderPath(null);
                              } else {
                                folderLock.setLockedFolderPath(projectPath);
                              }
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            title={isLocked ? 'Unlock folder' : 'Lock folder'}
                          >
                            {isLocked ? (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 5V3C3 1.34315 4.34315 0 6 0C7.65685 0 9 1.34315 9 3V5H10C10.5523 5 11 5.44772 11 6V10C11 10.5523 10.5523 11 10 11H2C1.44772 11 1 10.5523 1 10V6C1 5.44772 1.44772 5 2 5H3ZM4 3V5H8V3C8 1.89543 7.10457 1 6 1C4.89543 1 4 1.89543 4 3Z" fill="currentColor"/>
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 5V3C3 1.34315 4.34315 0 6 0C7.65685 0 9 1.34315 9 3V5H10C10.5523 5 11 5.44772 11 6V10C11 10.5523 10.5523 11 10 11H2C1.44772 11 1 10.5523 1 10V6C1 5.44772 1.44772 5 2 5H3ZM4 3V5H8V3C8 1.89543 7.10457 1 6 1C4.89543 1 4 1.89543 4 3ZM2 6V10H10V6H2Z" fill="currentColor"/>
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                      {!isProjectCollapsed && (
                        <div className="sidebar-folder-content">
                          {Object.entries(branches).map(([branchName, agents]) => {
                            const branchKey = `${projectName}:${branchName}`;
                            const isBranchCollapsed = sidebar.collapsedBranches.has(branchKey);
                            return (
                              <div key={branchKey} className="sidebar-folder nested">
                                <button
                                  className="sidebar-folder-header"
                                  onClick={() => sidebar.toggleBranch(branchKey)}
                                >
                                  <span className={`sidebar-folder-icon ${isBranchCollapsed ? 'collapsed' : 'expanded'}`}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="15 18 9 12 15 6" />
                                    </svg>
                                  </span>
                                  <svg
                                    className="sidebar-branch-svg"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 512 512"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <circle
                                      cx="160"
                                      cy="96"
                                      r="48"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="32"
                                    />
                                    <circle
                                      cx="160"
                                      cy="416"
                                      r="48"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="32"
                                    />
                                    <line
                                      x1="160"
                                      y1="368"
                                      x2="160"
                                      y2="144"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="32"
                                    />
                                    <circle
                                      cx="352"
                                      cy="160"
                                      r="48"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="32"
                                    />
                                    <path
                                      d="M352,208c0,128-192,48-192,160"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="32"
                                    />
                                  </svg>
                                  <span className="sidebar-folder-name">{branchName}</span>
                                </button>
                                {!isBranchCollapsed && (
                                  <div className="sidebar-folder-content">
                                    {agents.map((agent) => (
                                      <div key={agent.nodeId} className="sidebar-item">
                                        <span>{agent.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Canvas Content */}
      <div className={`canvas-content ${sidebar.isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Expand button when sidebar is collapsed */}
        {sidebar.isSidebarCollapsed && (
          <button
            className="sidebar-expand-button"
            onClick={sidebar.toggleSidebar}
            aria-label="Expand sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        {/* Save status indicator */}
        <div className={`save-indicator ${isSaving ? 'saving' : ''}`}>
          {isSaving ? 'Saving...' : lastSavedAt ? `Saved` : ''}
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
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onPaneContextMenu={onPaneContextMenu}
          onPaneClick={onPaneClick}
          onDragOver={canvasDrop.handleCanvasDragOver}
          onDrop={canvasDrop.handleCanvasDrop}
          nodeTypes={nodeTypes}
          fitView
          style={{ backgroundColor: 'var(--color-bg-canvas)' }}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          minZoom={0.1}
          maxZoom={4}
          panOnScroll={true}
          zoomOnScroll={true}
          panOnDrag={isNodeDragEnabled}
          zoomOnPinch={true}
          nodesDraggable={isNodeDragEnabled}
          nodesConnectable={true}
          elementsSelectable={true}
          nodesFocusable={true}
        >
          <Background
            variant={BackgroundVariant.Lines}
            gap={12}
            size={1}
            color={theme === 'light-web' ? '#F5F6F8' : '#3a3a3a'}
          />
          <ForkGhostNode />
        </ReactFlow>

        {/* Fork Session Modal */}
        {forkModal.isOpen && (
          <ForkSessionModal
            onConfirm={handleForkConfirm}
            onCancel={forkModal.cancel}
            isLoading={forkModal.isLoading}
            error={forkModal.error}
          />
        )}

        {/* Fork Error Toast (shown when validation fails outside modal) */}
        {forkModal.error && !forkModal.isOpen && (
          <div className="fork-error-toast">
            <span className="fork-error-icon">!</span>
            <span className="fork-error-message">{forkModal.error}</span>
            <button
              className="fork-error-dismiss"
              onClick={forkModal.clearError}
              aria-label="Dismiss"
            >
              &times;
            </button>
          </div>
        )}

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
            <div className="context-menu-item" onClick={() => canvasActions.addTerminalNode()}>
              <span>Add Terminal</span>
              <span className="context-menu-shortcut">
                {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘K' : 'Ctrl+K'}
              </span>
            </div>
            <div className="context-menu-item" onClick={() => canvasActions.addWorkspaceNode()}>
              <span>Add Workspace</span>
              <span className="context-menu-shortcut">
                {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘W' : 'Ctrl+W'}
              </span>
            </div>
            <div className="context-menu-item" onClick={() => canvasActions.addAgentNode()}>
              <span>Add Agent</span>
              <span className="context-menu-shortcut">
                {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘T' : 'Ctrl+T'}
              </span>
            </div>
            <div className="context-menu-divider" />
            <div className="context-menu-item highlight" onClick={() => canvasActions.addStarterNode()}>
              <span>New Conversation</span>
              <span className="context-menu-shortcut">
                {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘N' : 'Ctrl+N'}
              </span>
            </div>
            <div className="context-menu-item" onClick={() => canvasActions.addConversationNode({ id: '' } as never, screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y }))}>
              <span>Load Conversation</span>
              <span className="context-menu-shortcut">
                {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⇧⌘L' : 'Ctrl+Shift+L'}
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
                        <span className={`integration-status ${linear.isConnected ? 'connected' : 'disconnected'}`}>
                          {linear.isConnected ? '● Connected' : '○ Not connected'}
                        </span>
                      </div>
                    </div>
                    <div className="integration-content">
                      <input
                        type="password"
                        placeholder="Enter Linear API Key"
                        value={linear.apiKey}
                        onChange={(e) => linear.connect(e.target.value)}
                        className="integration-input"
                        disabled={linear.isConnected}
                      />
                      {linear.isConnected ? (
                        <button
                          onClick={linear.disconnect}
                          className="integration-button disconnect"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          onClick={() => linear.connect(linear.apiKey)}
                          className="integration-button connect"
                          disabled={!linear.apiKey.trim()}
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
                  <h3>Appearance</h3>
                  <div className="settings-item">
                    <span>Color Palette</span>
                    <select
                      className="theme-select"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as 'dark' | 'light' | 'light-web')}
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                      <option value="light-web">Light (Web)</option>
                    </select>
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

        {/* Issues Pill - COMMENTED OUT */}
        {false && linear.isConnected && (
          <div
            onClick={!pill.isPillSquare ? pill.togglePill : undefined}
            className={`issues-pill ${!pill.isPillSquare ? 'cursor-pointer' : 'cursor-default'} ${
              pill.isPillExpanded ? 'expanded' : ''
            } ${pill.isPillSquare ? 'square' : ''}`}
            style={{
              borderRadius: pill.isPillSquare ? '24px' : '20px'
            }}
          >
            {!pill.isPillSquare ? (
              <div className={`pill-text ${pill.isTextVisible ? 'visible' : ''}`}>
                View Issues...
              </div>
            ) : pill.showPillContent ? (
              <div className="pill-content-wrapper" onClick={(e) => e.stopPropagation()}>
                {/* Collapse nozzle at top */}
                <div
                  className={`collapse-nozzle ${pill.isContentVisible ? 'visible' : ''}`}
                  onClick={pill.collapsePill}
                  title="Collapse issues"
                />

                {/* Issues list */}
                <div className={`issues-list ${pill.isContentVisible ? 'visible' : ''}`}>
                  <div className="issues-toolbar">
                    <div className="issues-workspace">
                      <span className="issues-workspace-label">Workspace</span>
                      <span className="issues-workspace-name">
                        {linear.workspaceName || (linear.isLoading ? 'Loading...' : 'Unknown')}
                      </span>
                    </div>
                    <div className="issues-filters">
                      <div className="issues-filter">
                        <label htmlFor="issues-filter-project">Project</label>
                        <select
                          id="issues-filter-project"
                          className="issues-select"
                          value={linear.selectedProjectId}
                          onChange={(event) => linear.setFilter('selectedProjectId', event.target.value)}
                        >
                          <option value="all">All projects</option>
                          {linear.hasUnassignedProject && <option value="none">No project</option>}
                          {linear.projectOptions.map((project) => (
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
                          value={linear.selectedMilestoneId}
                          onChange={(event) => linear.setFilter('selectedMilestoneId', event.target.value)}
                        >
                          <option value="all">All milestones</option>
                          {linear.hasUnassignedMilestone && <option value="none">No milestone</option>}
                          {linear.visibleMilestoneOptions.map((milestone) => (
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
                          value={linear.selectedStatusId}
                          onChange={(event) => linear.setFilter('selectedStatusId', event.target.value)}
                        >
                          <option value="all">All statuses</option>
                          {linear.statusOptions.map((state) => (
                            <option key={state.id} value={state.id}>
                              {state.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {linear.isLoading ? (
                    <div className="loading-state">Loading issues...</div>
                  ) : linear.filteredIssues.length === 0 ? (
                    <div className="empty-state">
                      {linear.issues.length === 0 ? 'No open issues found' : 'No issues match these filters'}
                    </div>
                  ) : (
                    linear.filteredIssues.map((issue: LinearIssue) => {
                      const projectLabel = issue.project?.name;
                      const milestoneLabel = issue.projectMilestone?.name;
                      return (
                        <div
                          key={issue.id}
                          className="issue-card"
                          draggable
                          onDragStart={(e) => canvasDrop.handleIssueDragStart(e, issue)}
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

        <ActionPill />
      </div>
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

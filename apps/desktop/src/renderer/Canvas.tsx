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
import { MeshGradient, Dithering } from '@paper-design/shaders-react';
import ForkGhostNode from './ForkGhostNode';
import ForkSessionModal from './ForkSessionModal';
import IssueDetailsModal from './IssueDetailsModal';
import './Canvas.css';
import { forkStore, nodeStore } from './stores';
import {
  useCanvasPersistence,
  useLinear,
  useAgentHierarchy,
  useForkModal,
  useCanvasActions,
  useFolderLock,
  useFolderHighlight,
  applyHighlightStylesToNodes,
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
import { createLinearIssueAttachment } from './types/attachments';

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

const sanitizeEdges = (edges: Edge[], nodes: Node[]) => {
  const nodeIds = new Set(nodes.map((node) => node.id));
  return edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => {
      const nextEdge: Edge = { ...edge };
      if (nextEdge.sourceHandle == null || nextEdge.sourceHandle === 'null') {
        delete nextEdge.sourceHandle;
      }
      if (nextEdge.targetHandle == null || nextEdge.targetHandle === 'null') {
        delete nextEdge.targetHandle;
      }
      return nextEdge;
    });
};

function CanvasFlow() {
  // Theme hook
  const { theme, setTheme } = useTheme();

  // GitHub username state
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [githubError, setGithubError] = useState<string | null>(null);

  // Linear issue details modal state
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

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

  // Fetch GitHub username on mount
  useEffect(() => {
    const fetchGithubUsername = async () => {
      try {
        const result = await window.gitAPI?.getGithubUsername();
        if (result?.success && result.username) {
          setGithubUsername(result.username);
          setGithubError(null);
        } else {
          setGithubError(result?.error || 'Failed to get GitHub username');
          setGithubUsername(null);
        }
      } catch (error) {
        const errorMessage = (error as Error).message || 'Unknown error';
        setGithubError(errorMessage);
        setGithubUsername(null);
      }
    };
    fetchGithubUsername();
  }, []);

  // Track if initial state has been applied
  const initialStateApplied = useRef(false);
  const restoreEdgesFrameRef = useRef<number | null>(null);
  // Apply restored state when it becomes available
  useEffect(() => {
    if (!isCanvasLoading) {
      if (!initialStateApplied.current && (initialNodes.length > 0 || initialEdges.length > 0)) {
        console.log('[Canvas] Restoring nodes from persistence:', initialNodes.map(n => ({
          nodeId: n.id,
          agentId: (n.data as Record<string, unknown>)?.agentId,
          title: ((n.data as Record<string, unknown>)?.title as { value?: string })?.value,
        })));
        // Strip any persisted highlight styles (boxShadow/borderRadius on agent nodes)
        // Highlighting is transient UI state, not meant to persist across refreshes
        const cleanedNodes = initialNodes.map((node) => {
          if (node.type !== 'agent' || !node.style) return node;
          const { boxShadow, borderRadius, ...restStyle } = node.style as Record<string, unknown>;
          return { ...node, style: restStyle };
        });
        const cleanedEdges = sanitizeEdges(initialEdges, cleanedNodes);
        setNodes(cleanedNodes);
        if (restoreEdgesFrameRef.current !== null) {
          cancelAnimationFrame(restoreEdgesFrameRef.current);
        }
        restoreEdgesFrameRef.current = requestAnimationFrame(() => {
          setEdges(cleanedEdges);
        });
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

  // Handle action pill highlighting events
  useEffect(() => {
    const handleHighlightAgent = (event: Event) => {
      const customEvent = event as CustomEvent<{ agentId: string }>;
      const { agentId } = customEvent.detail;

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.type !== 'agent') return node;
          const nodeData = node.data as Record<string, unknown>;
          const nodeAgentId = nodeData?.agentId as string | undefined;

          if (nodeAgentId === agentId) {
            // Add blue border and shadow to matching node (using command palette blue)
            const currentStyle = node.style || {};
            return {
              ...node,
              style: {
                ...currentStyle,
                border: '2px solid #4a9eff',
                borderRadius: '12px',
                boxShadow: '0 0 32px 8px rgba(74, 158, 255, 0.6)',
              },
            };
          } else {
            // Remove highlight from other nodes (preserve other styles)
            const currentStyle = node.style || {};
            const { border, boxShadow, borderRadius, ...restStyle } = currentStyle as Record<string, unknown>;
            // Only remove if it's our highlight (check if it's the blue border/shadow)
            if (
              (border as string)?.includes('#4a9eff') ||
              (boxShadow as string)?.includes('rgba(74, 158, 255')
            ) {
              return { ...node, style: restStyle };
            }
            return node;
          }
        })
      );
    };

    const handleUnhighlightAgent = () => {
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.type !== 'agent') return node;
          const currentStyle = node.style || {};
          const { border, boxShadow, borderRadius, ...restStyle } = currentStyle as Record<string, unknown>;
          // Only remove if it's our highlight (check if it's the blue border/shadow)
          if (
            (border as string)?.includes('#4a9eff') ||
            (boxShadow as string)?.includes('rgba(74, 158, 255')
          ) {
            return { ...node, style: restStyle };
          }
          return node;
        })
      );
    };

    window.addEventListener('action-pill:highlight-agent', handleHighlightAgent as EventListener);
    window.addEventListener('action-pill:unhighlight-agent', handleUnhighlightAgent as EventListener);

    return () => {
      window.removeEventListener('action-pill:highlight-agent', handleHighlightAgent as EventListener);
      window.removeEventListener('action-pill:unhighlight-agent', handleUnhighlightAgent as EventListener);
    };
  }, [setNodes]);

  // Core UI state (kept in Canvas)
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
const { screenToFlowPosition, getNodes } = useReactFlow();
  const [isNodeDragEnabled, setIsNodeDragEnabled] = useState(false);
  const [_isShiftPressed, setIsShiftPressed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNewAgentModalOpen, setIsNewAgentModalOpen] = useState(false);
  const [autoCreateWorktree, setAutoCreateWorktree] = useState(false);
  const [pendingAgentPosition, setPendingAgentPosition] = useState<{ x: number; y: number } | undefined>(undefined);
  const [pendingLinearIssue, setPendingLinearIssue] = useState<LinearIssue | undefined>(undefined);
  const [isLinearCollapsed, setIsLinearCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(0);

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

  // Folder highlight state
  const folderHighlight = useFolderHighlight(folderPathMap);

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
    onOpenAgentModal: (position, linearIssue) => {
      setPendingAgentPosition(position);
      setPendingLinearIssue(linearIssue);
      setIsNewAgentModalOpen(true);
    },
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

  // Chat message fork - listen for text selection fork events
  useEffect(() => {
    const handleChatMessageFork = (event: Event) => {
      const customEvent = event as CustomEvent<{ nodeId: string; selectedText: string; messageId?: string }>;
      const { nodeId, selectedText, messageId } = customEvent.detail;

      console.log('[Canvas] chat-message-fork event:', {
        nodeId,
        selectedText: selectedText.slice(0, 50) + (selectedText.length > 50 ? '...' : ''),
        messageId,
      });

      // Find the source node
      const sourceNode = nodes.find((n) => n.id === nodeId);
      if (!sourceNode) {
        console.error('[Canvas] Source node not found:', nodeId);
        return;
      }

      // Calculate position to the RIGHT of source node
      const nodeWidth = (sourceNode.width as number) || (sourceNode.style?.width as number) || 600;
      const horizontalSpacing = 100;
      const forkPosition = {
        x: sourceNode.position.x + nodeWidth + horizontalSpacing,
        y: sourceNode.position.y,
      };

      // Open the fork modal with messageId for context filtering
      forkModal.open(nodeId, forkPosition, messageId);
    };

    window.addEventListener('chat-message-fork', handleChatMessageFork);
    return () => window.removeEventListener('chat-message-fork', handleChatMessageFork);
  }, [nodes, forkModal]);

  // Check if there are any agents
  const hasAgents = useMemo(() => {
    return nodes.some((node) => node.type === 'agent');
  }, [nodes]);

  // Apply highlight styles to nodes when highlighting changes
  // Always run to clear styles when toggled off (empty collections)
  useEffect(() => {
    setNodes((nds) => applyHighlightStylesToNodes(nds, folderHighlight.highlightedFolders, folderHighlight.folderColors));
  }, [folderHighlight.highlightedFolders, folderHighlight.folderColors, setNodes]);

  // =============================================================================
  // Node store sync
  // =============================================================================

  // Sync nodeStore with React Flow's nodes state
  useEffect(() => {
    nodeStore.setNodes(nodes);
  }, [nodes]);

  // Listen for node update events and delegate to nodeStore
  useEffect(() => {
    const handleUpdateNode = (event: CustomEvent) => {
      const { nodeId, data } = event.detail;
      nodeStore.updateNode(nodeId, data as Record<string, unknown>);
      setNodes((nds) =>
        nds.map((node) => (node.id === nodeId ? { ...node, data: { ...data } } : node))
      );
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
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            sourceHandle:
              params.sourceHandle == null || params.sourceHandle === 'null'
                ? null
                : params.sourceHandle,
            targetHandle:
              params.targetHandle == null || params.targetHandle === 'null'
                ? null
                : params.targetHandle,
          },
          eds
        )
      ),
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

// Keyboard shortcut: Cmd+F (Mac) / Ctrl+F (Windows/Linux) to fork selected node
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd+F (Mac) or Ctrl+F (Windows/Linux)
      // Don't trigger if user is typing in an input/textarea
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isForkShortcut =
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'f' &&
        !event.shiftKey &&
        !event.altKey;

      if (!isForkShortcut) return;

      event.preventDefault();

      // Get current nodes from React Flow (includes up-to-date selection state)
      const currentNodes = getNodes();

      // Find selected AgentNode (type is 'agent', not 'agentNode')
      const selectedNode = currentNodes.find(
        (n) => n.selected && n.type === 'agent'
      );

      if (!selectedNode) {
        console.log('[Canvas] No AgentNode selected for fork shortcut');
        return;
      }

      // Calculate position for the forked node (placed below the source node)
      // Get node dimensions to calculate proper offset
      const nodeHeight = 400; // Default agent node height
      const verticalSpacing = 100; // Space between nodes
      const forkPosition = {
        x: selectedNode.position?.x ?? 0,
        y: (selectedNode.position?.y ?? 0) + nodeHeight + verticalSpacing,
      };

      console.log('[Canvas] Fork shortcut triggered for node:', selectedNode.id);
      forkModal.open(selectedNode.id, forkPosition);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [getNodes, forkModal]);

  // Listen for create/close chat node events
  useEffect(() => {
    const handleCreateChatNode = (event: Event) => {
      const customEvent = event as CustomEvent<{
        nodeId: string;
        agentId: string;
        sessionId?: string;
        agentType: string;
        workspacePath?: string;
        title?: string;
      }>;
      const { nodeId, agentId, sessionId, agentType, workspacePath, title } = customEvent.detail;

      // Check if a chat node already exists for this agent node
      const existingChatNode = nodes.find(
        (n) => n.type === 'agent-chat' &&
        (n.data as { agentId?: string })?.agentId === agentId &&
        edges.some((e) => e.source === nodeId && e.target === n.id)
      );

      if (existingChatNode) {
        // Remove existing chat node and its edge
        const edgeToRemove = edges.find((e) => e.source === nodeId && e.target === existingChatNode.id);
        setNodes((nds) => nds.filter((n) => n.id !== existingChatNode.id));
        if (edgeToRemove) {
          setEdges((eds) => eds.filter((e) => e.id !== edgeToRemove.id));
        }
        console.log('[Canvas] Removed chat node for agent node:', nodeId);
        return;
      }

      // Find the source node
      const sourceNode = nodes.find((n) => n.id === nodeId);
      if (!sourceNode) {
        console.error('[Canvas] Source node not found for create chat node:', nodeId);
        return;
      }

      // Get node dimensions (default if not available)
      const nodeWidth = (sourceNode.width as number) || (sourceNode.style?.width as number) || 500;
      const nodeHeight = (sourceNode.height as number) || (sourceNode.style?.height as number) || 450;

      // Calculate position below the source node
      const chatNodePosition = {
        x: sourceNode.position.x,
        y: sourceNode.position.y + nodeHeight + 50, // 50px spacing
      };

      // Create new chat node
      // Note: Messages are loaded via agentService.getSession(), not stored in node data
      const chatNodeId = `chat-node-${Date.now()}`;
      const chatNode: Node = {
        id: chatNodeId,
        type: 'agent-chat',
        position: chatNodePosition,
        data: {
          sessionId,
          agentType,
          workspacePath,
          title: title || 'Chat',
          isDraft: !sessionId,
          isExpanded: true,
          agentId, // Pass agentId so it can use the same agent service
        },
        style: {
          width: nodeWidth,
          height: nodeHeight,
        },
      };

      // Create edge connecting the nodes
      const edge: Edge = {
        id: `edge-${nodeId}-${chatNodeId}`,
        source: nodeId,
        target: chatNodeId,
        type: 'smooth',
        animated: false,
        style: { stroke: '#4a5568', strokeWidth: 2 },
      };

      // Add the new node and edge
      setNodes((nds) => [...nds, chatNode]);
      setEdges((eds) => [...eds, edge]);

      console.log('[Canvas] Created chat node from agent node:', {
        sourceNodeId: nodeId,
        chatNodeId,
        position: chatNodePosition,
      });
    };

    window.addEventListener('agent-node:create-chat-node', handleCreateChatNode as EventListener);
    return () => {
      window.removeEventListener('agent-node:create-chat-node', handleCreateChatNode as EventListener);
    };
  }, [nodes, edges, setNodes, setEdges]);

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
      id: 'create-linear-ticket',
      label: 'Create Linear Ticket',
      shortcut: 'm',
      action: () => createLinearTicket(),
    },
  ], [canvasActions, createLinearTicket]);

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
          setPendingLinearIssue(undefined);
        } else {
          canvasActions.addAgentNode();
        }
        return;
      }

// CMD+G / CTRL+G to open agent modal with new worktree
      if (modifierKey && event.key === 'g') {
        event.preventDefault(); // Prevent default browser behavior
        if (!isNewAgentModalOpen) {
          setAutoCreateWorktree(true);
          canvasActions.addAgentNode();
        }
        return;
      }

      if (modifierKey && event.shiftKey && event.key === 'A') {
        event.preventDefault();
        canvasActions.addAgentNode();
      }

      if (modifierKey && event.key === 'n') {
        event.preventDefault();
        canvasActions.addStarterNode();
      }

      if ((isMac && event.metaKey) || (!isMac && event.ctrlKey)) {
        if (!isNodeDragEnabled) {
          setIsNodeDragEnabled(true);
        }
      }

      // Track Shift key for snap-to-edge
      if (event.key === 'Shift') {
        setIsShiftPressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if ((isMac && event.key === 'Meta') || (!isMac && event.key === 'Control')) {
        setIsNodeDragEnabled(false);
      }

      // Track Shift key release
      if (event.key === 'Shift') {
        setIsShiftPressed(false);
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

// Snap-to-edge functionality when dragging nodes
  const SNAP_THRESHOLD = 20; // pixels - soft snapping threshold
  const isSnappingRef = useRef(false); // Prevent infinite loops

  // Shared function to calculate and apply snapping
  const applySnapping = useCallback(
    (node: Node, allNodes: Node[]) => {
      const currentNode = node;
      const otherNodes = allNodes.filter((n) => n.id !== currentNode.id);

      if (otherNodes.length === 0) {
        return null;
      }

      // Get current node dimensions
      const currentNodeWidth =
        (currentNode.width as number) ||
        (currentNode.style?.width as number) ||
        (currentNode.measured?.width as number) ||
        500;
      const currentNodeHeight =
        (currentNode.height as number) ||
        (currentNode.style?.height as number) ||
        (currentNode.measured?.height as number) ||
        400;

      // Calculate current node bounds
      const currentNodeLeft = currentNode.position.x;
      const currentNodeRight = currentNode.position.x + currentNodeWidth;
      const currentNodeTop = currentNode.position.y;
      const currentNodeBottom = currentNode.position.y + currentNodeHeight;

      let snappedX = currentNode.position.x;
      let snappedY = currentNode.position.y;
      let minDistanceX = SNAP_THRESHOLD;
      let minDistanceY = SNAP_THRESHOLD;

      // Check alignment with other nodes
      for (const otherNode of otherNodes) {
        const otherNodeWidth =
          (otherNode.width as number) ||
          (otherNode.style?.width as number) ||
          (otherNode.measured?.width as number) ||
          500;
        const otherNodeHeight =
          (otherNode.height as number) ||
          (otherNode.style?.height as number) ||
          (otherNode.measured?.height as number) ||
          400;

        const otherNodeLeft = otherNode.position.x;
        const otherNodeRight = otherNode.position.x + otherNodeWidth;
        const otherNodeTop = otherNode.position.y;
        const otherNodeBottom = otherNode.position.y + otherNodeHeight;

        // Check horizontal alignment (left edges, right edges, left-right, right-left)
        const leftToLeft = Math.abs(currentNodeLeft - otherNodeLeft);
        const rightToRight = Math.abs(currentNodeRight - otherNodeRight);
        const leftToRight = Math.abs(currentNodeLeft - otherNodeRight);
        const rightToLeft = Math.abs(currentNodeRight - otherNodeLeft);

        // Find closest horizontal alignment
        const horizontalDistances = [
          { distance: leftToLeft, snap: otherNodeLeft },
          { distance: rightToRight, snap: otherNodeRight - currentNodeWidth },
          { distance: leftToRight, snap: otherNodeRight },
          { distance: rightToLeft, snap: otherNodeLeft - currentNodeWidth },
        ];

        for (const { distance, snap } of horizontalDistances) {
          if (distance < minDistanceX) {
            minDistanceX = distance;
            snappedX = snap;
          }
        }

        // Check vertical alignment (top edges, bottom edges, top-bottom, bottom-top)
        const topToTop = Math.abs(currentNodeTop - otherNodeTop);
        const bottomToBottom = Math.abs(currentNodeBottom - otherNodeBottom);
        const topToBottom = Math.abs(currentNodeTop - otherNodeBottom);
        const bottomToTop = Math.abs(currentNodeBottom - otherNodeTop);

        // Find closest vertical alignment
        const verticalDistances = [
          { distance: topToTop, snap: otherNodeTop },
          { distance: bottomToBottom, snap: otherNodeBottom - currentNodeHeight },
          { distance: topToBottom, snap: otherNodeBottom },
          { distance: bottomToTop, snap: otherNodeTop - currentNodeHeight },
        ];

        for (const { distance, snap } of verticalDistances) {
          if (distance < minDistanceY) {
            minDistanceY = distance;
            snappedY = snap;
          }
        }
      }

      // Return snapped position if within threshold
      if (minDistanceX < SNAP_THRESHOLD || minDistanceY < SNAP_THRESHOLD) {
        return {
          x: minDistanceX < SNAP_THRESHOLD ? snappedX : currentNode.position.x,
          y: minDistanceY < SNAP_THRESHOLD ? snappedY : currentNode.position.y,
        };
      }

      return null;
    },
    []
  );

  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Only apply snapping if drag is enabled and not already snapping
      if (!isNodeDragEnabled || isSnappingRef.current) {
        return;
      }

      const allNodes = getNodes();
      const snappedPosition = applySnapping(node, allNodes);

      // Apply snapping if within threshold
      if (snappedPosition) {
        isSnappingRef.current = true;
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === node.id) {
              return {
                ...n,
                position: snappedPosition,
              };
            }
            return n;
          })
        );
        // Reset flag after a short delay to allow next drag event
        setTimeout(() => {
          isSnappingRef.current = false;
        }, 10);
      }
    },
    [isNodeDragEnabled, getNodes, setNodes, applySnapping]
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, _node: Node) => {
      isSnappingRef.current = false;
    },
    []
  );

  // Wrap onNodesChange to intercept position changes and apply snapping
  const handleNodesChange = useCallback(
    (changes: unknown[]) => {
      // If snapping is disabled or we're already snapping, just pass through
      if (!isNodeDragEnabled || isSnappingRef.current) {
        onNodesChange(changes as Parameters<typeof onNodesChange>[0]);
        return;
      }

      const allNodes = getNodes();
      const modifiedChanges = changes.map((change) => {
        const posChange = change as { type?: string; position?: { x: number; y: number }; id?: string };
        // Intercept position changes and apply snapping
        if (posChange.type === 'position' && posChange.position) {
          const node = allNodes.find((n) => n.id === posChange.id);
          if (node) {
            // Create a temporary node with the new position to check snapping
            const tempNode = {
              ...node,
              position: posChange.position,
            };
            const snappedPosition = applySnapping(tempNode, allNodes);
            if (snappedPosition) {
              // Modify the change to use the snapped position
              return {
                ...posChange,
                position: snappedPosition,
              };
            }
          }
        }
        return change;
      });

      // Check if any changes were modified
      const hasSnapping = modifiedChanges.some(
        (change, index) => change !== changes[index]
      );

      if (hasSnapping) {
        isSnappingRef.current = true;
        // Apply the modified changes
        onNodesChange(modifiedChanges as Parameters<typeof onNodesChange>[0]);
        // Reset flag after a short delay
        setTimeout(() => {
          isSnappingRef.current = false;
        }, 10);
      } else {
        // No snapping needed, pass through original changes
        onNodesChange(changes as Parameters<typeof onNodesChange>[0]);
      }
    },
    [onNodesChange, isNodeDragEnabled, getNodes, applySnapping]
  );

  // =============================================================================
  // Resize handlers
  // =============================================================================

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = sidebar.sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebar.sidebarWidth]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const deltaX = e.clientX - resizeStartXRef.current;
    const newWidth = resizeStartWidthRef.current + deltaX;
    sidebar.setSidebarWidth(newWidth);
  }, [isResizing, sidebar]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // =============================================================================
  // Gradient configurations based on first letter of username
  // =============================================================================

  type GradientConfig = 
    | {
        type: 'mesh';
        speed: number;
        distortion: number;
        swirl: number;
        frame: number;
        grainMixer: number;
        grainOverlay: number;
        colors: string[];
        rotate: string;
        overlayColor: string;
      }
    | {
        type: 'dithering';
        speed: number;
        shape: 'swirl' | 'warp' | 'simplex' | 'dots' | 'wave' | 'ripple' | 'sphere';
        ditherType: '8x8' | 'random' | '2x2' | '4x4';
        pxSize: number;
        scale: number;
        frame: number;
        size: number;
        colorFront: string;
        overlayColor: string;
        backgroundColor?: string;
      };

  const getGradientForLetter = useCallback((letter: string | null): GradientConfig => {
    if (!letter) {
      // Default to A, B gradient if no username
      return {
        type: 'mesh',
        speed: 1.49,
        distortion: 0.58,
        swirl: 0.55,
        frame: 3547980.561001969,
        grainMixer: 1,
        grainOverlay: 1,
        colors: ['#FFFFFF', '#0051FF'],
        rotate: '0deg',
        overlayColor: '#0051FF',
      };
    }

    const upperLetter = letter.toUpperCase();
    
    // A, B
    if (upperLetter === 'A' || upperLetter === 'B') {
      return {
        type: 'mesh',
        speed: 1.49,
        distortion: 0.58,
        swirl: 0.55,
        frame: 3547980.561001969,
        grainMixer: 1,
        grainOverlay: 1,
        colors: ['#FFFFFF', '#0051FF'],
        rotate: '0deg',
        overlayColor: '#0051FF',
      };
    }
    
    // C, D
    if (upperLetter === 'C' || upperLetter === 'D') {
      return {
        type: 'mesh',
        speed: 1.49,
        distortion: 0.58,
        swirl: 0.55,
        frame: 2555302.0330011887,
        grainMixer: 1,
        grainOverlay: 1,
        colors: ['#FFE8AF', '#E54F0E'],
        rotate: '0deg',
        overlayColor: '#E54F0E',
      };
    }
    
    // E, F
    if (upperLetter === 'E' || upperLetter === 'F') {
      return {
        type: 'mesh',
        speed: 1.49,
        distortion: 0.58,
        swirl: 0.55,
        frame: 2449626.3160010916,
        grainMixer: 1,
        grainOverlay: 1,
        colors: ['#FFFFFF', '#CD005F'],
        rotate: '0deg',
        overlayColor: '#CD005F',
      };
    }
    
    // G, H
    if (upperLetter === 'G' || upperLetter === 'H') {
      return {
        type: 'mesh',
        speed: 1.49,
        distortion: 0.58,
        swirl: 0.55,
        frame: 5438369.934008135,
        grainMixer: 1,
        grainOverlay: 1,
        colors: ['#000000', '#008A6D'],
        rotate: '0deg',
        overlayColor: '#008A6D',
      };
    }
    
    // I, J
    if (upperLetter === 'I' || upperLetter === 'J') {
      return {
        type: 'dithering' as const,
        speed: 0.9,
        shape: 'warp' as const,
        ditherType: '8x8' as const,
        pxSize: 1.8,
        scale: 0.51,
        frame: 246417.07600003193,
        size: 2.7,
        colorFront: '#8DB735',
        overlayColor: '#8DB735',
      };
    }
    
    // K, L
    if (upperLetter === 'K' || upperLetter === 'L') {
      return {
        type: 'dithering' as const,
        speed: 1.22,
        shape: 'warp' as const,
        ditherType: 'random' as const,
        pxSize: 1.8,
        scale: 0.66,
        frame: 442221.90600008366,
        size: 2.6,
        colorFront: '#FFFFFF',
        overlayColor: '#FFFFFF',
      };
    }
    
    // M, N
    if (upperLetter === 'M' || upperLetter === 'N') {
      return {
        type: 'mesh',
        speed: 1.49,
        distortion: 0.58,
        swirl: 0.55,
        frame: 3475477.906001939,
        grainMixer: 1,
        grainOverlay: 1,
        colors: ['#C5D2F8', '#4F0C28'],
        rotate: '0deg',
        overlayColor: '#4F0C28',
      };
    }
    
    // O, P
    if (upperLetter === 'O' || upperLetter === 'P') {
      return {
        type: 'mesh',
        speed: 1.49,
        distortion: 0.58,
        swirl: 0.55,
        frame: 5438369.934008135,
        grainMixer: 1,
        grainOverlay: 1,
        colors: ['#282828', '#A8051A'],
        rotate: '0deg',
        overlayColor: '#A8051A',
      };
    }
    
    // Q, R
    if (upperLetter === 'Q' || upperLetter === 'R') {
      return {
        type: 'mesh',
        speed: 1.49,
        distortion: 0.58,
        swirl: 0.55,
        frame: 5219391.935008144,
        grainMixer: 1,
        grainOverlay: 1,
        colors: ['#004D00', '#53F398'],
        rotate: '0deg',
        overlayColor: '#53F398',
      };
    }
    
    // S, T
    if (upperLetter === 'S' || upperLetter === 'T') {
      return {
        type: 'dithering' as const,
        speed: 1,
        shape: 'dots' as const,
        ditherType: 'random' as const,
        pxSize: 1.8,
        scale: 1.24,
        frame: 648655.0500000913,
        size: 11.6,
        colorFront: '#485ACD',
        overlayColor: '#485ACD',
        backgroundColor: '#000000',
      };
    }
    
    // U, V, W
    if (upperLetter === 'U' || upperLetter === 'V' || upperLetter === 'W') {
      return {
        type: 'mesh',
        speed: 1.49,
        distortion: 0.58,
        swirl: 0.55,
        frame: 4558265.078004454,
        grainMixer: 1,
        grainOverlay: 1,
        colors: ['#DADABC', '#BCA145'],
        rotate: '0deg',
        overlayColor: '#BCA145',
      };
    }
    
    // X, Y, Z
    if (upperLetter === 'X' || upperLetter === 'Y' || upperLetter === 'Z') {
      return {
        type: 'dithering' as const,
        speed: 0.9,
        shape: 'warp' as const,
        ditherType: '8x8' as const,
        pxSize: 1.8,
        scale: 0.51,
        frame: 396886.546000077,
        size: 2.7,
        colorFront: '#FF00EA',
        overlayColor: '#FF00EA',
      };
    }
    
    // Default fallback
    return {
      type: 'mesh',
      speed: 1.49,
      distortion: 0.58,
      swirl: 0.55,
      frame: 3547980.561001969,
      grainMixer: 1,
      grainOverlay: 1,
      colors: ['#FFFFFF', '#0051FF'],
      rotate: '0deg',
      overlayColor: '#0051FF',
    };
  }, []);

  const selectedGradient = useMemo(() => {
    if (!githubUsername) {
      return getGradientForLetter(null);
    }
    
    const firstChar = githubUsername.charAt(0);
    // If it's a number (0-9), map to first 10 letter pairs (A-T)
    if (/[0-9]/.test(firstChar)) {
      const num = parseInt(firstChar, 10);
      // Map: 0→A, 1→C, 2→E, 3→G, 4→I, 5→K, 6→M, 7→O, 8→Q, 9→S
      const letterPairs = ['A', 'C', 'E', 'G', 'I', 'K', 'M', 'O', 'Q', 'S'];
      return getGradientForLetter(letterPairs[num]);
    }
    
    // Otherwise, use the first letter as-is
    return getGradientForLetter(firstChar);
  }, [githubUsername, getGradientForLetter]);

  // Helper to determine if overlay color is light (for text color adjustment)
  const isLightColor = useCallback((color: string): boolean => {
    // Remove # if present
    const hex = color.replace('#', '');
    // Convert to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  }, []);

  const overlayTextColor = useMemo(() => {
    return isLightColor(selectedGradient.overlayColor) ? '#000000' : '#FFFFFF';
  }, [selectedGradient.overlayColor, isLightColor]);

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

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className={`canvas-container ${isNodeDragEnabled ? 'drag-mode' : ''} ${isResizing ? 'resizing' : ''}`}>
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
          setPendingLinearIssue(undefined);
          setAutoCreateWorktree(false);
        }}
        onCreate={(data) => {
          canvasActions.createAgentWithData({
            position: pendingAgentPosition,
            gitInfo: data.gitInfo,
            modalData: {
              title: data.title,
              description: data.description,
              workspacePath: data.workspacePath,
            },
            lockedFolderPath: data.workspacePath || folderLock.lockedFolderPath,
            initialAttachments: pendingLinearIssue
              ? [
                  createLinearIssueAttachment({
                    id: pendingLinearIssue.id,
                    identifier: pendingLinearIssue.identifier,
                    title: pendingLinearIssue.title,
                    state: {
                      name: pendingLinearIssue.state.name,
                      color: pendingLinearIssue.state.color,
                    },
                    assignee: pendingLinearIssue.assignee,
                    // Priority is optional and LinearIssue has priority as number, not object
                    // So we omit it for now
                  }),
                ]
              : undefined,
          });
          setIsNewAgentModalOpen(false);
          setPendingAgentPosition(undefined);
          setPendingLinearIssue(undefined);
          setAutoCreateWorktree(false);
        }}
        initialPosition={pendingAgentPosition}
        initialWorkspacePath={folderLock.lockedFolderPath}
        autoCreateWorktree={autoCreateWorktree}
        initialDescription={
          pendingLinearIssue
            ? pendingLinearIssue.description
              ? `${pendingLinearIssue.title}\n\n${pendingLinearIssue.description}`
              : pendingLinearIssue.title
            : undefined
        }
      />

      {/* Sidebar Panel */}
      <div 
        className={`canvas-sidebar ${sidebar.isSidebarCollapsed ? 'collapsed' : ''} ${isResizing ? 'resizing' : ''}`}
        style={{ width: sidebar.isSidebarCollapsed ? 0 : `${sidebar.sidebarWidth}px` }}
      >
        <div className="sidebar-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            {githubUsername ? (
              <>
                <h2 className="sidebar-title">{githubUsername.replace(/^@/, '')}'s</h2>
                <div className="sidebar-username">Agent Base</div>
              </>
            ) : (
              <h2 className="sidebar-title">Canvas</h2>
            )}
            {githubError && (
              <div className="sidebar-error" title={githubError}>
                Error: {githubError}
              </div>
            )}
          </div>
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
                  const highlightColor = folderHighlight.getHighlightColor(projectPath);

                  return (
                    <div
                      key={projectName}
                      className="sidebar-folder"
                      onMouseEnter={() => folderLock.setHoveredFolderPath(projectPath || null)}
                      onMouseLeave={() => folderLock.setHoveredFolderPath(null)}
                    >
                      <div className="sidebar-folder-header-wrapper">
                        <button
                          className={`sidebar-folder-header ${!showLock ? 'no-lock' : ''}`}
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
                              style={{ color: highlightColor || undefined }}
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
                              style={{ color: highlightColor || undefined }}
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
                          <span className="sidebar-folder-name" style={{ color: highlightColor || undefined }}>{projectName}</span>
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
                              <svg width="12" height="12" viewBox="0 0 134 197" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M21.9727 191.504H111.328C125.684 191.504 133.301 183.691 133.301 168.262V100.977C133.301 85.6445 125.684 77.832 111.328 77.832H21.9727C7.61719 77.832 0 85.6445 0 100.977V168.262C0 183.691 7.61719 191.504 21.9727 191.504ZM22.4609 176.758C18.2617 176.758 15.8203 174.121 15.8203 169.336V99.9023C15.8203 95.1172 18.2617 92.5781 22.4609 92.5781H110.84C115.137 92.5781 117.48 95.1172 117.48 99.9023V169.336C117.48 174.121 115.137 176.758 110.84 176.758H22.4609ZM17.0898 85.3516H32.6172V52.4414C32.6172 27.7344 48.3398 14.7461 66.6016 14.7461C84.8633 14.7461 100.781 27.7344 100.781 52.4414V85.3516H116.211V54.4922C116.211 17.7734 92.1875 0 66.6016 0C41.1133 0 17.0898 17.7734 17.0898 54.4922V85.3516Z" fill="currentColor"/>
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 134 197" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M21.9727 191.504H111.328C125.684 191.504 133.301 183.691 133.301 168.262L133.301 131.899C133.301 116.566 125.684 108.754 111.328 108.754H21.9727C7.61719 108.754 0 116.566 0 131.899V168.262C0 183.691 7.61719 191.504 21.9727 191.504ZM22.4609 176.758C18.2617 176.758 15.8203 174.121 15.8203 169.336L15.8203 130.824C15.8203 126.039 18.2617 123.5 22.4609 123.5H110.84C115.137 123.5 117.48 126.039 117.48 130.824L117.48 169.336C117.48 174.121 115.137 176.758 110.84 176.758H22.4609ZM17.1142 52.4792C17.0872 53.5835 17.9852 54.4922 19.0898 54.4922H30.5664C31.699 54.4922 32.6172 53.574 32.6172 52.4414C32.6172 27.7344 48.3398 14.7461 66.6016 14.7461C84.8633 14.7461 100.781 27.7344 100.781 52.4414V114H116.211V54.4922C116.211 17.7734 92.1875 0 66.6016 0C41.5835 0 17.9767 17.1236 17.1142 52.4792Z" fill="currentColor"/>
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

            {/* Linear Issues Container - Fixed at bottom */}
            {linear.isConnected && (
              <div className="sidebar-linear-issues-container">
                <div 
                  className="sidebar-linear-issues-header"
                  onClick={() => setIsLinearCollapsed(!isLinearCollapsed)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className={`sidebar-linear-issues-chevron ${isLinearCollapsed ? 'collapsed' : 'expanded'}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </span>
                  <h3 className="sidebar-linear-issues-title">Linear</h3>
                </div>

                {!isLinearCollapsed && (
                  <>
                    <div className="sidebar-linear-issues-filters">
                  <div className="sidebar-linear-issues-filter">
                    <select
                      id="sidebar-issues-filter-project"
                      className="sidebar-issues-select"
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
                  <div className="sidebar-linear-issues-filter">
                    <select
                      id="sidebar-issues-filter-milestone"
                      className="sidebar-issues-select"
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
                  <div className="sidebar-linear-issues-filter">
                    <select
                      id="sidebar-issues-filter-status"
                      className="sidebar-issues-select"
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

                <div className="sidebar-linear-issues-list">
                  {linear.isLoading ? (
                    <div className="sidebar-linear-issues-loading">Loading issues...</div>
                  ) : linear.filteredIssues.length === 0 ? (
                    <div className="sidebar-linear-issues-empty">
                      {linear.issues.length === 0 ? 'No open issues found' : 'No issues match these filters'}
                    </div>
                  ) : (
                    linear.filteredIssues.map((issue: LinearIssue) => {
                      const projectLabel = issue.project?.name;
                      const milestoneLabel = issue.projectMilestone?.name;
                      return (
                        <div
                          key={issue.id}
                          className="sidebar-issue-card"
                          draggable
                          onDragStart={(e) => canvasDrop.handleIssueDragStart(e, issue)}
                          onClick={() => setSelectedIssueId(issue.id)}
                        >
                          <div className="sidebar-issue-header">
                            <span className="sidebar-issue-identifier">{issue.identifier}</span>
                            <span
                              className="sidebar-issue-status"
                              style={{ backgroundColor: issue.state.color }}
                            >
                              {issue.state.name}
                            </span>
                          </div>
                          <div className="sidebar-issue-title">{issue.title}</div>
                          {(projectLabel || milestoneLabel) && (
                            <div className="sidebar-issue-meta">
                              {projectLabel && <span>Project: {projectLabel}</span>}
                              {projectLabel && milestoneLabel && (
                                <span className="sidebar-issue-meta-sep">|</span>
                              )}
                              {milestoneLabel && <span>Milestone: {milestoneLabel}</span>}
                            </div>
                          )}
                          {issue.assignee && (
                            <div className="sidebar-issue-assignee">
                              {issue.assignee.avatarUrl && (
                                <img
                                  src={issue.assignee.avatarUrl}
                                  alt={issue.assignee.name}
                                  className="sidebar-assignee-avatar"
                                />
                              )}
                              <span className="sidebar-assignee-name">{issue.assignee.name}</span>
                            </div>
                          )}
                          <div className="sidebar-issue-priority">
                            Priority: {issue.priority === 0 ? 'None' : issue.priority === 1 ? 'Urgent' : issue.priority === 2 ? 'High' : issue.priority === 3 ? 'Medium' : 'Low'}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resize Handle */}
      {!sidebar.isSidebarCollapsed && (
        <div
          className="sidebar-resize-handle"
          onMouseDown={handleResizeStart}
        />
      )}

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

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
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
            gap={24}
            size={2}
            color={theme === 'light-web' ? '#F5F6F8' : theme === 'dark' ? '#171717' : '#3a3a3a'}
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
            messages={forkModal.messages}
            isLoadingMessages={forkModal.isLoadingMessages}
            onLoadMessages={forkModal.loadMessages}
            cutoffMessageId={forkModal.cutoffMessageId}
            originalTargetMessageId={forkModal.modalData?.originalTargetMessageId}
            onCutoffChange={forkModal.setCutoffMessageId}
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
          <>
            <div
              className="context-menu-overlay"
              onClick={() => setContextMenu(null)}
            />
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
                <span className="context-menu-label">Add Terminal</span>
                <span className="context-menu-shortcut">
                  {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘K' : 'Ctrl+K'}
                </span>
              </div>
              <div className="context-menu-item" onClick={() => canvasActions.addAgentNode()}>
                <span className="context-menu-label">Add Agent</span>
                <span className="context-menu-shortcut">
                  {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘T' : 'Ctrl+T'}
                </span>
              </div>
              <div className="context-menu-divider" />
              <div className="context-menu-item highlight" onClick={() => canvasActions.addStarterNode()}>
                <span className="context-menu-label">New Conversation</span>
                <span className="context-menu-shortcut">
                  {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘N' : 'Ctrl+N'}
                </span>
              </div>
            </div>
          </>
        )}

        {/* Eye Icon Button - Highlight All Folders */}
        <button
          className="highlight-all-fab"
          onClick={folderHighlight.toggleHighlightAll}
          aria-label={folderHighlight.isHighlightAllActive ? 'Unhighlight all folders' : 'Highlight all folders'}
          title={folderHighlight.isHighlightAllActive ? 'Unhighlight all folders' : 'Highlight all folders'}
        >
          <svg width="16" height="16" viewBox="0 0 267 168" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M133.496 167.48C212.402 167.48 266.895 103.711 266.895 83.7891C266.895 63.7695 212.305 0.0976562 133.496 0.0976562C55.6641 0.0976562 0 63.7695 0 83.7891C0 103.711 55.5664 167.48 133.496 167.48ZM133.496 152.051C69.1406 152.051 17.0898 97.5586 17.0898 83.7891C17.0898 72.168 69.1406 15.5273 133.496 15.5273C197.559 15.5273 249.805 72.168 249.805 83.7891C249.805 97.5586 197.559 152.051 133.496 152.051ZM133.496 138.379C163.77 138.379 188.281 113.867 188.281 83.5938C188.281 53.3203 163.77 28.8086 133.496 28.8086C103.223 28.8086 78.6133 53.3203 78.6133 83.5938C78.6133 113.867 103.223 138.379 133.496 138.379Z" fill="currentColor" fillOpacity={folderHighlight.isHighlightAllActive ? "1" : "0.85"}/>
          </svg>
        </button>

        {/* Settings FAB */}
        <button
          className="settings-fab"
          onClick={() => setIsSettingsOpen(true)}
          aria-label="Settings"
          title="Settings"
        >
          <svg width="16" height="16" viewBox="0 0 209 209" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#clip0_995_232)">
              <path d="M94.6289 208.789H114.355C121.875 208.789 127.734 204.199 129.395 196.973L133.594 178.711L136.719 177.637L152.637 187.402C158.984 191.309 166.309 190.43 171.68 185.059L185.352 171.484C190.723 166.113 191.602 158.691 187.695 152.441L177.734 136.621L178.906 133.691L197.168 129.395C204.297 127.734 208.984 121.777 208.984 114.355V95.0195C208.984 87.5977 204.395 81.7383 197.168 79.9805L179.102 75.5859L177.832 72.4609L187.793 56.6406C191.699 50.3906 190.918 43.0664 185.449 37.5977L171.777 23.9258C166.504 18.6523 159.18 17.6758 152.832 21.582L136.914 31.3477L133.594 30.0781L129.395 11.8164C127.734 4.58984 121.875 0 114.355 0H94.6289C87.1094 0 81.25 4.58984 79.5898 11.8164L75.293 30.0781L71.9727 31.3477L56.1523 21.582C49.8047 17.6758 42.3828 18.6523 37.1094 23.9258L23.5352 37.5977C18.0664 43.0664 17.1875 50.3906 21.1914 56.6406L31.0547 72.4609L29.8828 75.5859L11.8164 79.9805C4.58984 81.7383 0 87.5977 0 95.0195V114.355C0 121.777 4.6875 127.734 11.8164 129.395L30.0781 133.691L31.1523 136.621L21.2891 152.441C17.2852 158.691 18.2617 166.113 23.6328 171.484L37.207 185.059C42.5781 190.43 50 191.309 56.3477 187.402L72.168 177.637L75.293 178.711L79.5898 196.973C81.25 204.199 87.1094 208.789 94.6289 208.789ZM96.1914 193.555C94.5312 193.555 93.6523 192.871 93.3594 191.309L87.5 167.09C81.543 165.625 75.9766 163.281 71.7773 160.645L50.4883 173.73C49.3164 174.609 47.9492 174.512 46.875 173.242L35.3516 161.719C34.2773 160.645 34.1797 159.473 34.9609 158.105L48.0469 137.012C45.8008 132.91 43.2617 127.344 41.6992 121.387L17.4805 115.625C15.918 115.332 15.2344 114.453 15.2344 112.793V96.4844C15.2344 94.7266 15.8203 93.9453 17.4805 93.6523L41.6016 87.793C43.1641 81.4453 46.0938 75.6836 47.8516 72.0703L34.8633 50.9766C33.9844 49.5117 34.082 48.3398 35.1562 47.168L46.7773 35.8398C47.9492 34.668 49.0234 34.5703 50.4883 35.3516L71.582 48.1445C75.7812 45.8008 81.7383 43.3594 87.5977 41.6992L93.3594 17.4805C93.6523 15.918 94.5312 15.2344 96.1914 15.2344H112.793C114.453 15.2344 115.332 15.918 115.527 17.4805L121.484 41.8945C127.539 43.457 132.812 45.8984 137.207 48.2422L158.398 35.3516C159.961 34.5703 160.938 34.668 162.207 35.8398L173.73 47.168C174.902 48.3398 174.902 49.5117 174.023 50.9766L161.035 72.0703C162.891 75.6836 165.723 81.4453 167.285 87.793L191.504 93.6523C193.066 93.9453 193.75 94.7266 193.75 96.4844V112.793C193.75 114.453 192.969 115.332 191.504 115.625L167.188 121.387C165.625 127.344 163.184 132.91 160.84 137.012L173.926 158.105C174.707 159.473 174.707 160.645 173.535 161.719L162.109 173.242C160.938 174.512 159.668 174.609 158.398 173.73L137.109 160.645C132.91 163.281 127.441 165.625 121.484 167.09L115.527 191.309C115.332 192.871 114.453 193.555 112.793 193.555H96.1914ZM104.492 141.602C125.098 141.602 141.699 125 141.699 104.395C141.699 83.7891 125.098 67.1875 104.492 67.1875C83.8867 67.1875 67.2852 83.7891 67.2852 104.395C67.2852 125 83.8867 141.602 104.492 141.602ZM104.492 126.465C92.2852 126.465 82.4219 116.602 82.4219 104.395C82.4219 92.1875 92.2852 82.3242 104.492 82.3242C116.699 82.3242 126.562 92.1875 126.562 104.395C126.562 116.602 116.699 126.465 104.492 126.465Z" fill="currentColor" fillOpacity="0.85"/>
            </g>
            <defs>
              <clipPath id="clip0_995_232">
                <rect width="208.984" height="208.887" fill="white"/>
              </clipPath>
            </defs>
          </svg>
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
                  <div className="settings-mesh-container">
                    <div 
                      className="settings-mesh-preview"
                      style={{ borderColor: selectedGradient.overlayColor }}
                    >
                      {selectedGradient.type === 'mesh' ? (
                        <MeshGradient 
                          speed={selectedGradient.speed} 
                          distortion={selectedGradient.distortion} 
                          swirl={selectedGradient.swirl} 
                          frame={selectedGradient.frame} 
                          grainMixer={selectedGradient.grainMixer} 
                          grainOverlay={selectedGradient.grainOverlay} 
                          colors={selectedGradient.colors} 
                          style={{ 
                            width: '256px', 
                            height: '360px', 
                            opacity: 1, 
                            borderRadius: 0,
                            transformOrigin: 'center center',
                            rotate: selectedGradient.rotate
                          }} 
                        />
                      ) : (
                        <Dithering
                          speed={selectedGradient.speed}
                          shape={selectedGradient.shape}
                          type={selectedGradient.ditherType}
                          pxSize={selectedGradient.pxSize}
                          scale={selectedGradient.scale}
                          frame={selectedGradient.frame}
                          size={selectedGradient.size}
                          colorFront={selectedGradient.colorFront}
                          style={{
                            width: '256px',
                            height: '360px',
                            borderRadius: 0,
                            transformOrigin: 'center center',
                            rotate: '0deg',
                            backgroundColor: selectedGradient.backgroundColor || undefined
                          }}
                        />
                      )}
                      <div 
                        className="settings-mesh-overlay"
                        style={{ backgroundColor: selectedGradient.overlayColor }}
                      >
                        {githubUsername && (
                          <>
                            <div 
                              className="settings-mesh-username"
                              style={{ color: overlayTextColor }}
                            >
                              @{githubUsername}
                            </div>
                            <div 
                              className="settings-mesh-subtitle"
                              style={{ color: overlayTextColor }}
                            >
                              Agent Whisperer
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="settings-mesh-welcome">
                      <div className="settings-mesh-welcome-title">Welcome back to Agent Base!</div>
                      <div className="settings-mesh-shortcuts">
                        <div className="settings-mesh-shortcut-item">
                          <span className="settings-mesh-shortcut-label">New Agent</span>
                          <span className="settings-mesh-shortcut-key">
                            {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl'} T
                          </span>
                        </div>
                        <div className="settings-mesh-shortcut-item">
                          <span className="settings-mesh-shortcut-label">New Terminal</span>
                          <span className="settings-mesh-shortcut-key">
                            {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl'} K V
                          </span>
                        </div>
                        <div className="settings-mesh-shortcut-item">
                          <span className="settings-mesh-shortcut-label">New Claude Code Terminal</span>
                          <span className="settings-mesh-shortcut-key">
                            {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl'} K B
                          </span>
                        </div>
                        <div className="settings-mesh-shortcut-item">
                          <span className="settings-mesh-shortcut-label">New Forked Agent</span>
                          <span className="settings-mesh-shortcut-key">
                            {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl'} G
                          </span>
                        </div>
                        <div className="settings-mesh-shortcut-item">
                          <span className="settings-mesh-shortcut-label">Fork Existing Agent</span>
                          <span className="settings-mesh-shortcut-key">
                            {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl'} F
                          </span>
                        </div>
                        <div className="settings-mesh-shortcut-item">
                          <span className="settings-mesh-shortcut-label">Node Drag Mode</span>
                          <span className="settings-mesh-shortcut-key">
                            {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? 'Hold ⌘' : 'Hold Ctrl'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="settings-section">
                  <h3>Appearance</h3>
                  <div className="settings-item">
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
                  <div className="integration-header">
                    <div className="integration-info">
                      <span className="integration-name">Linear Integration</span>
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

        {/* Linear Issue Details Modal */}
        {selectedIssueId && (
          <IssueDetailsModal
            issueId={selectedIssueId}
            onClose={() => setSelectedIssueId(null)}
          />
        )}
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

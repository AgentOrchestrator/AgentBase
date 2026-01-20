/**
 * Canvas Component
 *
 * Main canvas view with ReactFlow for node-based agent orchestration.
 * Uses feature-based components for Sidebar, Settings, and Canvas controls.
 */
import {
  addEdge,
  Background,
  BackgroundVariant,
  type Connection,
  type Edge,
  type Node,
  type OnConnectStartParams,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useUpdateNodeInternals,
} from '@xyflow/react';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import '@xyflow/react/dist/style.css';
import ForkGhostNode from './ForkGhostNode';
import IssueDetailsModal from './IssueDetailsModal';
import './Canvas.css';
import type { AgentNodeData } from '@agent-orchestrator/shared';
import { createDefaultAgentTitle } from '@agent-orchestrator/shared';
import { ActionPill } from './components/ActionPill';
import AssistantMessageNode from './components/AssistantMessageNode';
import { type CommandAction, CommandPalette } from './components/CommandPalette';
import ConversationNode from './components/ConversationNode';
import { NewAgentModal } from './components/NewAgentModal';
import UserMessageNode from './components/UserMessageNode';
import { useTheme } from './context';
import {
  // Canvas controls
  ContextMenu,
  FloatingActionButtons,
  ForkErrorToast,
  SaveIndicator,
  // Settings
  SettingsModal,
  // Sidebar-related
  Sidebar,
  SidebarExpandButton,
  ZoomControls,
} from './features';
import { NodeActionsProvider } from './features/canvas/context';
import { useNodeOperations } from './features/canvas/hooks/useNodeOperations';
import {
  useAgentHierarchy,
  useAutoFork,
  useCanvasActions,
  useCanvasDrop,
  useCanvasPersistenceStore,
  useCanvasUIState,
  useContextMenu,
  useFolderHighlight,
  useFolderLock,
  useForkModal,
  useGithubUser,
  useKeyboardModifiers,
  useLinear,
  useLinearPanel,
  usePendingAgent,
  usePillState,
  useSidebarState,
} from './hooks';
import { nodeRegistry } from './nodes/registry';
import { forkService } from './services';
import { forkStore, nodeStore } from './stores';
import { createLinearIssueAttachment } from './types/attachments';
import { getOptimalHandles, updateEdgesWithOptimalHandles } from './utils/edgeHandles';

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

const sanitizeEdges = (edges: Edge[], nodes: Node[]) => {
  const nodeIds = new Set(nodes.map((node) => node.id));

  return edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => {
      const nextEdge: Edge = {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        animated: edge.animated,
        style: edge.style,
        data: edge.data,
        ...(edge.sourceHandle && edge.sourceHandle !== 'null' && edge.sourceHandle !== ''
          ? { sourceHandle: edge.sourceHandle }
          : {}),
        ...(edge.targetHandle && edge.targetHandle !== 'null' && edge.targetHandle !== ''
          ? { targetHandle: edge.targetHandle }
          : {}),
      };
      return nextEdge;
    });
};

function CanvasFlow() {
  // =============================================================================
  // Core Hooks
  // =============================================================================

  const { theme, setTheme } = useTheme();
  const githubUser = useGithubUser();
  const canvasUI = useCanvasUIState();

  // Canvas Persistence Store (Zustand)
  const isCanvasLoading = useCanvasPersistenceStore((s) => s.isLoading);
  const isSaving = useCanvasPersistenceStore((s) => s.isSaving);
  const lastSavedAt = useCanvasPersistenceStore((s) => s.lastSavedAt);
  const initialNodes = useCanvasPersistenceStore((s) => s.initialNodes);
  const initialEdges = useCanvasPersistenceStore((s) => s.initialEdges);

  // Explicit initialization: restore canvas state on mount
  useEffect(() => {
    const { configure, restore } = useCanvasPersistenceStore.getState();
    configure({ debounceMs: 1000 });
    restore();
  }, []);

  // Explicit cleanup: flush pending saves on window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      useCanvasPersistenceStore.getState().flush();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      useCanvasPersistenceStore.getState().flush();
    };
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialNodes.length > 0 ? initialNodes : defaultNodes
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialEdges.length > 0 ? initialEdges : defaultEdges
  );

  // =============================================================================
  // Node Operations (declarative methods replacing setNodes)
  // =============================================================================

  const nodeOps = useNodeOperations({
    setNodes,
    onUserChange: (updatedNodes) => {
      useCanvasPersistenceStore.getState().persistNodes(updatedNodes);
    },
  });

  // =============================================================================
  // State Restoration
  // =============================================================================

  const restoreEdgesFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isCanvasLoading && !nodeOps.isInitialStateApplied()) {
      if (initialNodes.length > 0 || initialEdges.length > 0) {
        // Restore saved state - strip highlight styles that may have been persisted
        console.log('[Canvas] Restoring nodes from persistence:', initialNodes.length);
        const cleanedNodes = initialNodes.map((node) => {
          if (node.type !== 'agent' || !node.style) return node;
          const { boxShadow, borderRadius, ...restStyle } = node.style as Record<string, unknown>;
          return { ...node, style: restStyle };
        });
        const cleanedEdges = sanitizeEdges(initialEdges, cleanedNodes);
        nodeOps.restoreNodes(cleanedNodes);
        if (restoreEdgesFrameRef.current !== null) {
          cancelAnimationFrame(restoreEdgesFrameRef.current);
        }
        restoreEdgesFrameRef.current = requestAnimationFrame(() => {
          setEdges(cleanedEdges);
        });
      }
      // Mark as applied whether or not there was data to restore
      nodeOps.markInitialStateApplied();
    }
  }, [isCanvasLoading, initialNodes, initialEdges, nodeOps, setEdges]);

  // Sanitize edges on change
  useEffect(() => {
    if (!isCanvasLoading && edges.length > 0) {
      const sanitized = sanitizeEdges(edges, nodes);
      const hasChanges = sanitized.some((edge, index) => {
        const original = edges[index];
        return (
          edge.sourceHandle !== original.sourceHandle || edge.targetHandle !== original.targetHandle
        );
      });
      if (hasChanges) {
        setEdges(sanitized);
      }
    }
  }, [edges, nodes, isCanvasLoading, setEdges]);

  // Persist edges when they change (only after initial state is applied)
  const prevEdgesRef = useRef<Edge[]>(edges);

  useEffect(() => {
    // Skip persistence until initial state is applied
    if (!nodeOps.isInitialStateApplied()) {
      return;
    }
    // Skip if edges reference hasn't changed
    if (edges === prevEdgesRef.current) {
      return;
    }
    prevEdgesRef.current = edges;
    useCanvasPersistenceStore.getState().persistEdges(edges);
  }, [edges, nodeOps]);

  // =============================================================================
  // Action Pill Highlighting
  // =============================================================================

  useEffect(() => {
    const handleHighlightAgent = (event: Event) => {
      const customEvent = event as CustomEvent<{ agentId: string }>;
      const { agentId } = customEvent.detail;
      nodeOps.highlightAgentNode(agentId);
    };

    const handleUnhighlightAgent = () => {
      nodeOps.unhighlightAllAgentNodes();
    };

    window.addEventListener('action-pill:highlight-agent', handleHighlightAgent as EventListener);
    window.addEventListener(
      'action-pill:unhighlight-agent',
      handleUnhighlightAgent as EventListener
    );

    return () => {
      window.removeEventListener(
        'action-pill:highlight-agent',
        handleHighlightAgent as EventListener
      );
      window.removeEventListener(
        'action-pill:unhighlight-agent',
        handleUnhighlightAgent as EventListener
      );
    };
  }, [nodeOps.highlightAgentNode, nodeOps.unhighlightAllAgentNodes]);

  // =============================================================================
  // React Flow Utilities and Feature Hooks
  // =============================================================================

  const { screenToFlowPosition, getNodes, zoomIn, zoomOut } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  const contextMenuState = useContextMenu();
  const keyboardModifiers = useKeyboardModifiers();
  const autoForkState = useAutoFork();
  const pendingAgent = usePendingAgent();
  const linear = useLinear();
  const sidebar = useSidebarState();
  const linearPanel = useLinearPanel({
    sidebarWidth: sidebar.sidebarWidth,
    setSidebarWidth: sidebar.setSidebarWidth,
  });

  const { hierarchy: agentHierarchy, folderPathMap } = useAgentHierarchy(nodes, edges);
  const folderLock = useFolderLock(agentHierarchy, folderPathMap);
  const folderHighlight = useFolderHighlight(folderPathMap);

  const pill = usePillState(() => {
    linear.fetchIssues();
    linear.fetchProjects();
  });

  const forkModal = useForkModal({
    nodes,
    onNodeUpdate: (nodeId, data) => {
      // Fork modal only updates sessionId during auto-detection
      if (data.sessionId !== undefined) {
        nodeOps.updateNodeSessionId(nodeId, data.sessionId as string);
      }
    },
  });

  const canvasDrop = useCanvasDrop({
    screenToFlowPosition,
    setNodes,
    isPillExpanded: pill.isPillExpanded,
    collapsePill: pill.collapsePill,
    onOpenAgentModal: (position, linearIssue) => {
      pendingAgent.setPending(position, linearIssue);
      canvasUI.openNewAgentModal();
    },
  });

  const canvasActions = useCanvasActions({
    setNodes,
    contextMenu: contextMenuState.contextMenu,
    closeContextMenu: contextMenuState.closeContextMenu,
    lockedFolderPath: folderLock.lockedFolderPath,
    onShowAgentModal: (pos) => {
      pendingAgent.setPending(pos);
      canvasUI.openNewAgentModal();
    },
  });

  // =============================================================================
  // Computed Values
  // =============================================================================

  const hasAgents = useMemo(() => nodes.some((node) => node.type === 'agent'), [nodes]);

  // Apply highlight styles to nodes
  useEffect(() => {
    nodeOps.applyFolderHighlights(folderHighlight.highlightedFolders, folderHighlight.folderColors);
  }, [folderHighlight.highlightedFolders, folderHighlight.folderColors, nodeOps]);

  // =============================================================================
  // Node Store Sync
  // =============================================================================

  useEffect(() => {
    nodeStore.setNodes(nodes);
  }, [nodes]);

  // NOTE: update-node and delete-node event listeners have been removed.
  // Node updates are now handled via NodeActionsContext to prevent infinite loops.
  // Components should use useNodeActions() hook instead of dispatching events.

  // =============================================================================
  // Starter Node Handling
  // =============================================================================

  useEffect(() => {
    const handleStarterSubmit = (event: CustomEvent) => {
      const { nodeId, message } = event.detail;
      const starterNode = nodes.find((n) => n.id === nodeId);
      if (!starterNode) return;

      const electronAPI = (window as unknown as { electronAPI?: { getHomeDir: () => string } })
        .electronAPI;
      const workingDirectory = electronAPI?.getHomeDir() || '/';

      const terminalId = `terminal-${crypto.randomUUID()}`;
      const agentId = `agent-${Date.now()}`;
      const sessionId = crypto.randomUUID();
      const createdAt = Date.now();

      const agentNode: Node = {
        id: `node-${createdAt}`,
        type: 'agent',
        position: { x: starterNode.position.x, y: starterNode.position.y + 150 },
        data: {
          agentId,
          terminalId,
          agentType: 'claude_code',
          status: 'idle',
          title: {
            value: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
            isManuallySet: false,
          },
          summary: null,
          progress: null,
          initialPrompt: message,
          workingDirectory,
          sessionId,
          createdAt,
        },
        style: { width: 600 },
      };

      nodeOps.replaceNode(nodeId, agentNode);
    };

    window.addEventListener('starter-node-submit', handleStarterSubmit as EventListener);
    return () => {
      window.removeEventListener('starter-node-submit', handleStarterSubmit as EventListener);
    };
  }, [nodes, nodeOps]);

  // =============================================================================
  // ReactFlow Event Handlers
  // =============================================================================

  const onConnect = useCallback(
    (params: Connection) => {
      const cleanParams: Connection = {
        source: params.source,
        target: params.target,
        sourceHandle:
          params.sourceHandle && params.sourceHandle !== 'null' && params.sourceHandle !== ''
            ? params.sourceHandle
            : null,
        targetHandle:
          params.targetHandle && params.targetHandle !== 'null' && params.targetHandle !== ''
            ? params.targetHandle
            : null,
      };
      setEdges((eds) => addEdge(cleanParams, eds));
    },
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
        const clientX = 'clientX' in event ? event.clientX : (event.touches?.[0]?.clientX ?? 0);
        const clientY = 'clientY' in event ? event.clientY : (event.touches?.[0]?.clientY ?? 0);

        const position = screenToFlowPosition({ x: clientX, y: clientY });
        forkModal.open(state.sourceNodeId, position, undefined, true);
      }

      forkStore.cancelDrag();
    },
    [screenToFlowPosition, forkModal]
  );

  // =============================================================================
  // Chat Message Fork Event Handler
  // =============================================================================

  useEffect(() => {
    const handleChatMessageFork = async (event: Event) => {
      const customEvent = event as CustomEvent<{
        nodeId: string;
        selectedText: string;
        messageId?: string;
      }>;
      const { nodeId, selectedText, messageId } = customEvent.detail;

      const sourceNode = nodes.find((n) => n.id === nodeId);
      if (!sourceNode) return;

      const nodeWidth = (sourceNode.width as number) || (sourceNode.style?.width as number) || 600;
      const horizontalSpacing = 100;
      const forkPosition = {
        x: sourceNode.position.x + nodeWidth + horizontalSpacing,
        y: sourceNode.position.y,
      };

      if (!autoForkState.autoFork) {
        const randomDigits = Math.floor(10000 + Math.random() * 90000);
        const forkName = `fork-${randomDigits}`;
        const sourceNodeData = sourceNode.data as unknown as AgentNodeData;
        const workspacePath = sourceNodeData.workspacePath;

        if (!workspacePath) return;

        let sessionId = sourceNodeData.sessionId;
        if (!sessionId && workspacePath) {
          const latestSession = await forkService.getLatestSessionForWorkspace(
            sourceNodeData.agentType,
            workspacePath
          );
          if (latestSession) sessionId = latestSession.id;
        }

        if (!sessionId) return;

        const validation = forkService.validateForkRequest(sessionId, workspacePath);
        if (!validation.valid) return;

        try {
          const filterOptions = messageId ? { targetMessageId: messageId } : undefined;

          const result = await forkService.forkAgent({
            sourceAgentId: sourceNodeData.agentId,
            sessionId,
            agentType: sourceNodeData.agentType,
            forkTitle: forkName,
            repoPath: workspacePath,
            filterOptions,
            createWorktree: false,
          });

          if (!result.success) return;

          const newNodeId = `node-${Date.now()}`;
          const newAgentId = `agent-${crypto.randomUUID()}`;
          const newTerminalId = `terminal-${crypto.randomUUID()}`;

          const forkedData: AgentNodeData = {
            agentId: newAgentId,
            terminalId: newTerminalId,
            agentType: sourceNodeData.agentType,
            status: 'idle',
            statusInfo: undefined,
            title: createDefaultAgentTitle(forkName),
            summary: null,
            progress: null,
            activeView: sourceNodeData.activeView,
            sessionId: result.data.sessionInfo.id,
            parentSessionId: sessionId,
            workspacePath: workspacePath,
            gitInfo: sourceNodeData.gitInfo,
            attachments: sourceNodeData.attachments || [],
            forking: false,
            initialInputText: selectedText,
          };

          const forkedNode: Node = {
            id: newNodeId,
            type: sourceNode.type,
            position: forkPosition,
            data: forkedData as unknown as Record<string, unknown>,
            style: sourceNode.style,
          };

          const optimalHandles = getOptimalHandles(sourceNode, forkedNode);
          const newEdge: Edge = {
            id: `edge-${Date.now()}`,
            source: nodeId,
            target: newNodeId,
            sourceHandle: optimalHandles.sourceHandle,
            targetHandle: optimalHandles.targetHandle,
            type: 'default',
            animated: false,
            style: { stroke: '#4a5568', strokeWidth: 2 },
          };

          nodeOps.addNode(forkedNode);
          setEdges((eds) => [...eds, newEdge]);
        } catch (err) {
          console.error('[Canvas] Auto-fork error:', err);
        }
      } else {
        forkModal.open(nodeId, forkPosition, messageId, false, selectedText);
      }
    };

    window.addEventListener('chat-message-fork', handleChatMessageFork);
    return () => window.removeEventListener('chat-message-fork', handleChatMessageFork);
  }, [nodes, forkModal, autoForkState.autoFork, nodeOps, setEdges]);

  // =============================================================================
  // Create Chat Node Event Handler
  // =============================================================================

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

      const existingChatNode = nodes.find(
        (n) =>
          n.type === 'agent-chat' &&
          (n.data as { agentId?: string })?.agentId === agentId &&
          edges.some((e) => e.source === nodeId && e.target === n.id)
      );

      if (existingChatNode) {
        const edgeToRemove = edges.find(
          (e) => e.source === nodeId && e.target === existingChatNode.id
        );
        nodeOps.removeNode(existingChatNode.id);
        if (edgeToRemove) {
          setEdges((eds) => eds.filter((e) => e.id !== edgeToRemove.id));
        }
        return;
      }

      const sourceNode = nodes.find((n) => n.id === nodeId);
      if (!sourceNode) return;

      const nodeWidth = (sourceNode.width as number) || (sourceNode.style?.width as number) || 500;
      const nodeHeight =
        (sourceNode.height as number) || (sourceNode.style?.height as number) || 450;

      const chatNodePosition = {
        x: sourceNode.position.x,
        y: sourceNode.position.y + nodeHeight + 50,
      };

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
          agentId,
        },
        style: { width: nodeWidth, height: nodeHeight },
      };

      const borderColor =
        getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() ||
        '#232323';

      const edge: Edge = {
        id: `edge-${nodeId}-${chatNodeId}`,
        source: nodeId,
        target: chatNodeId,
        sourceHandle: 'source-bottom',
        targetHandle: 'chat-target',
        type: 'default',
        animated: false,
        style: { stroke: borderColor, strokeWidth: 2, strokeDasharray: '5, 5' },
      };

      nodeOps.addNode(chatNode);

      requestAnimationFrame(() => {
        updateNodeInternals(chatNodeId);
        updateNodeInternals(nodeId);
        requestAnimationFrame(() => {
          setEdges((eds) => {
            const currentNodes = getNodes();
            const sanitizedEdges = sanitizeEdges([...eds, edge], currentNodes);
            return sanitizedEdges;
          });
        });
      });
    };

    window.addEventListener('agent-node:create-chat-node', handleCreateChatNode as EventListener);
    return () => {
      window.removeEventListener(
        'agent-node:create-chat-node',
        handleCreateChatNode as EventListener
      );
    };
  }, [nodes, edges, nodeOps, setEdges, updateNodeInternals, getNodes]);

  // =============================================================================
  // Fork Modal Confirmation Handler
  // =============================================================================

  const handleForkConfirm = useCallback(
    async (data: {
      title: string;
      workspacePath: string;
      gitInfo: { branch?: string };
      createWorktree: boolean;
      branchName?: string;
    }) => {
      const result = await forkModal.confirm(data);
      if (result.success) {
        nodeOps.addNode(result.forkedNode);
        requestAnimationFrame(() => {
          updateNodeInternals(result.forkedNode.id);
          updateNodeInternals(result.newEdge.source);
          requestAnimationFrame(() => {
            setEdges((eds) => {
              const currentNodes = getNodes();
              const sanitizedEdges = sanitizeEdges([...eds, result.newEdge], currentNodes);
              return sanitizedEdges;
            });
          });
        });
      }
    },
    [forkModal, nodeOps, setEdges, updateNodeInternals, getNodes]
  );

  // =============================================================================
  // Keyboard Shortcuts
  // =============================================================================

  // Fork keyboard shortcut (Cmd+F)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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

      const currentNodes = getNodes();
      const selectedNode = currentNodes.find((n) => n.selected && n.type === 'agent');

      if (!selectedNode) return;

      const nodeHeight = 400;
      const verticalSpacing = 100;
      const forkPosition = {
        x: selectedNode.position?.x ?? 0,
        y: (selectedNode.position?.y ?? 0) + nodeHeight + verticalSpacing,
      };

      forkModal.open(selectedNode.id, forkPosition, undefined, true);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [getNodes, forkModal]);

  // Fork button click event
  useEffect(() => {
    const handleForkClick = (event: Event) => {
      const customEvent = event as CustomEvent<{ nodeId: string }>;
      const { nodeId } = customEvent.detail;

      const sourceNode = nodes.find((n) => n.id === nodeId);
      if (!sourceNode) return;

      const forkPosition = {
        x: (sourceNode.position?.x ?? 0) + 350,
        y: (sourceNode.position?.y ?? 0) + 50,
      };

      forkModal.open(nodeId, forkPosition, undefined, true);
    };

    window.addEventListener('agent-node:fork-click', handleForkClick as EventListener);
    return () =>
      window.removeEventListener('agent-node:fork-click', handleForkClick as EventListener);
  }, [nodes, forkModal]);

  // =============================================================================
  // Linear Ticket Creation
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
      alert(
        `Ticket created: ${result.issue.identifier} - ${result.issue.title}\n${result.issue.url}`
      );
    } else {
      alert(`Failed to create ticket: ${result.error || 'Unknown error'}`);
    }
  }, [linear]);

  // =============================================================================
  // Command Palette Commands
  // =============================================================================

  const commandActions = useMemo<CommandAction[]>(
    () => [
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
        id: 'add-browser',
        label: 'Add Browser',
        shortcut: 'j',
        action: () => canvasActions.addBrowserNode(),
      },
      {
        id: 'create-linear-ticket',
        label: 'Create Linear Ticket',
        shortcut: 'm',
        action: () => createLinearTicket(),
      },
    ],
    [canvasActions, createLinearTicket]
  );

  // =============================================================================
  // Main Keyboard Shortcuts
  // =============================================================================

  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    const handleKeyDown = (event: KeyboardEvent) => {
      const modifierKey = isMac ? event.metaKey : event.ctrlKey;

      if (modifierKey && event.key === 'k') {
        event.preventDefault();
        canvasUI.toggleCommandPalette();
        return;
      }

      if (modifierKey && event.key === 't') {
        event.preventDefault();
        if (canvasUI.isNewAgentModalOpen) {
          canvasUI.closeNewAgentModal();
          pendingAgent.clearPending();
        } else {
          canvasActions.addAgentNode();
        }
        return;
      }

      if (modifierKey && event.key === 'g') {
        event.preventDefault();
        if (!canvasUI.isNewAgentModalOpen) {
          pendingAgent.setAutoCreateWorktree(true);
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
        if (!keyboardModifiers.isNodeDragEnabled) {
          keyboardModifiers.enableNodeDrag();
        }
      }

      if (event.key === 'Shift') {
        keyboardModifiers.setShiftPressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      if ((isMac && event.key === 'Meta') || (!isMac && event.key === 'Control')) {
        keyboardModifiers.disableNodeDrag();
      }
      if (event.key === 'Shift') {
        keyboardModifiers.setShiftPressed(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    canvasActions,
    keyboardModifiers,
    canvasUI.isNewAgentModalOpen,
    canvasUI.closeNewAgentModal,
    canvasUI.toggleCommandPalette,
    pendingAgent.clearPending,
    pendingAgent.setAutoCreateWorktree,
  ]);

  // =============================================================================
  // Node Snapping
  // =============================================================================

  const SNAP_THRESHOLD = 20;
  const isSnappingRef = useRef(false);

  const applySnapping = useCallback((node: Node, allNodes: Node[]) => {
    const otherNodes = allNodes.filter((n) => n.id !== node.id);
    if (otherNodes.length === 0) return null;

    const currentNodeWidth = (node.width as number) || (node.style?.width as number) || 500;
    const currentNodeHeight = (node.height as number) || (node.style?.height as number) || 400;

    const currentNodeLeft = node.position.x;
    const currentNodeRight = node.position.x + currentNodeWidth;
    const currentNodeTop = node.position.y;
    const currentNodeBottom = node.position.y + currentNodeHeight;

    let snappedX = node.position.x;
    let snappedY = node.position.y;
    let minDistanceX = SNAP_THRESHOLD;
    let minDistanceY = SNAP_THRESHOLD;

    for (const otherNode of otherNodes) {
      const otherNodeWidth =
        (otherNode.width as number) || (otherNode.style?.width as number) || 500;
      const otherNodeHeight =
        (otherNode.height as number) || (otherNode.style?.height as number) || 400;

      const otherNodeLeft = otherNode.position.x;
      const otherNodeRight = otherNode.position.x + otherNodeWidth;
      const otherNodeTop = otherNode.position.y;
      const otherNodeBottom = otherNode.position.y + otherNodeHeight;

      const horizontalDistances = [
        { distance: Math.abs(currentNodeLeft - otherNodeLeft), snap: otherNodeLeft },
        {
          distance: Math.abs(currentNodeRight - otherNodeRight),
          snap: otherNodeRight - currentNodeWidth,
        },
        { distance: Math.abs(currentNodeLeft - otherNodeRight), snap: otherNodeRight },
        {
          distance: Math.abs(currentNodeRight - otherNodeLeft),
          snap: otherNodeLeft - currentNodeWidth,
        },
      ];

      for (const { distance, snap } of horizontalDistances) {
        if (distance < minDistanceX) {
          minDistanceX = distance;
          snappedX = snap;
        }
      }

      const verticalDistances = [
        { distance: Math.abs(currentNodeTop - otherNodeTop), snap: otherNodeTop },
        {
          distance: Math.abs(currentNodeBottom - otherNodeBottom),
          snap: otherNodeBottom - currentNodeHeight,
        },
        { distance: Math.abs(currentNodeTop - otherNodeBottom), snap: otherNodeBottom },
        {
          distance: Math.abs(currentNodeBottom - otherNodeTop),
          snap: otherNodeTop - currentNodeHeight,
        },
      ];

      for (const { distance, snap } of verticalDistances) {
        if (distance < minDistanceY) {
          minDistanceY = distance;
          snappedY = snap;
        }
      }
    }

    if (minDistanceX < SNAP_THRESHOLD || minDistanceY < SNAP_THRESHOLD) {
      return {
        x: minDistanceX < SNAP_THRESHOLD ? snappedX : node.position.x,
        y: minDistanceY < SNAP_THRESHOLD ? snappedY : node.position.y,
      };
    }

    return null;
  }, []);

  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!keyboardModifiers.isNodeDragEnabled || isSnappingRef.current) return;

      const allNodes = getNodes();
      const snappedPosition = applySnapping(node, allNodes);

      if (snappedPosition) {
        isSnappingRef.current = true;
        nodeOps.updateNodePosition(node.id, snappedPosition);
        setTimeout(() => {
          isSnappingRef.current = false;
        }, 10);
      }
    },
    [keyboardModifiers.isNodeDragEnabled, getNodes, nodeOps, applySnapping]
  );

  const onNodeDragStop = useCallback(() => {
    isSnappingRef.current = false;
  }, []);

  const handleNodesChange = useCallback(
    (changes: unknown[]) => {
      if (!keyboardModifiers.isNodeDragEnabled || isSnappingRef.current) {
        onNodesChange(changes as Parameters<typeof onNodesChange>[0]);
        return;
      }

      const allNodes = getNodes();
      const modifiedChanges = changes.map((change) => {
        const posChange = change as {
          type?: string;
          position?: { x: number; y: number };
          id?: string;
        };
        if (posChange.type === 'position' && posChange.position) {
          const node = allNodes.find((n) => n.id === posChange.id);
          if (node) {
            const tempNode = { ...node, position: posChange.position };
            const snappedPosition = applySnapping(tempNode, allNodes);
            if (snappedPosition) {
              return { ...posChange, position: snappedPosition };
            }
          }
        }
        return change;
      });

      const hasSnapping = modifiedChanges.some((change, index) => change !== changes[index]);

      if (hasSnapping) {
        isSnappingRef.current = true;
        onNodesChange(modifiedChanges as Parameters<typeof onNodesChange>[0]);
        setTimeout(() => {
          isSnappingRef.current = false;
        }, 10);
      } else {
        onNodesChange(changes as Parameters<typeof onNodesChange>[0]);
      }

      const hasPositionChanges = changes.some((change) => {
        const posChange = change as { type?: string };
        return posChange.type === 'position';
      });

      if (hasPositionChanges) {
        const updatedNodes = allNodes.map((node) => {
          const change = modifiedChanges.find((c) => {
            const posChange = c as { id?: string; position?: { x: number; y: number } };
            return posChange.id === node.id && posChange.position;
          }) as { id?: string; position?: { x: number; y: number } } | undefined;

          if (change?.position) {
            return { ...node, position: change.position };
          }
          return node;
        });

        setEdges((currentEdges) => updateEdgesWithOptimalHandles(currentEdges, updatedNodes));
      }
    },
    [onNodesChange, keyboardModifiers.isNodeDragEnabled, getNodes, applySnapping, setEdges]
  );

  // =============================================================================
  // Node Actions Callback (for context persistence)
  // =============================================================================

  const handleNodeActionsChange = useCallback((updatedNodes: Node[]) => {
    // Sync to nodeStore for compatibility
    nodeStore.setNodes(updatedNodes);
    // Trigger persistence
    useCanvasPersistenceStore.getState().persistNodes(updatedNodes);
  }, []);

  // =============================================================================
  // Loading State
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
    <NodeActionsProvider onNodesChange={handleNodeActionsChange}>
      <div
        className={`canvas-container ${keyboardModifiers.isNodeDragEnabled ? 'drag-mode' : ''} ${linearPanel.isResizing ? 'resizing' : ''}`}
      >
        {/* Command Palette */}
        <CommandPalette
          isOpen={canvasUI.isCommandPaletteOpen}
          onClose={canvasUI.closeCommandPalette}
          commands={commandActions}
        />

        {/* New Agent Modal */}
        <NewAgentModal
          isOpen={canvasUI.isNewAgentModalOpen}
          onClose={() => {
            canvasUI.closeNewAgentModal();
            pendingAgent.clearPending();
          }}
          onCreate={(data) => {
            canvasActions.createAgentWithData({
              position: pendingAgent.pendingPosition,
              gitInfo: data.gitInfo,
              modalData: {
                title: data.title,
                description: data.description,
                workspacePath: data.workspacePath,
              },
              lockedFolderPath: data.workspacePath || folderLock.lockedFolderPath,
              initialAttachments: pendingAgent.pendingLinearIssue
                ? [
                    createLinearIssueAttachment({
                      id: pendingAgent.pendingLinearIssue.id,
                      identifier: pendingAgent.pendingLinearIssue.identifier,
                      title: pendingAgent.pendingLinearIssue.title,
                      state: {
                        name: pendingAgent.pendingLinearIssue.state.name,
                        color: pendingAgent.pendingLinearIssue.state.color,
                      },
                      assignee: pendingAgent.pendingLinearIssue.assignee,
                    }),
                  ]
                : undefined,
            });
            canvasUI.closeNewAgentModal();
            pendingAgent.clearPending();
          }}
          initialPosition={pendingAgent.pendingPosition}
          initialWorkspacePath={folderLock.lockedFolderPath}
          autoCreateWorktree={pendingAgent.autoCreateWorktree}
          initialDescription={
            pendingAgent.pendingLinearIssue
              ? pendingAgent.pendingLinearIssue.description
                ? `${pendingAgent.pendingLinearIssue.title}\n\n${pendingAgent.pendingLinearIssue.description}`
                : pendingAgent.pendingLinearIssue.title
              : undefined
          }
        />

        {/* Sidebar Feature Component */}
        <Sidebar
          sidebar={sidebar}
          githubUser={githubUser}
          agentHierarchy={agentHierarchy}
          folderPathMap={folderPathMap}
          folderLock={folderLock}
          folderHighlight={folderHighlight}
          linear={linear}
          linearPanel={linearPanel}
          hasAgents={hasAgents}
          onIssueDragStart={canvasDrop.handleIssueDragStart}
          onIssueClick={(issueId) => canvasUI.setSelectedIssueId(issueId)}
        />

        {/* Canvas Content */}
        <div className={`canvas-content ${sidebar.isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          {/* Expand button when sidebar is collapsed */}
          {sidebar.isSidebarCollapsed && <SidebarExpandButton onClick={sidebar.toggleSidebar} />}

          {/* Save status indicator */}
          <SaveIndicator isSaving={isSaving} lastSavedAt={lastSavedAt} />

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
            onPaneContextMenu={contextMenuState.onPaneContextMenu}
            onPaneClick={contextMenuState.onPaneClick}
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
            panOnDrag={keyboardModifiers.isNodeDragEnabled}
            zoomOnPinch={true}
            nodesDraggable={keyboardModifiers.isNodeDragEnabled}
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
          {forkModal.isOpen && forkModal.modalData && (
            <NewAgentModal
              isOpen={true}
              onClose={forkModal.cancel}
              onCreate={() => {}}
              initialWorkspacePath={forkModal.modalData.workspacePath}
              isForkMode={true}
              forkData={{
                parentSessionId: forkModal.modalData.sessionId,
                parentBranch: forkModal.modalData.parentBranch,
                targetMessageId: forkModal.modalData.targetMessageId,
                originalTargetMessageId: forkModal.modalData.originalTargetMessageId,
                createWorktree: forkModal.modalData.createWorktree,
              }}
              messages={forkModal.messages}
              isLoadingMessages={forkModal.isLoadingMessages}
              onLoadMessages={forkModal.loadMessages}
              cutoffMessageId={forkModal.cutoffMessageId}
              onCutoffChange={forkModal.setCutoffMessageId}
              onForkConfirm={handleForkConfirm}
            />
          )}

          {/* Fork Error Toast */}
          <ForkErrorToast
            error={forkModal.error}
            isModalOpen={forkModal.isOpen}
            onDismiss={forkModal.clearError}
          />

          {/* Context Menu */}
          <ContextMenu contextMenuState={contextMenuState} canvasActions={canvasActions} />

          {/* Floating Action Buttons (Highlight All, Settings) */}
          <FloatingActionButtons
            folderHighlight={folderHighlight}
            onOpenSettings={canvasUI.openSettings}
          />

          {/* Zoom Controls */}
          <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} />

          {/* Settings Modal */}
          <SettingsModal
            isOpen={canvasUI.isSettingsOpen}
            onClose={canvasUI.closeSettings}
            githubUsername={githubUser.username}
            theme={theme}
            onThemeChange={setTheme}
            linear={linear}
            autoForkState={autoForkState}
          />

          {/* Action Pill */}
          <ActionPill />

          {/* Linear Issue Details Modal */}
          {canvasUI.selectedIssueId && (
            <IssueDetailsModal
              issueId={canvasUI.selectedIssueId}
              onClose={() => canvasUI.setSelectedIssueId(null)}
            />
          )}
        </div>
      </div>
    </NodeActionsProvider>
  );
}

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasFlow />
    </ReactFlowProvider>
  );
}

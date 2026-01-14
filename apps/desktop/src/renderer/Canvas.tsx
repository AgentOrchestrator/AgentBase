import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  MiniMap,
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
import { forkStore } from './stores';
import { forkService } from './services';
import { createDefaultAgentTitle } from './types/agent-node';
import type { AgentNodeData } from './types/agent-node';
import {
  createLinearIssueAttachment,
  createWorkspaceMetadataAttachment,
  isWorkspaceMetadataAttachment,
} from './types/attachments';
import { useCanvasPersistence } from './hooks';
import { nodeRegistry } from './nodes/registry';

// Use node types from the registry (single source of truth)
const nodeTypes = nodeRegistry.reactFlowNodeTypes;

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

  // Fork modal state
  const [forkModalData, setForkModalData] = useState<{
    sourceNodeId: string;
    position: { x: number; y: number };
  } | null>(null);
  const [isForkLoading, setIsForkLoading] = useState(false);
  const [forkError, setForkError] = useState<string | null>(null);

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

  // Fork handling: track when user starts dragging from a handle
  const onConnectStart = useCallback(
    (_event: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
      if (params.nodeId && params.handleType) {
        forkStore.startDrag(params.nodeId, params.handleType);
      }
    },
    []
  );

  // Validate and show fork modal (defined before onConnectEnd to avoid hoisting issues)
  const handleForkCreate = useCallback(
    async (sourceNodeId: string, position: { x: number; y: number }) => {
      // Find the source node
      const sourceNode = nodes.find((n) => n.id === sourceNodeId);
      if (!sourceNode) {
        console.error('[Canvas] Source node not found for fork:', sourceNodeId);
        return;
      }

      const sourceData = sourceNode.data as AgentNodeData;

      // Get workspace path from attachments
      const workspaceAttachment = sourceData.attachments?.find(isWorkspaceMetadataAttachment);
      const workspacePath = workspaceAttachment?.path || sourceData.workingDirectory;

      // Log the source data for debugging
      console.log('[Canvas] Fork attempt - sourceData:', {
        agentId: sourceData.agentId,
        agentType: sourceData.agentType,
        sessionId: sourceData.sessionId,
        workspacePath,
        attachments: sourceData.attachments?.length ?? 0,
      });

      // Auto-detect session if not set
      let sessionId = sourceData.sessionId;
      if (!sessionId && workspacePath) {
        console.log('[Canvas] Session not set, auto-detecting from workspace...');
        const latestSession = await forkService.getLatestSessionForWorkspace(
          sourceData.agentType,
          workspacePath
        );
        if (latestSession) {
          sessionId = latestSession.id;
          console.log('[Canvas] Auto-detected session:', sessionId);

          // Update the node with the detected sessionId
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id === sourceNodeId) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    sessionId,
                  },
                };
              }
              return n;
            })
          );
        }
      }

      // Validate requirements
      const validation = forkService.validateForkRequest(sessionId, workspacePath);
      if (!validation.valid) {
        // Show error as a toast-like notification
        console.warn('[Canvas] Fork validation failed:', validation.error);
        setForkError(validation.error);
        // Auto-dismiss error after 5 seconds
        setTimeout(() => setForkError(null), 5000);
        return;
      }

      // Show fork modal
      setForkModalData({ sourceNodeId, position });
      setForkError(null);
    },
    [nodes, setNodes]
  );

  // Handle fork modal confirmation
  const handleForkConfirm = useCallback(
    async (forkTitle: string) => {
      if (!forkModalData) return;

      const sourceNode = nodes.find((n) => n.id === forkModalData.sourceNodeId);
      if (!sourceNode) {
        setForkError('Source node not found');
        return;
      }

      const sourceData = sourceNode.data as AgentNodeData;
      const workspaceAttachment = sourceData.attachments?.find(isWorkspaceMetadataAttachment);
      const workspacePath = workspaceAttachment?.path || sourceData.workingDirectory;

      if (!sourceData.sessionId || !workspacePath) {
        setForkError('Missing session or workspace');
        return;
      }

      setIsForkLoading(true);
      setForkError(null);

      try {
        // Call fork service to create worktree and fork session
        const result = await forkService.forkAgent({
          sourceAgentId: sourceData.agentId,
          parentSessionId: sourceData.sessionId,
          agentType: sourceData.agentType,
          forkTitle,
          repoPath: workspacePath,
        });

        if (!result.success) {
          setForkError(result.error.message);
          setIsForkLoading(false);
          return;
        }

        // Generate new IDs for the forked node
        const newNodeId = `node-${Date.now()}`;
        const newAgentId = `agent-${crypto.randomUUID()}`;
        const newTerminalId = `terminal-${crypto.randomUUID()}`;

        // Create forked node data with new session and worktree info
        const forkedData: AgentNodeData = {
          ...sourceData,
          agentId: newAgentId,
          terminalId: newTerminalId,
          title: createDefaultAgentTitle(forkTitle),
          sessionId: result.data.sessionInfo.id,
          parentSessionId: sourceData.sessionId,
          worktreeId: result.data.worktreeInfo.id,
          workingDirectory: result.data.worktreeInfo.worktreePath,
          // Update attachments to reflect new workspace
          attachments: [
            ...(sourceData.attachments?.filter((a) => !isWorkspaceMetadataAttachment(a)) || []),
            createWorkspaceMetadataAttachment({
              path: result.data.worktreeInfo.worktreePath,
              name: forkTitle,
            }),
          ],
        };

        // Create the new forked node
        const forkedNode: Node = {
          id: newNodeId,
          type: sourceNode.type,
          position: forkModalData.position,
          data: forkedData,
          style: sourceNode.style,
        };

        // Create edge from source to forked node
        const newEdgeId = `edge-${Date.now()}`;
        const newEdge: Edge = {
          id: newEdgeId,
          source: forkModalData.sourceNodeId,
          target: newNodeId,
          sourceHandle: null,
          targetHandle: null,
        };

        // Add the new node and edge
        setNodes((nds) => [...nds, forkedNode]);
        setEdges((eds) => [...eds, newEdge]);

        console.log('[Canvas] Fork created successfully:', {
          newNodeId,
          sessionId: result.data.sessionInfo.id,
          worktreePath: result.data.worktreeInfo.worktreePath,
        });

        // Close modal
        setForkModalData(null);
      } catch (error) {
        console.error('[Canvas] Fork failed:', error);
        setForkError(error instanceof Error ? error.message : 'Fork failed');
      } finally {
        setIsForkLoading(false);
      }
    },
    [forkModalData, nodes, setNodes, setEdges]
  );

  // Handle fork modal cancellation
  const handleForkCancel = useCallback(() => {
    setForkModalData(null);
    setForkError(null);
    setIsForkLoading(false);
  }, []);

  // Fork handling: detect when drag ends on empty canvas (not on a handle)
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const state = forkStore.getState();

      if (!state.isDragging || !state.sourceNodeId) {
        forkStore.cancelDrag();
        return;
      }

      // Check if the drop target is a handle (normal connection) or empty canvas (fork)
      const target = event.target as HTMLElement;
      const isDropOnHandle = target.classList.contains('react-flow__handle');

      if (!isDropOnHandle) {
        // Dropped on canvas - create fork
        const clientX = 'clientX' in event ? event.clientX : event.touches?.[0]?.clientX ?? 0;
        const clientY = 'clientY' in event ? event.clientY : event.touches?.[0]?.clientY ?? 0;

        const position = screenToFlowPosition({ x: clientX, y: clientY });
        handleForkCreate(state.sourceNodeId, position);
      }

      forkStore.cancelDrag();
    },
    [screenToFlowPosition, handleForkCreate]
  );

  // Keyboard shortcut: Shift+Cmd+S (Mac) / Shift+Ctrl+S (Windows/Linux) to fork selected node
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Shift+Cmd+S (Mac) or Shift+Ctrl+S (Windows/Linux)
      const isForkShortcut =
        event.shiftKey &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 's';

      if (!isForkShortcut) return;

      event.preventDefault();

      // Find selected AgentNode
      const selectedNode = nodes.find(
        (n) => n.selected && n.type === 'agentNode'
      );

      if (!selectedNode) {
        console.log('[Canvas] No AgentNode selected for fork shortcut');
        setForkError('Select an agent node to fork');
        setTimeout(() => setForkError(null), 3000);
        return;
      }

      // Calculate position for the forked node (offset to the right)
      const forkPosition = {
        x: (selectedNode.position?.x ?? 0) + 350,
        y: (selectedNode.position?.y ?? 0) + 50,
      };

      console.log('[Canvas] Fork shortcut triggered for node:', selectedNode.id);
      handleForkCreate(selectedNode.id, forkPosition);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, handleForkCreate]);

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

    // Always generate unique IDs for each new node
    const agentId = `agent-${crypto.randomUUID()}`;
    const terminalId = `terminal-${crypto.randomUUID()}`;

    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'agent',
      position: nodePosition,
      data: {
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
        nodesConnectable={true}
        elementsSelectable={true}
        nodesFocusable={true}
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <ForkGhostNode />
      </ReactFlow>

      {/* Fork Session Modal */}
      {forkModalData && (
        <ForkSessionModal
          onConfirm={handleForkConfirm}
          onCancel={handleForkCancel}
          isLoading={isForkLoading}
          error={forkError}
        />
      )}

      {/* Fork Error Toast (shown when validation fails outside modal) */}
      {forkError && !forkModalData && (
        <div className="fork-error-toast">
          <span className="fork-error-icon">!</span>
          <span className="fork-error-message">{forkError}</span>
          <button
            className="fork-error-dismiss"
            onClick={() => setForkError(null)}
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

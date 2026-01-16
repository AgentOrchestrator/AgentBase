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
import { forkStore } from './stores';
import { forkService } from './services';
import { createDefaultAgentTitle, type AgentNodeData } from './types/agent-node';
import {
  type TerminalAttachment,
  createLinearIssueAttachment,
  createWorkspaceMetadataAttachment,
  isWorkspaceMetadataAttachment,
} from './types/attachments';
import { useCanvasPersistence } from './hooks';
import { nodeRegistry } from './nodes/registry';
import UserMessageNode from './components/UserMessageNode';
import AssistantMessageNode from './components/AssistantMessageNode';
import ConversationNode from './components/ConversationNode';
import { CommandPalette, type CommandAction } from './components/CommandPalette';
import { NewAgentModal } from './components/NewAgentModal';
import { ActionPill } from './components/ActionPill';
import { useTheme } from './context';
import type { CodingAgentMessage } from '@agent-orchestrator/shared';

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

type SessionSyncPayload = {
  sessionId?: string;
  agentType?: string;
  attachments?: TerminalAttachment[];
  chatMessages?: CodingAgentMessage[];
  workspacePath?: string;
  status?: AgentNodeData['status'];
  statusInfo?: AgentNodeData['statusInfo'];
  summary?: AgentNodeData['summary'];
  progress?: AgentNodeData['progress'];
  titleValue?: string;
  titleObject?: AgentNodeData['title'];
};

const isAgentTitle = (value: unknown): value is AgentNodeData['title'] => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return 'value' in value && 'isManuallySet' in value;
};

const buildSessionSyncPayload = (data: Record<string, unknown>): SessionSyncPayload => {
  const payload: SessionSyncPayload = {};

  if ('sessionId' in data && typeof data.sessionId === 'string') {
    payload.sessionId = data.sessionId;
  }

  if ('agentType' in data && typeof data.agentType === 'string') {
    payload.agentType = data.agentType;
  }

  if ('attachments' in data) {
    payload.attachments = data.attachments as TerminalAttachment[] | undefined;
  }

  if ('chatMessages' in data || 'messages' in data) {
    payload.chatMessages = (data.chatMessages ?? data.messages) as CodingAgentMessage[] | undefined;
  }

  if ('workspacePath' in data && typeof data.workspacePath === 'string') {
    payload.workspacePath = data.workspacePath;
  }

  if ('status' in data) {
    payload.status = data.status as AgentNodeData['status'];
  }

  if ('statusInfo' in data) {
    payload.statusInfo = data.statusInfo as AgentNodeData['statusInfo'];
  }

  if ('summary' in data) {
    payload.summary = data.summary as AgentNodeData['summary'];
  }

  if ('progress' in data) {
    payload.progress = data.progress as AgentNodeData['progress'];
  }

  if ('title' in data) {
    const titleValue = data.title;
    if (isAgentTitle(titleValue)) {
      payload.titleObject = titleValue;
      payload.titleValue = titleValue.value;
    } else if (typeof titleValue === 'string') {
      payload.titleValue = titleValue;
    }
  }

  if (!payload.workspacePath && payload.attachments) {
    const workspaceAttachment = payload.attachments.find(isWorkspaceMetadataAttachment);
    if (workspaceAttachment?.path) {
      payload.workspacePath = workspaceAttachment.path;
    }
  }

  return payload;
};

const applySessionSync = (node: Node, payload: SessionSyncPayload): Node => {
  const data = node.data as Record<string, unknown>;
  let nextData = data;

  const updateField = (key: string, value: unknown) => {
    if (value === undefined || (nextData as Record<string, unknown>)[key] === value) {
      return;
    }
    if (nextData === data) {
      nextData = { ...data };
    }
    (nextData as Record<string, unknown>)[key] = value;
  };

  switch (node.type) {
    case 'agent': {
      updateField('sessionId', payload.sessionId);
      updateField('agentType', payload.agentType);
      updateField('attachments', payload.attachments);
      updateField('chatMessages', payload.chatMessages);
      updateField('status', payload.status);
      updateField('statusInfo', payload.statusInfo);
      updateField('summary', payload.summary);
      updateField('progress', payload.progress);
      if (payload.titleObject) {
        updateField('title', payload.titleObject);
      }
      break;
    }
    case 'agent-chat': {
      updateField('sessionId', payload.sessionId);
      updateField('agentType', payload.agentType);
      updateField('workspacePath', payload.workspacePath);
      updateField('messages', payload.chatMessages);
      updateField('title', payload.titleValue);
      if (payload.sessionId && (nextData as Record<string, unknown>).isDraft === true) {
        updateField('isDraft', false);
      }
      break;
    }
    default:
      break;
  }

  if (nextData === data) {
    return node;
  }

  return {
    ...node,
    data: nextData,
  };
};

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
    if (!isCanvasLoading) {
      if (!initialStateApplied.current && (initialNodes.length > 0 || initialEdges.length > 0)) {
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

  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getEdges, getNodes } = useReactFlow();
  const [isNodeDragEnabled, setIsNodeDragEnabled] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSessionPickerOpen, setIsSessionPickerOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNewAgentModalOpen, setIsNewAgentModalOpen] = useState(false);
  const [autoCreateWorktree, setAutoCreateWorktree] = useState(false);
  const [pendingAgentPosition, setPendingAgentPosition] = useState<{ x: number; y: number } | undefined>(undefined);
  const [linearApiKey, setLinearApiKey] = useState('');
  const [isLinearConnected, setIsLinearConnected] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isResizing, setIsResizing] = useState(false);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(new Set());
  const [isLinearCollapsed, setIsLinearCollapsed] = useState(false);
  const [workspaceGitInfo, setWorkspaceGitInfo] = useState<Record<string, { branch: string | null }>>({});
  const [lockedFolderPath, setLockedFolderPath] = useState<string | null>(null);
  const [hoveredFolderPath, setHoveredFolderPath] = useState<string | null>(null);
  // Track if user has explicitly unlocked to prevent auto-lock from re-locking
  const hasExplicitlyUnlocked = useRef<boolean>(false);
  // Track highlighted folders (eye icon clicked) and their assigned colors
  const [highlightedFolders, setHighlightedFolders] = useState<Set<string>>(new Set());
  const [folderColors, setFolderColors] = useState<Map<string, string>>(new Map());
  const [isHighlightAllActive, setIsHighlightAllActive] = useState(false);
  
  // Available colors for highlighting
  const highlightColors = ['#F24F1F', '#FF7362', '#A259FF', '#1ABCFE', '#0ECF84', '#F5C348'];

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
    sessionId: string;
    workspacePath: string;
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
      setNodes((nds) => {
        const targetNode = nds.find((node) => node.id === nodeId);
        if (!targetNode) {
          return nds;
        }

        const targetSessionId =
          (data as Record<string, unknown>)?.sessionId ??
          (targetNode.data as Record<string, unknown>)?.sessionId;

        const syncPayload = buildSessionSyncPayload(data as Record<string, unknown>);
        const resolvedSessionId = typeof targetSessionId === 'string' ? targetSessionId : undefined;
        if (resolvedSessionId && !syncPayload.sessionId) {
          syncPayload.sessionId = resolvedSessionId;
        }

        return nds.map((node) => {
          if (node.id === nodeId) {
            return { ...node, data: { ...data } };
          }

          if (!resolvedSessionId) {
            return node;
          }

          const nodeSessionId = (node.data as Record<string, unknown>)?.sessionId;
          if (nodeSessionId !== resolvedSessionId) {
            return node;
          }

          return applySessionSync(node, syncPayload);
        });
      });
    };

    const handleDeleteNode = (event: CustomEvent) => {
      const { nodeId } = event.detail;
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    };

    window.addEventListener('update-node', handleUpdateNode as EventListener);
    window.addEventListener('delete-node', handleDeleteNode as EventListener);
    return () => {
      window.removeEventListener('update-node', handleUpdateNode as EventListener);
      window.removeEventListener('delete-node', handleDeleteNode as EventListener);
    };
  }, [setNodes]);

  // Listen for starter node submit events
  useEffect(() => {
    const handleStarterSubmit = (event: CustomEvent) => {
      const { nodeId, message } = event.detail;

      // Find the starter node to get its position
      const starterNode = nodes.find((n) => n.id === nodeId);
      if (!starterNode) return;

      // Get home directory as default working directory
      const electronAPI = (window as unknown as { electronAPI?: { getHomeDir: () => string } }).electronAPI;
      const workingDirectory = electronAPI?.getHomeDir() || '/';

      // Create a new terminal and agent node below the starter
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

      // Remove the starter node and add the agent node
      setNodes((nds) => [...nds.filter((n) => n.id !== nodeId), agentNode]);
    };

    window.addEventListener('starter-node-submit', handleStarterSubmit as EventListener);
    return () => {
      window.removeEventListener('starter-node-submit', handleStarterSubmit as EventListener);
    };
  }, [nodes, setNodes]);

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

  // Fetch Linear issues and projects when connected
  useEffect(() => {
    if (isLinearConnected) {
      fetchLinearIssues();
      fetchLinearProjects();
    }
  }, [isLinearConnected, fetchLinearIssues, fetchLinearProjects]);

  // Handle sidebar resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = e.clientX;
      const minWidth = 200;
      const maxWidth = 600;
      
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
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

  // Helper function to extract final folder name from path
  const getFolderName = (path: string): string => {
    // Remove trailing slashes and get the last segment
    const normalized = path.replace(/\/$/, '');
    const parts = normalized.split(/[/\\]/);
    return parts[parts.length - 1] || path;
  };

  // Organize agents hierarchically: Project > Branch > Agent
  // Also create a mapping from folder name to full path
  const { agentHierarchy, folderPathMap } = useMemo(() => {
    const hierarchy: Record<string, Record<string, Array<{ nodeId: string; agentId: string; name: string }>>> = {};
    const pathMap: Record<string, string> = {}; // Maps folder name to full path

    // Get all agent nodes
    const agentNodes = nodes.filter((node) => node.type === 'agent');

    for (const node of agentNodes) {
      const agentData = node.data as unknown as AgentNodeData;
      
      // Extract project path from workspace attachment or find connected workspace node
      let projectPath: string | null = null;
      let branch: string | null = null;

      // Check for workspace metadata attachment
      if (agentData.attachments) {
        const workspaceAttachment = agentData.attachments.find(isWorkspaceMetadataAttachment);
        if (workspaceAttachment) {
          projectPath = workspaceAttachment.path;
        }
      }

      // If no attachment, try to find connected workspace node
      if (!projectPath) {
        const edges = getEdges();
        const connectedEdge = edges.find((e) => e.target === node.id || e.source === node.id);
        if (connectedEdge) {
          const connectedNodeId = connectedEdge.source === node.id ? connectedEdge.target : connectedEdge.source;
          const connectedNode = nodes.find((n) => n.id === connectedNodeId);
          if (connectedNode?.type === 'workspace' && connectedNode.data?.path) {
            projectPath = connectedNode.data.path as string;
          }
        }
      }

      // Get branch from fetched git info (preferred) or fallback to attachment/workspace data
      if (projectPath && workspaceGitInfo[projectPath]?.branch) {
        branch = workspaceGitInfo[projectPath].branch;
      } else if (agentData.attachments) {
        const workspaceAttachment = agentData.attachments.find(isWorkspaceMetadataAttachment);
        if (workspaceAttachment?.git?.branch) {
          branch = workspaceAttachment.git.branch;
        }
      }

      // Extract final folder name from project path
      const project = projectPath ? getFolderName(projectPath) : 'Unknown Project';
      // Store mapping from folder name to full path
      if (projectPath) {
        pathMap[project] = projectPath;
      }
      // Only use 'main' as fallback if we truly have no branch info
      const branchName = branch || 'main';
      const agentName = agentData.title?.value || agentData.agentId;

      // Build hierarchy
      if (!hierarchy[project]) {
        hierarchy[project] = {};
      }
      if (!hierarchy[project][branchName]) {
        hierarchy[project][branchName] = [];
      }
      hierarchy[project][branchName].push({
        nodeId: node.id,
        agentId: agentData.agentId,
        name: agentName,
      });
    }

    return { agentHierarchy: hierarchy, folderPathMap: pathMap };
  }, [nodes, getEdges, workspaceGitInfo]);

  // Function to toggle highlight all folders
  const toggleHighlightAll = useCallback(() => {
    if (isHighlightAllActive) {
      // Turn off: clear all highlights
      setIsHighlightAllActive(false);
      setHighlightedFolders(new Set());
      setFolderColors(new Map());
    } else {
      // Turn on: highlight all folders
      setIsHighlightAllActive(true);
      const allFolderPaths = Object.values(folderPathMap).filter(Boolean) as string[];
      const newHighlightedFolders = new Set<string>(allFolderPaths);
      const newFolderColors = new Map<string, string>();
      
      // Assign unique colors to all folders
      const shuffledColors = [...highlightColors].sort(() => Math.random() - 0.5);
      allFolderPaths.forEach((folderPath, index) => {
        const color = shuffledColors[index % highlightColors.length];
        newFolderColors.set(folderPath, color);
      });
      
      setHighlightedFolders(newHighlightedFolders);
      setFolderColors(newFolderColors);
    }
  }, [isHighlightAllActive, folderPathMap]);

  // Update node styles when folders are highlighted
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.type !== 'agent') return node;
        
        const agentData = node.data as unknown as AgentNodeData;
        let projectPath: string | null = null;
        
        // Get project path from workspace attachment
        if (agentData.attachments) {
          const workspaceAttachment = agentData.attachments.find(isWorkspaceMetadataAttachment);
          if (workspaceAttachment) {
            projectPath = workspaceAttachment.path;
          }
        }
        
        // Check if this node's folder is highlighted
        const isHighlighted = projectPath && highlightedFolders.has(projectPath);
        const highlightColor = projectPath ? folderColors.get(projectPath) : null;
        
        // Apply or remove highlight style using box-shadow (doesn't affect layout)
        const currentStyle = node.style || {};
        if (isHighlighted && highlightColor) {
          return {
            ...node,
            style: {
              ...currentStyle,
              boxShadow: `0 0 0 3px ${highlightColor}`,
              borderRadius: '12px', // Match agent-node border-radius
            },
          };
        } else {
          // Remove highlight if not highlighted
          const { boxShadow, borderRadius, ...restStyle } = currentStyle as any;
          return {
            ...node,
            style: restStyle,
          };
        }
      })
    );
  }, [highlightedFolders, folderColors, setNodes]);

  // Auto-lock the first folder that appears, and clear lock if no folders exist
  useEffect(() => {
    const folderNames = Object.keys(agentHierarchy);
    if (folderNames.length === 0) {
      // Clear lock if no folders exist
      setLockedFolderPath(null);
      hasExplicitlyUnlocked.current = false;
    } else if (!lockedFolderPath && !hasExplicitlyUnlocked.current) {
      // Auto-lock first folder if none is locked AND user hasn't explicitly unlocked
      const firstFolderName = folderNames[0];
      const firstFolderPath = folderPathMap[firstFolderName];
      if (firstFolderPath) {
        setLockedFolderPath(firstFolderPath);
      }
    } else {
      // Validate that locked folder still exists
      const lockedFolderName = Object.keys(folderPathMap).find(
        (name) => folderPathMap[name] === lockedFolderPath
      );
      if (!lockedFolderName || !agentHierarchy[lockedFolderName]) {
        // Locked folder no longer exists, clear it
        setLockedFolderPath(null);
        // Reset the explicit unlock flag when the locked folder disappears
        hasExplicitlyUnlocked.current = false;
      }
    }
  }, [agentHierarchy, folderPathMap, lockedFolderPath]);

  // Check if there are any agents
  const hasAgents = useMemo(() => {
    return nodes.some((node) => node.type === 'agent');
  }, [nodes]);

  // Fetch git info for all unique workspace paths
  useEffect(() => {
    const workspacePaths = new Set<string>();
    
    // Collect all workspace paths from agent nodes
    nodes.forEach((node) => {
      if (node.type === 'agent') {
        const agentData = node.data as unknown as AgentNodeData;
        
        // Check for workspace metadata attachment
        if (agentData.attachments) {
          const workspaceAttachment = agentData.attachments.find(isWorkspaceMetadataAttachment);
          if (workspaceAttachment?.path) {
            workspacePaths.add(workspaceAttachment.path);
          }
        }
        
        // Check for connected workspace node
        const edges = getEdges();
        const connectedEdge = edges.find((e) => e.target === node.id || e.source === node.id);
        if (connectedEdge) {
          const connectedNodeId = connectedEdge.source === node.id ? connectedEdge.target : connectedEdge.source;
          const connectedNode = nodes.find((n) => n.id === connectedNodeId);
          if (connectedNode?.type === 'workspace' && connectedNode.data?.path) {
            workspacePaths.add(connectedNode.data.path as string);
          }
        }
      }
    });

    // Fetch git info for each workspace path
    const fetchGitInfo = async () => {
      const gitInfoMap: Record<string, { branch: string | null }> = {};
      
      for (const path of workspacePaths) {
        try {
          const gitInfo = await window.gitAPI?.getInfo(path);
          gitInfoMap[path] = {
            branch: gitInfo?.branch || null,
          };
        } catch (error) {
          gitInfoMap[path] = { branch: null };
        }
      }
      
      setWorkspaceGitInfo(gitInfoMap);
    };

    if (workspacePaths.size > 0) {
      fetchGitInfo();
    } else {
      setWorkspaceGitInfo({});
    }
  }, [nodes, getEdges]);

  const toggleProject = useCallback((projectPath: string) => {
    setCollapsedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectPath)) {
        newSet.delete(projectPath);
      } else {
        newSet.add(projectPath);
      }
      return newSet;
    });
  }, []);

  const toggleBranch = useCallback((branchKey: string) => {
    setCollapsedBranches((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(branchKey)) {
        newSet.delete(branchKey);
      } else {
        newSet.add(branchKey);
      }
      return newSet;
    });
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
    } catch (error) {
      console.error('Error handling drop:', error);
    }
  }, [screenToFlowPosition, setNodes]);

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

      if (!sessionId || !workspacePath) {
        setForkError('Missing session or workspace');
        setTimeout(() => setForkError(null), 5000);
        return;
      }

      // Show fork modal with resolved session/workspace to avoid stale node data later
      setForkModalData({ sourceNodeId, position, sessionId, workspacePath });
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
      const parentSessionId = forkModalData.sessionId;
      const workspacePath = forkModalData.workspacePath;

      if (!parentSessionId || !workspacePath) {
        setForkError('Missing session or workspace');
        return;
      }

      setIsForkLoading(true);
      setForkError(null);

      try {
        // Call fork service to create worktree and fork session
        const result = await forkService.forkAgent({
          sourceAgentId: sourceData.agentId,
          parentSessionId,
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
          parentSessionId,
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
        setForkError('Select an agent node to fork');
        setTimeout(() => setForkError(null), 3000);
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
      handleForkCreate(selectedNode.id, forkPosition);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [getNodes, handleForkCreate]);

  // Listen for fork button clicks from agent nodes
  useEffect(() => {
    const handleForkClick = (event: Event) => {
      const customEvent = event as CustomEvent<{ nodeId: string }>;
      const { nodeId } = customEvent.detail;

      // Find the source node
      const sourceNode = nodes.find((n) => n.id === nodeId);
      if (!sourceNode) {
        console.error('[Canvas] Source node not found for fork click:', nodeId);
        return;
      }

      // Calculate position for the forked node (placed below the source node)
      const nodeHeight = 400; // Default agent node height
      const verticalSpacing = 100; // Space between nodes
      const forkPosition = {
        x: sourceNode.position?.x ?? 0,
        y: (sourceNode.position?.y ?? 0) + nodeHeight + verticalSpacing,
      };

      console.log('[Canvas] Fork button clicked for node:', nodeId);
      handleForkCreate(nodeId, forkPosition);
    };

    window.addEventListener('agent-node:fork-click', handleForkClick as EventListener);
    return () => window.removeEventListener('agent-node:fork-click', handleForkClick as EventListener);
  }, [nodes, handleForkCreate]);

  // Listen for create/close chat node events
  useEffect(() => {
    const handleCreateChatNode = (event: Event) => {
      const customEvent = event as CustomEvent<{
        nodeId: string;
        agentId: string;
        sessionId?: string;
        agentType: string;
        workspacePath?: string;
        chatMessages?: CodingAgentMessage[];
        title?: string;
      }>;
      const { nodeId, agentId, sessionId, agentType, workspacePath, chatMessages, title } = customEvent.detail;

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
          messages: chatMessages || [],
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

  // Function to actually create the agent node (called from modal)
  const createAgentNode = useCallback((position?: { x: number; y: number }, modalData?: {
    title: string;
    description: string;
    workspacePath?: string;
    todo?: string;
    priority?: string;
    assignee?: string;
    project?: string;
    labels?: string[];
  }) => {
    let nodePosition = position || pendingAgentPosition;

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
    const sessionId = crypto.randomUUID();
    const createdAt = Date.now();

    console.log('[Canvas] Creating agent node', {
      agentId,
      terminalId,
      createdAt: new Date(createdAt).toISOString(),
      modalData,
    });

    // Use title from modal if provided, otherwise use default
    const nodeTitle = modalData?.title || createDefaultAgentTitle();

    // Determine workspace path: use from modal data, or locked folder, or null
    const selectedWorkspacePath = modalData?.workspacePath || lockedFolderPath || null;

    // Pre-fill with workspace path (but don't create attachment yet - let agent node handle it)
    const newNode: Node = {
      id: `node-${createdAt}`,
      type: 'agent',
      position: nodePosition,
      data: {
        agentId,
        terminalId,
        agentType: 'claude_code',
        status: 'idle',
        title: nodeTitle,
        summary: modalData?.description || null,
        progress: null,
        attachments: [],
        activeView: 'overview',
        sessionId,
        createdAt,
        forking: false, // Default to false, will be set to true when JSONL file is found
        // Add prefilled workspace path if selected
        ...(selectedWorkspacePath && { prefilledWorkspacePath: selectedWorkspacePath }),
      },
      style: {
        width: 500,
        height: 450,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setContextMenu(null);
    setPendingAgentPosition(undefined);
  }, [contextMenu, screenToFlowPosition, setNodes, lockedFolderPath, pendingAgentPosition]);

  // Function to show the modal (replaces direct node creation)
  const addAgentNode = useCallback((position?: { x: number; y: number }) => {
    // Calculate position if not provided
    let nodePosition = position;

    if (!nodePosition && contextMenu) {
      nodePosition = screenToFlowPosition({
        x: contextMenu.x,
        y: contextMenu.y,
      });
    }

    if (!nodePosition) {
      nodePosition = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
    }

    // Store position and show modal
    setPendingAgentPosition(nodePosition);
    setIsNewAgentModalOpen(true);
    setContextMenu(null);
  }, [contextMenu, screenToFlowPosition]);

  const addStarterNode = useCallback((position?: { x: number; y: number }) => {
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

    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'starter',
      position: nodePosition,
      data: {
        placeholder: 'Ask Claude anything... (Enter to send)',
      },
      style: {
        width: 500,
        height: 180,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setContextMenu(null);
  }, [contextMenu, screenToFlowPosition, setNodes]);

  // Store pending position for conversation node creation
  const pendingConversationPosition = useRef<{ x: number; y: number } | null>(null);

  const addConversationNode = useCallback((position?: { x: number; y: number }, sessionId?: string) => {
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

    // If no sessionId provided, open session picker modal
    if (!sessionId) {
      pendingConversationPosition.current = nodePosition;
      setIsSessionPickerOpen(true);
      setContextMenu(null);
      return;
    }

    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'conversation',
      position: nodePosition,
      data: {
        sessionId,
        agentType: 'claude_code',
        isExpanded: true,
      },
      style: {
        width: 500,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setContextMenu(null);
  }, [contextMenu, screenToFlowPosition, setNodes]);

  // Add Claude Code Terminal - a terminal that auto-starts claude command
  const addClaudeCodeTerminal = useCallback((position?: { x: number; y: number }) => {
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

    const terminalId = `terminal-${crypto.randomUUID()}`;
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'terminal',
      position: nodePosition,
      data: {
        terminalId,
        autoStartClaude: true, // Flag to auto-start claude command
      },
      style: {
        width: 600,
        height: 400,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setContextMenu(null);
  }, [contextMenu, screenToFlowPosition, setNodes]);

  // Create Linear ticket
  const createLinearTicket = useCallback(async () => {
    const apiKey = localStorage.getItem('linear_api_key');
    if (!apiKey) {
      alert('Please connect to Linear first in the settings');
      return;
    }

    // Get default team ID (we'll use the first team from the viewer)
    try {
      const query = `
        query {
          viewer {
            id
            teams {
              nodes {
                id
                name
              }
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
      const teams = data.data?.viewer?.teams?.nodes || [];
      
      if (teams.length === 0) {
        alert('No teams found in Linear workspace');
        return;
      }

      // Use the first team
      const teamId = teams[0].id;

      // Create issue mutation
      const mutation = `
        mutation($teamId: String!, $title: String!) {
          issueCreate(
            input: {
              teamId: $teamId
              title: $title
            }
          ) {
            success
            issue {
              id
              identifier
              title
              url
            }
          }
        }
      `;

      const title = prompt('Enter ticket title:');
      if (!title) return;

      const mutationResponse = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey,
        },
        body: JSON.stringify({
          query: mutation,
          variables: {
            teamId,
            title,
          },
        }),
      });

      const mutationData = await mutationResponse.json();
      if (mutationData.data?.issueCreate?.success) {
        const issue = mutationData.data.issueCreate.issue;
        alert(`Ticket created: ${issue.identifier} - ${issue.title}\n${issue.url}`);
      } else {
        alert('Failed to create ticket: ' + (mutationData.errors?.[0]?.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating Linear ticket:', error);
      alert('Error creating ticket: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }, []);

  // Handle session selection from picker
  const handleSessionSelect = useCallback((session: { id: string; projectName?: string; projectPath?: string; messageCount?: number; timestamp?: string }) => {
    const position = pendingConversationPosition.current || screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'conversation',
      position,
      data: {
        sessionId: session.id,
        agentType: 'claude_code',
        title: session.projectName,
        projectPath: session.projectPath,
        projectName: session.projectName,
        messageCount: session.messageCount,
        timestamp: session.timestamp ? new Date(session.timestamp).getTime() : undefined,
        isExpanded: true,
      },
      style: {
        width: 500,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    pendingConversationPosition.current = null;
  }, [screenToFlowPosition, setNodes]);

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

  // Command palette commands
  const commandActions = useMemo<CommandAction[]>(() => [
    {
      id: 'add-agent',
      label: 'Add Agent',
      shortcut: 'c',
      action: () => addAgentNode(),
    },
    {
      id: 'add-terminal',
      label: 'Add Terminal',
      shortcut: 'v',
      action: () => addTerminalNode(),
    },
    {
      id: 'add-claude-terminal',
      label: 'Add Claude Code Terminal',
      shortcut: 'b',
      action: () => addClaudeCodeTerminal(),
    },
    {
      id: 'load-conversation',
      label: 'Load Conversation',
      shortcut: 'n',
      action: () => addConversationNode(),
    },
    {
      id: 'create-linear-ticket',
      label: 'Create Linear Ticket',
      shortcut: 'm',
      action: () => createLinearTicket(),
    },
  ], [addAgentNode, addTerminalNode, addClaudeCodeTerminal, addConversationNode, createLinearTicket]);

  // Keyboard shortcuts: CMD+K to open command palette, CMD+W to add workspace
  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    const handleKeyDown = (event: KeyboardEvent) => {
      const modifierKey = isMac ? event.metaKey : event.ctrlKey;

      // CMD+K / CTRL+K to toggle command palette
      if (modifierKey && event.key === 'k') {
        event.preventDefault(); // Prevent default browser behavior
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // CMD+T / CTRL+T to toggle agent modal
      if (modifierKey && event.key === 't') {
        event.preventDefault(); // Prevent default browser behavior
        if (isNewAgentModalOpen) {
          setIsNewAgentModalOpen(false);
          setPendingAgentPosition(undefined);
        } else {
          addAgentNode();
        }
        return;
      }

      // CMD+G / CTRL+G to open agent modal with new worktree
      if (modifierKey && event.key === 'g') {
        event.preventDefault(); // Prevent default browser behavior
        if (!isNewAgentModalOpen) {
          setAutoCreateWorktree(true);
          addAgentNode();
        }
        return;
      }

      // CMD+W / CTRL+W to add terminal
      if (modifierKey && event.key === 'w') {
        event.preventDefault(); // Prevent default browser behavior
        addTerminalNode();
      }

      // CMD+Shift+A / CTRL+Shift+A to add agent (legacy shortcut, still works)
      if (modifierKey && event.shiftKey && event.key === 'A') {
        event.preventDefault();
        addAgentNode();
      }

      // CMD+N / CTRL+N to add starter node (new conversation)
      if (modifierKey && event.key === 'n') {
        event.preventDefault();
        addStarterNode();
      }

      // CMD+Shift+L / CTRL+Shift+L to load conversation
      if (modifierKey && event.shiftKey && event.key === 'L') {
        event.preventDefault();
        addConversationNode();
      }

      // Enable node drag mode while holding CMD (Mac) or CTRL (Windows/Linux)
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
      // Disable node drag mode when CMD/CTRL key is released
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
  }, [addWorkspaceNode, addAgentNode, addStarterNode, addConversationNode, isNodeDragEnabled]);

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
    (_event: React.MouseEvent, node: Node) => {
      isSnappingRef.current = false;
    },
    []
  );

  // Wrap onNodesChange to intercept position changes and apply snapping
  const handleNodesChange = useCallback(
    (changes: any[]) => {
      // If snapping is disabled or we're already snapping, just pass through
      if (!isNodeDragEnabled || isSnappingRef.current) {
        onNodesChange(changes);
        return;
      }

      const allNodes = getNodes();
      const modifiedChanges = changes.map((change) => {
        // Intercept position changes and apply snapping
        if (change.type === 'position' && change.position) {
          const node = allNodes.find((n) => n.id === change.id);
          if (node) {
            // Create a temporary node with the new position to check snapping
            const tempNode = {
              ...node,
              position: change.position,
            };
            const snappedPosition = applySnapping(tempNode, allNodes);
            if (snappedPosition) {
              // Modify the change to use the snapped position
              return {
                ...change,
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
        onNodesChange(modifiedChanges);
        // Reset flag after a short delay
        setTimeout(() => {
          isSnappingRef.current = false;
        }, 10);
      } else {
        // No snapping needed, pass through original changes
        onNodesChange(changes);
      }
    },
    [onNodesChange, isNodeDragEnabled, getNodes, applySnapping]
  );

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
          setAutoCreateWorktree(false);
        }}
        onCreate={(data) => {
          createAgentNode(pendingAgentPosition, data);
          setIsNewAgentModalOpen(false);
          setPendingAgentPosition(undefined);
          setAutoCreateWorktree(false);
        }}
        initialPosition={pendingAgentPosition}
        initialWorkspacePath={lockedFolderPath}
        autoCreateWorktree={autoCreateWorktree}
      />
      {/* Sidebar Panel */}
      <div 
        className={`canvas-sidebar ${isSidebarCollapsed ? 'collapsed' : ''} ${isResizing ? 'resizing' : ''}`}
        style={{ width: isSidebarCollapsed ? 0 : `${sidebarWidth}px` }}
      >
        <div className="sidebar-header">
          <h2 className="sidebar-title">Canvas</h2>
          <button
            className="sidebar-toggle"
            onClick={() => setIsSidebarCollapsed(true)}
            aria-label="Collapse sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>

        {!isSidebarCollapsed && (
          <div className="sidebar-content">
            {hasAgents && (
              <div className="sidebar-section">
                {Object.entries(agentHierarchy).map(([projectName, branches]) => {
                  const isProjectCollapsed = collapsedProjects.has(projectName);
                  const projectPath = folderPathMap[projectName];
                  const isLocked = lockedFolderPath === projectPath;
                  const isHovered = hoveredFolderPath === projectPath;
                  const highlightColor = projectPath ? folderColors.get(projectPath) : null;
                  // Show lock if: this folder is locked (always visible), OR this folder is hovered and not locked (show open lock on hover)
                  const showLock = isLocked || (isHovered && !isLocked);
                  
                  return (
                    <div 
                      key={projectName} 
                      className="sidebar-folder"
                      onMouseEnter={() => setHoveredFolderPath(projectPath || null)}
                      onMouseLeave={() => setHoveredFolderPath(null)}
                    >
                      <div className="sidebar-folder-header-wrapper">
                        <button
                          className={`sidebar-folder-header ${!showLock ? 'no-lock' : ''}`}
                          onClick={() => toggleProject(projectName)}
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
                                setLockedFolderPath(null);
                                hasExplicitlyUnlocked.current = true;
                              } else {
                                setLockedFolderPath(projectPath);
                                hasExplicitlyUnlocked.current = false;
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
                                <g clipPath="url(#clip0_995_195)">
                                  <path d="M21.9727 191.504H111.328C125.684 191.504 133.301 183.691 133.301 168.262V100.977C133.301 85.6445 125.684 77.832 111.328 77.832H21.9727C7.61719 77.832 0 85.6445 0 100.977V168.262C0 183.691 7.61719 191.504 21.9727 191.504ZM22.4609 176.758C18.2617 176.758 15.8203 174.121 15.8203 169.336V99.9023C15.8203 95.1172 18.2617 92.5781 22.4609 92.5781H110.84C115.137 92.5781 117.48 95.1172 117.48 99.9023V169.336C117.48 174.121 115.137 176.758 110.84 176.758H22.4609ZM17.0898 85.3516H32.6172V52.4414C32.6172 27.7344 48.3398 14.7461 66.6016 14.7461C84.8633 14.7461 100.781 27.7344 100.781 52.4414V85.3516H116.211V54.4922C116.211 17.7734 92.1875 0 66.6016 0C41.1133 0 17.0898 17.7734 17.0898 54.4922V85.3516Z" fill="currentColor"/>
                                </g>
                                <defs>
                                  <clipPath id="clip0_995_195">
                                    <rect width="133.301" height="196.582" fill="white"/>
                                  </clipPath>
                                </defs>
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 134 197" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <g clipPath="url(#clip0_995_200)">
                                  <path d="M21.9727 191.504H111.328C125.684 191.504 133.301 183.691 133.301 168.262L133.301 131.899C133.301 116.566 125.684 108.754 111.328 108.754H21.9727C7.61719 108.754 0 116.566 0 131.899V168.262C0 183.691 7.61719 191.504 21.9727 191.504ZM22.4609 176.758C18.2617 176.758 15.8203 174.121 15.8203 169.336L15.8203 130.824C15.8203 126.039 18.2617 123.5 22.4609 123.5H110.84C115.137 123.5 117.48 126.039 117.48 130.824L117.48 169.336C117.48 174.121 115.137 176.758 110.84 176.758H22.4609ZM17.1142 52.4792C17.0872 53.5835 17.9852 54.4922 19.0898 54.4922H30.5664C31.699 54.4922 32.6172 53.574 32.6172 52.4414C32.6172 27.7344 48.3398 14.7461 66.6016 14.7461C84.8633 14.7461 100.781 27.7344 100.781 52.4414V114H116.211V54.4922C116.211 17.7734 92.1875 0 66.6016 0C41.5835 0 17.9767 17.1236 17.1142 52.4792Z" fill="currentColor"/>
                                </g>
                                <defs>
                                  <clipPath id="clip0_995_200">
                                    <rect width="133.301" height="196.582" fill="white"/>
                                  </clipPath>
                                </defs>
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                      {!isProjectCollapsed && (
                        <div className="sidebar-folder-content">
                          {Object.entries(branches).map(([branchName, agents]) => {
                            const branchKey = `${projectName}:${branchName}`;
                            const isBranchCollapsed = collapsedBranches.has(branchKey);
                            return (
                              <div key={branchKey} className="sidebar-folder nested">
                                <button
                                  className="sidebar-folder-header"
                                  onClick={() => toggleBranch(branchKey)}
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
            {isLinearConnected && (
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
                  <span className="sidebar-linear-issues-workspace">
                    {linearWorkspaceName || (loadingIssues ? 'Loading...' : 'Unknown')}
                  </span>
                </div>
                
                {!isLinearCollapsed && (
                  <>
                    <div className="sidebar-linear-issues-filters">
                  <div className="sidebar-linear-issues-filter">
                    <label htmlFor="sidebar-issues-filter-project">Project</label>
                    <select
                      id="sidebar-issues-filter-project"
                      className="sidebar-issues-select"
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
                  <div className="sidebar-linear-issues-filter">
                    <label htmlFor="sidebar-issues-filter-milestone">Milestone</label>
                    <select
                      id="sidebar-issues-filter-milestone"
                      className="sidebar-issues-select"
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
                  <div className="sidebar-linear-issues-filter">
                    <label htmlFor="sidebar-issues-filter-status">Status</label>
                    <select
                      id="sidebar-issues-filter-status"
                      className="sidebar-issues-select"
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

                <div className="sidebar-linear-issues-list">
                  {loadingIssues ? (
                    <div className="sidebar-linear-issues-loading">Loading issues...</div>
                  ) : filteredIssues.length === 0 ? (
                    <div className="sidebar-linear-issues-empty">
                      {issues.length === 0 ? 'No open issues found' : 'No issues match these filters'}
                    </div>
                  ) : (
                    filteredIssues.map((issue) => {
                      const projectLabel = issue.project?.name;
                      const milestoneLabel = issue.projectMilestone?.name;
                      return (
                        <div
                          key={issue.id}
                          className="sidebar-issue-card"
                          draggable
                          onDragStart={(e) => handleIssueDragStart(e, issue)}
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
      {!isSidebarCollapsed && (
        <div
          ref={resizeHandleRef}
          className="sidebar-resize-handle"
          onMouseDown={handleResizeStart}
        />
      )}

      {/* Canvas Content */}
      <div className={`canvas-content ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Expand button when sidebar is collapsed */}
        {isSidebarCollapsed && (
          <button
            className="sidebar-expand-button"
            onClick={() => setIsSidebarCollapsed(false)}
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
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={onPaneClick}
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
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
            <div className="context-menu-item" onClick={() => addTerminalNode()}>
              <span className="context-menu-label">Add Terminal</span>
              <span className="context-menu-shortcut">
                {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘W' : 'Ctrl+W'}
              </span>
            </div>
            <div className="context-menu-item" onClick={() => addAgentNode()}>
              <span className="context-menu-label">Add Agent</span>
              <span className="context-menu-shortcut">
                {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘T' : 'Ctrl+T'}
              </span>
            </div>
            <div className="context-menu-divider" />
            <div className="context-menu-item highlight" onClick={() => addStarterNode()}>
              <span className="context-menu-label">New Conversation</span>
              <span className="context-menu-shortcut">
                {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘N' : 'Ctrl+N'}
              </span>
            </div>
            <div className="context-menu-item" onClick={() => addConversationNode()}>
              <span className="context-menu-label">Load Conversation</span>
              <span className="context-menu-shortcut">
                {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⇧⌘L' : 'Ctrl+Shift+L'}
              </span>
            </div>
          </div>
        </>
      )}

        {/* Eye Icon Button - Highlight All Folders */}
        <button
          className="highlight-all-fab"
          onClick={toggleHighlightAll}
          aria-label={isHighlightAllActive ? 'Unhighlight all folders' : 'Highlight all folders'}
          title={isHighlightAllActive ? 'Unhighlight all folders' : 'Highlight all folders'}
        >
          <svg width="16" height="16" viewBox="0 0 267 168" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#eye-clip-global)">
              <path d="M133.496 167.48C212.402 167.48 266.895 103.711 266.895 83.7891C266.895 63.7695 212.305 0.0976562 133.496 0.0976562C55.6641 0.0976562 0 63.7695 0 83.7891C0 103.711 55.5664 167.48 133.496 167.48ZM133.496 152.051C69.1406 152.051 17.0898 97.5586 17.0898 83.7891C17.0898 72.168 69.1406 15.5273 133.496 15.5273C197.559 15.5273 249.805 72.168 249.805 83.7891C249.805 97.5586 197.559 152.051 133.496 152.051ZM133.496 138.379C163.77 138.379 188.281 113.867 188.281 83.5938C188.281 53.3203 163.77 28.8086 133.496 28.8086C103.223 28.8086 78.6133 53.3203 78.6133 83.5938C78.6133 113.867 103.223 138.379 133.496 138.379Z" fill="currentColor" fillOpacity={isHighlightAllActive ? "1" : "0.85"}/>
            </g>
            <defs>
              <clipPath id="eye-clip-global">
                <rect width="266.895" height="167.48" fill="white"/>
              </clipPath>
            </defs>
          </svg>
        </button>

        {/* Settings FAB */}
        <button
          className="settings-fab"
          onClick={() => setIsSettingsOpen(true)}
          aria-label="Settings"
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

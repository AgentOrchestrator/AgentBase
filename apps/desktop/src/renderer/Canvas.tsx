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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './Canvas.css';
import { createDefaultAgentTitle } from './types/agent-node';
import { createLinearIssueAttachment, createWorkspaceMetadataAttachment, isWorkspaceMetadataAttachment } from './types/attachments';
import { useCanvasPersistence } from './hooks';
import { nodeRegistry } from './nodes/registry';
import type { AgentNodeData } from './types/agent-node';
import { parseConversationFile, groupConversationMessages } from './utils/conversationParser';
import { conversationToNodesAndEdges } from './utils/conversationToNodes';
import UserMessageNode from './components/UserMessageNode';
import AssistantMessageNode from './components/AssistantMessageNode';
import ConsolidatedConversationNode from './components/ConsolidatedConversationNode';

// Use node types from the registry (single source of truth)
// Also include conversation node types for debugging
const nodeTypes = {
  ...nodeRegistry.reactFlowNodeTypes,
  userMessage: UserMessageNode,
  assistantMessage: AssistantMessageNode,
  consolidatedConversation: ConsolidatedConversationNode,
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
  const debugConversationNodes = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const [debugNodesLoaded, setDebugNodesLoaded] = useState(false);

  // DEBUG: Load conversation file early (before initial state is applied)
  useEffect(() => {
    if (debugConversationNodes.current) return; // Already loaded
    
    const conversationPath = '/Users/maxprokopp/.claude/projects/-Users-maxprokopp-CursorProjects-AgentBase-desktop-app/2cc81131-2edc-48c3-96ac-c2b3d2256c02.jsonl';
    
    const loadDebugConversation = async () => {
      try {
        const fileAPI = (window as any).fileAPI;
        if (!fileAPI) {
          console.warn('[Canvas] fileAPI not available');
          return;
        }
        
        console.log('[Canvas] Reading file:', conversationPath);
        const fileContent = await fileAPI.readFile(conversationPath);
        console.log('[Canvas] File content length:', fileContent?.length || 0);
        
        if (!fileContent) {
          console.error('[Canvas] File content is empty');
          return;
        }
        
        const entries = parseConversationFile(fileContent);
        console.log('[Canvas] Parsed entries:', entries.length);
        
        const groups = groupConversationMessages(entries);
        console.log('[Canvas] All groups:', groups.length, 'User groups:', groups.filter(g => g.type === 'user').length);
        
        if (groups.length > 0) {
          // Center the conversation on the canvas
          const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 - 300 : 400;
          const centerY = typeof window !== 'undefined' ? window.innerHeight / 2 - 200 : 300;
          
          console.log('[Canvas] Creating nodes at position:', centerX, centerY);
          const { nodes: conversationNodes, edges: conversationEdges } = conversationToNodesAndEdges(
            groups,
            centerX,
            centerY
          );
          
          console.log('[Canvas] Created nodes:', conversationNodes.length, 'edges:', conversationEdges.length);
          console.log('[Canvas] Node details:', conversationNodes.map(n => ({ id: n.id, type: n.type, position: n.position })));
          
          debugConversationNodes.current = { nodes: conversationNodes, edges: conversationEdges };
          setDebugNodesLoaded(true); // Trigger useEffect to add nodes
          
          console.log('[Canvas] Loaded debug conversation:', {
            groups: groups.length,
            nodes: conversationNodes.length,
            edges: conversationEdges.length
          });
        } else {
          console.warn('[Canvas] No groups to display');
        }
      } catch (error) {
        console.error('[Canvas] Error loading debug conversation:', error);
      }
    };
    
    loadDebugConversation();
  }, []);

  // Apply restored state when it becomes available, including debug conversation
  useEffect(() => {
    if (!isCanvasLoading) {
      // Merge initial nodes with debug conversation nodes
      const allNodes = debugConversationNodes.current 
        ? [...initialNodes, ...debugConversationNodes.current.nodes]
        : initialNodes;
      const allEdges = debugConversationNodes.current
        ? [...initialEdges, ...debugConversationNodes.current.edges]
        : initialEdges;
      
      if (!initialStateApplied.current && (allNodes.length > 0 || allEdges.length > 0)) {
        setNodes(allNodes);
        setEdges(allEdges);
        initialStateApplied.current = true;
        console.log('[Canvas] Applied initial state with debug conversation:', {
          initialNodes: initialNodes.length,
          debugNodes: debugConversationNodes.current?.nodes.length || 0,
          totalNodes: allNodes.length
        });
      } else if (debugConversationNodes.current && (initialStateApplied.current || debugNodesLoaded)) {
        // If nodes were loaded after initial state was applied, add them now
        setNodes((prevNodes) => {
          const existingIds = new Set(prevNodes.map(n => n.id));
          const newNodes = debugConversationNodes.current!.nodes.filter(n => !existingIds.has(n.id));
          if (newNodes.length > 0) {
            console.log('[Canvas] Adding late-loaded debug nodes:', newNodes.length);
            return [...prevNodes, ...newNodes];
          }
          return prevNodes;
        });
        setEdges((prevEdges) => {
          const existingIds = new Set(prevEdges.map(e => e.id));
          const newEdges = debugConversationNodes.current!.edges.filter(e => !existingIds.has(e.id));
          if (newEdges.length > 0) {
            console.log('[Canvas] Adding late-loaded debug edges:', newEdges.length);
            return [...prevEdges, ...newEdges];
          }
          return prevEdges;
        });
      }
    }
  }, [isCanvasLoading, initialNodes, initialEdges, debugNodesLoaded, setNodes, setEdges]);

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
  const { screenToFlowPosition, getEdges } = useReactFlow();
  const [isNodeDragEnabled, setIsNodeDragEnabled] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSessionPickerOpen, setIsSessionPickerOpen] = useState(false);
  const [linearApiKey, setLinearApiKey] = useState('');
  const [isLinearConnected, setIsLinearConnected] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(new Set());
  const [workspaceGitInfo, setWorkspaceGitInfo] = useState<Record<string, { branch: string | null }>>({});
  const [lockedFolderPath, setLockedFolderPath] = useState<string | null>(null);
  const [hoveredFolderPath, setHoveredFolderPath] = useState<string | null>(null);

  // Issues pill state
  const [isPillExpanded, setIsPillExpanded] = useState(false);
  const [isPillSquare, setIsPillSquare] = useState(false);
  const [showPillContent, setShowPillContent] = useState(false);
  const [isContentVisible, setIsContentVisible] = useState(false);
  const [isTextVisible, setIsTextVisible] = useState(true);

  // Empty pill copy state
  const [isPillCopyExpanded, setIsPillCopyExpanded] = useState(false);
  const [isPillCopySquare, setIsPillCopySquare] = useState(false);
  const [showPillCopyContent, setShowPillCopyContent] = useState(false);
  const [isPillCopyContentVisible, setIsPillCopyContentVisible] = useState(false);
  const [isPillCopyTextVisible, setIsPillCopyTextVisible] = useState(true);
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

  // Auto-lock the first folder that appears, and clear lock if no folders exist
  useEffect(() => {
    const folderNames = Object.keys(agentHierarchy);
    if (folderNames.length === 0) {
      // Clear lock if no folders exist
      setLockedFolderPath(null);
    } else if (!lockedFolderPath) {
      // Auto-lock first folder if none is locked
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

  // Empty pill copy toggle and collapse functions
  const togglePillCopy = useCallback(() => {
    if (!isPillCopyExpanded) {
      // Hide text immediately when expanding
      setIsPillCopyTextVisible(false);
      // Both phases start simultaneously
      setIsPillCopyExpanded(true);
      setIsPillCopySquare(true);
      // Show pill content after expansion completes (300ms) + 50ms delay
      setTimeout(() => {
        setShowPillCopyContent(true);
        // Start content animation after pill content is shown
        setTimeout(() => {
          setIsPillCopyContentVisible(true);
        }, 100);
      }, 350);
    } else {
      // Hide animations immediately when collapsing
      setIsPillCopyContentVisible(false);
      // Hide pill content immediately when collapsing
      setShowPillCopyContent(false);
      // Both phases collapse simultaneously
      setIsPillCopySquare(false);
      setIsPillCopyExpanded(false);
      // Start text fade-in animation after collapse completes (300ms + 50ms delay)
      setTimeout(() => {
        setIsPillCopyTextVisible(true);
      }, 350);
    }
  }, [isPillCopyExpanded]);

  const collapsePillCopy = useCallback(() => {
    // First hide animations immediately
    setIsPillCopyContentVisible(false);
    // First hide content with 50ms delay
    setShowPillCopyContent(false);
    setTimeout(() => {
      // Then collapse the pill
      setIsPillCopySquare(false);
      setIsPillCopyExpanded(false);
      // Start text fade-in animation after collapse completes (300ms + 50ms delay)
      setTimeout(() => {
        setIsPillCopyTextVisible(true);
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

    // Always generate unique IDs for each new node
    const agentId = `agent-${crypto.randomUUID()}`;
    const terminalId = `terminal-${crypto.randomUUID()}`;
    const createdAt = Date.now();

    console.log('[Canvas] Creating agent node', {
      agentId,
      terminalId,
      createdAt: new Date(createdAt).toISOString(),
    });

    // Pre-fill with locked folder path (but don't create attachment yet - let modal show with it pre-filled)
    const newNode: Node = {
      id: `node-${createdAt}`,
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
        // Add prefilled workspace path if locked folder exists
        ...(lockedFolderPath && { prefilledWorkspacePath: lockedFolderPath }),
      },
      style: {
        width: 500,
        height: 450,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setContextMenu(null);
  }, [contextMenu, screenToFlowPosition, setNodes, lockedFolderPath]);

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
  }, [addTerminalNode, addWorkspaceNode, addAgentNode, addStarterNode, addConversationNode, isNodeDragEnabled]);

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
      {/* Sidebar Panel */}
      <div className={`canvas-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
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
                          className="sidebar-folder-header"
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
                                setLockedFolderPath(null);
                              } else {
                                setLockedFolderPath(projectPath);
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
          </div>
        )}
      </div>

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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={onPaneClick}
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
        nodeTypes={nodeTypes}
        fitView
        style={{ backgroundColor: '#141414' }}
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
          <div className="context-menu-divider" />
          <div className="context-menu-item highlight" onClick={() => addStarterNode()}>
            <span>New Conversation</span>
            <span className="context-menu-shortcut">
              {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘N' : 'Ctrl+N'}
            </span>
          </div>
          <div className="context-menu-item" onClick={() => addConversationNode()}>
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

        {/* Issues Pill - COMMENTED OUT */}
        {false && isLinearConnected && (
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

        {/* Empty Pill Copy */}
        <div
          onClick={!isPillCopySquare ? togglePillCopy : undefined}
          className={`issues-pill ${!isPillCopySquare ? 'cursor-pointer' : 'cursor-default'} ${
            isPillCopyExpanded ? 'expanded' : ''
          } ${isPillCopySquare ? 'square' : ''}`}
          style={{
            borderRadius: isPillCopySquare ? '24px' : '20px'
          }}
        >
          {!isPillCopySquare ? (
            <div className={`pill-text ${isPillCopyTextVisible ? 'visible' : ''}`}>
              {/* Empty - no text */}
            </div>
          ) : showPillCopyContent ? (
            <div className="pill-content-wrapper" onClick={(e) => e.stopPropagation()}>
              {/* Collapse nozzle at top */}
              <div
                className={`collapse-nozzle ${isPillCopyContentVisible ? 'visible' : ''}`}
                onClick={collapsePillCopy}
                title="Collapse"
              />

              {/* Empty content area */}
              <div className={`issues-list ${isPillCopyContentVisible ? 'visible' : ''}`}>
                {/* Empty - no content */}
              </div>
            </div>
          ) : null}
        </div>
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

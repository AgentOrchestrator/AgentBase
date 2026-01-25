/**
 * AgentNodePresentation
 *
 * Presentation component for AgentNode that uses context hooks for services.
 * Handles UI rendering, status display, and user interactions.
 */

import { useExpose } from '@agent-orchestrator/shared';
import { Handle, NodeResizer, Position } from '@xyflow/react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CodingAgentStatus } from '../../../../types/coding-agent-status';
import AgentChatView from '../../AgentChatView';
import AgentOverviewView from '../../AgentOverviewView';
import AgentTerminalView from '../../AgentTerminalView';
import AttachmentHeader from '../../AttachmentHeader';
import { useAgentService, useTerminalService } from '../../context';
import { useAgentViewMode, useSessionOverview } from '../../hooks';
import type { SessionReadiness } from '../../hooks/useAgentState';
import IssueDetailsModal from '../../IssueDetailsModal';
import type {
  AgentNodeData,
  AgentNodeView,
  AgentProgress,
  PermissionMode,
} from '../../types/agent-node';
import {
  createLinearIssueAttachment,
  isLinearIssueAttachment,
  type TerminalAttachment,
} from '../../types/attachments';
import { getConversationFilePath } from '../../utils/getConversationFilePath';
import '../../AgentNode.css';
import { permissionModeStore } from '../../stores';
import { AgentNodeChatHandle } from './AgentNodeChatHandle';
import { AgentNodeForkHandle } from './AgentNodeForkHandle';

/**
 * Permission mode display configuration
 */
const PERMISSION_MODE_CONFIG: Record<
  PermissionMode,
  { label: string; icon: string; color: string; tooltip: string }
> = {
  plan: { label: 'Plan', icon: '📋', color: '#f59e0b', tooltip: 'Plan Mode - Restrictive' },
  'auto-accept': {
    label: 'Auto',
    icon: '✓',
    color: '#22c55e',
    tooltip: 'Auto-Accept - Permissive',
  },
  ask: { label: 'Ask', icon: '?', color: '#3b82f6', tooltip: 'Ask Mode - Interactive' },
};

export interface AgentNodePresentationProps {
  /** Agent node data (single source of truth for workspace) */
  data: AgentNodeData;
  /** Callback when node data changes */
  onDataChange: (data: Partial<AgentNodeData>) => void;
  /** Whether the node is selected */
  selected?: boolean;
  /** Session readiness from useAgentState */
  sessionReadiness?: SessionReadiness;
  /** React Flow node ID */
  nodeId?: string;
  /** Human-readable "time ago" string for session creation (e.g., "5m ago") */
  sessionCreatedAgo?: string | null;
}

/**
 * AgentNodePresentation
 *
 * Renders the agent node UI with overview/terminal tabs,
 * attachments, and status display.
 */
export function AgentNodePresentation({
  data,
  onDataChange,
  selected,
  sessionReadiness = 'idle',
  nodeId,
  sessionCreatedAgo,
}: AgentNodePresentationProps) {
  const agent = useAgentService();
  const terminalService = useTerminalService();
  const isSessionReady = sessionReadiness === 'ready';

  // Use centralized view mode management with terminal lifecycle coordination
  // This ensures REPL is exited and terminal PTY is destroyed when switching to chat view
  // to avoid Claude Code session conflicts (same session can't be used simultaneously)
  const { activeView, setActiveView } = useAgentViewMode({
    terminalService,
    agentService: agent,
    initialView: data.activeView || 'overview',
    onViewChange: (view) => onDataChange({ activeView: view }),
  });

  const [isDragOver, setIsDragOver] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  // Forking check state
  const forking = data.forking ?? false;
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef(false);

  // Permission mode state - subscribes to global mode changes
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(() =>
    permissionModeStore.getEffectiveMode(data.agentId)
  );

  // Subscribe to permission mode changes
  useEffect(() => {
    // Update when agent-specific mode changes
    const unsubAgent = permissionModeStore.subscribe(data.agentId, setPermissionMode);
    // Also update when global mode changes (in case agent has no override)
    const unsubGlobal = permissionModeStore.subscribeGlobal(() => {
      setPermissionMode(permissionModeStore.getEffectiveMode(data.agentId));
    });
    return () => {
      unsubAgent();
      unsubGlobal();
    };
  }, [data.agentId]);

  // =============================================================================
  // E2E Automation (useExpose)
  // =============================================================================

  useExpose(`agent:${data.agentId}`, {
    // State
    agentId: data.agentId,
    sessionId: data.sessionId,
    status: data.status,
    permissionMode,
    activeView,

    // View actions
    setActiveView: (view: AgentNodeView) => setActiveView(view),
    showOverview: () => setActiveView('overview'),
    showTerminal: () => setActiveView('terminal'),
    showChat: () => setActiveView('chat'),

    // Permission mode actions
    cyclePermissionMode: () => permissionModeStore.cycleAgentMode(data.agentId),
    setPermissionMode: (mode: PermissionMode) =>
      permissionModeStore.setAgentMode(data.agentId, mode),
  });

  // Stop agent when node unmounts
  // Agent start is handled by AgentTerminalView when it mounts
  useEffect(() => {
    return () => {
      agent.stop().catch((err) => {
        console.error('[AgentNode] Failed to stop agent:', err);
      });
    };
  }, [agent]);

  // Unified session overview - manages title, status, summary, and most recent message
  const sessionOverview = useSessionOverview({
    sessionId: data.sessionId,
    workspacePath: data.workspacePath,
    agentService: agent,
    agentType: data.agentType,
    enabled: !!data.sessionId && !!data.workspacePath,
  });

  // Refs to track previous values and prevent infinite re-renders
  const prevStatusRef = useRef<string | null>(null);
  const prevTitleRef = useRef<string | null>(null);
  const prevSummaryRef = useRef<string | null>(null);
  const prevProgressRef = useRef<AgentProgress | null>(null);

  // Sync status changes from overview to node data
  useEffect(() => {
    const currentStatus = sessionOverview.status?.status ?? null;
    if (currentStatus && currentStatus !== prevStatusRef.current) {
      prevStatusRef.current = currentStatus;
      onDataChange({
        status: sessionOverview.status?.status,
        statusInfo: sessionOverview.status!,
      });
    }
  }, [sessionOverview.status, onDataChange]);

  // Sync title changes from overview to node data (only if not manually set)
  useEffect(() => {
    if (
      sessionOverview.title &&
      !data.title.isManuallySet &&
      sessionOverview.title !== prevTitleRef.current
    ) {
      prevTitleRef.current = sessionOverview.title;
      onDataChange({
        title: { value: sessionOverview.title, isManuallySet: false },
      });
    }
  }, [sessionOverview.title, data.title.isManuallySet, onDataChange]);

  // Sync summary changes from overview to node data
  useEffect(() => {
    if (sessionOverview.summary && sessionOverview.summary !== prevSummaryRef.current) {
      prevSummaryRef.current = sessionOverview.summary;
      onDataChange({ summary: sessionOverview.summary });
    }
  }, [sessionOverview.summary, onDataChange]);

  // Sync progress changes from overview to node data
  useEffect(() => {
    const currentProgress = sessionOverview.progress;
    const prevProgress = prevProgressRef.current;

    // Compare by JSON stringification to detect deep changes
    const hasChanged = JSON.stringify(currentProgress) !== JSON.stringify(prevProgress);

    if (hasChanged) {
      prevProgressRef.current = currentProgress;
      onDataChange({ progress: currentProgress });
    }
  }, [sessionOverview.progress, onDataChange]);

  // Handle view change - delegates to useAgentViewMode hook which manages
  // terminal lifecycle and persists view state via onViewChange callback
  const handleViewChange = useCallback(
    (view: AgentNodeView) => {
      // setActiveView is async and handles terminal destroy when switching to chat
      void setActiveView(view);
    },
    [setActiveView]
  );

  // Handle title change (manual edit from user)
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      onDataChange({
        title: { value: newTitle, isManuallySet: true },
      });
    },
    [onDataChange]
  );

  // Handle attachment details click
  const handleAttachmentClick = useCallback((attachment: TerminalAttachment) => {
    if (isLinearIssueAttachment(attachment) && attachment.id) {
      setSelectedIssueId(attachment.id);
      setShowIssueModal(true);
    }
  }, []);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const attachmentType = e.dataTransfer.getData('attachment-type');
      const jsonData = e.dataTransfer.getData('application/json');

      if (!jsonData) return;

      try {
        const droppedData = JSON.parse(jsonData);

        if (attachmentType === 'linear-issue' || droppedData.identifier) {
          const newAttachment = createLinearIssueAttachment(droppedData);
          const currentAttachments = data.attachments || [];
          const isDuplicate = currentAttachments.some(
            (a) => a.type === newAttachment.type && a.id === newAttachment.id
          );

          if (!isDuplicate) {
            onDataChange({
              attachments: [...currentAttachments, newAttachment],
            });
          }
        } else if (attachmentType === 'workspace-metadata' || droppedData.path) {
          // Workspace dropped - update workspace path directly in node data
          if (droppedData.path) {
            onDataChange({ workspacePath: droppedData.path });
          }
        }
      } catch (error) {
        console.error('[AgentNode] Error parsing dropped data', error);
      }
    },
    [data.attachments, onDataChange]
  );

  const attachments = data.attachments || [];

  // Get workspace info from node data (single source of truth)
  const workspacePath = data.workspacePath ?? null;
  const gitInfo = data.gitInfo ?? null;

  // Check if JSONL file exists
  const checkJsonlFile = useCallback(async () => {
    if (!data.sessionId || !workspacePath || forking || isCheckingRef.current) {
      return;
    }

    isCheckingRef.current = true;
    try {
      const filePath = getConversationFilePath(data.sessionId, workspacePath);
      const fileAPI = (window as any).fileAPI;

      if (!fileAPI || !fileAPI.exists) {
        console.warn('[AgentNode] fileAPI.exists not available');
        isCheckingRef.current = false;
        return;
      }

      const exists = await fileAPI.exists(filePath);

      if (exists) {
        // File exists, set forking to true and stop polling
        onDataChange({ forking: true });
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        console.log('[AgentNode] JSONL file found, forking set to true:', filePath);
      }
    } catch (error) {
      console.error('[AgentNode] Error checking JSONL file:', error);
    } finally {
      isCheckingRef.current = false;
    }
  }, [data.sessionId, workspacePath, forking, onDataChange]);

  // Start polling when node is clicked and forking is false
  const handleNodeClick = useCallback(() => {
    if (forking || !data.sessionId || !workspacePath) {
      return;
    }

    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Check immediately
    checkJsonlFile();

    // Then check every 5 seconds
    pollingIntervalRef.current = setInterval(() => {
      checkJsonlFile();
    }, 5000);

    console.log('[AgentNode] Started polling for JSONL file');
  }, [forking, data.sessionId, workspacePath, checkJsonlFile]);

  // Cleanup polling on unmount or when forking becomes true
  useEffect(() => {
    if (forking && pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('[AgentNode] Stopped polling (forking is true)');
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [forking]);

  // Get folder name from workspace path
  const folderName = workspacePath ? workspacePath.split('/').pop() || 'Workspace' : null;
  const branch = gitInfo?.branch;

  // Status display configuration
  const STATUS_CONFIG: Record<
    CodingAgentStatus,
    { label: string; color: string; icon: string; className: string }
  > = {
    idle: { label: 'Idle', color: '#888', icon: '○', className: 'status-idle' },
    running: { label: 'Running', color: '#888', icon: '●', className: 'status-blinking' },
    thinking: { label: 'Thinking', color: '#888', icon: '●', className: 'status-blinking' },
    streaming: { label: 'Streaming', color: '#888', icon: '●', className: 'status-blinking' },
    executing_tool: { label: 'Executing', color: '#888', icon: '●', className: 'status-blinking' },
    awaiting_input: {
      label: 'Waiting for user response',
      color: '#888',
      icon: '',
      className: 'status-awaiting',
    },
    paused: { label: 'Paused', color: '#F5C348', icon: '●', className: 'status-paused' },
    completed: { label: 'Completed', color: '#0ECF85', icon: '●', className: 'status-completed' },
    error: { label: 'Error', color: '#AF201D', icon: '●', className: 'status-error' },
  };

  const statusConfig = STATUS_CONFIG[data.status];
  const toolLabel = data.statusInfo?.toolName ? `: ${data.statusInfo.toolName}` : '';
  const subagentLabel = data.statusInfo?.subagentName ? ` (${data.statusInfo.subagentName})` : '';
  return (
    <div className="agent-node-wrapper">
      {/* Frame Label - Folder and Branch */}
      {(folderName || branch) && (
        <div className="agent-node-frame-label">
          {folderName && workspacePath && (
            <>
              <svg
                className="frame-label-icon"
                width="12"
                height="12"
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
              <span
                className="frame-label-text frame-label-folder-name"
                onClick={async () => {
                  if (workspacePath) {
                    try {
                      await window.shellAPI?.openWithEditor(workspacePath, 'finder');
                    } catch (error) {
                      console.error('Failed to open folder in Finder:', error);
                    }
                  }
                }}
                title="Open in Finder"
              >
                {folderName}
              </span>
            </>
          )}
          {branch && (
            <>
              <svg
                className="frame-label-icon"
                width="12"
                height="12"
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
              <span className="frame-label-text">{branch}</span>
            </>
          )}
        </div>
      )}

      {/* Session Label - Bottom */}
      {data.sessionId && (
        <div className="agent-node-session-label">
          Session: {data.sessionId.slice(0, 8)}...
          {sessionCreatedAgo && <span className="session-created-ago"> · {sessionCreatedAgo}</span>}
        </div>
      )}

      <div
        className={`agent-node ${isDragOver ? 'drag-over' : ''} ${selected ? 'selected' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={(e) => {
          // Only trigger if not clicking on interactive elements (buttons, inputs, etc.)
          const target = e.target as HTMLElement;
          if (
            target.tagName === 'BUTTON' ||
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.closest('button') ||
            target.closest('input') ||
            target.closest('textarea') ||
            target.closest('.agent-node-fork-button-wrapper') ||
            target.closest('.agent-node-bottom-buttons') ||
            target.closest('.agent-node-view-switcher') ||
            target.closest('.agent-node-status-indicator')
          ) {
            return;
          }
          handleNodeClick();
        }}
      >
        <NodeResizer
          minWidth={450}
          minHeight={350}
          isVisible={true}
          lineStyle={{ borderColor: 'transparent' }}
          handleStyle={{ width: 24, height: 24, borderRadius: '50%' }}
          handleClassName="agent-node-resize-handle"
        />

        {/* Target handles - all sides for flexible edge connections */}
        <Handle
          type="target"
          position={Position.Top}
          id="target-top"
          className="agent-node-side-handle"
        />
        <Handle
          type="target"
          position={Position.Right}
          id="target-right"
          className="agent-node-side-handle"
        />
        <Handle
          type="target"
          position={Position.Bottom}
          id="target-bottom"
          className="agent-node-side-handle"
        />
        <Handle
          type="target"
          position={Position.Left}
          id="target-left"
          className="agent-node-side-handle"
        />

        {/* Source handles - all sides for flexible edge connections */}
        <Handle
          type="source"
          position={Position.Top}
          id="source-top"
          className="agent-node-side-handle"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="source-right"
          className="agent-node-side-handle"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="source-bottom"
          className="agent-node-side-handle"
        />
        <Handle
          type="source"
          position={Position.Left}
          id="source-left"
          className="agent-node-side-handle"
        />

        {/* Status Indicator - Top Left */}
        <div className="agent-node-status-indicator">
          <div
            className={`status-indicator ${statusConfig.className}`}
            style={{ '--status-color': statusConfig.color } as React.CSSProperties}
          >
            {data.status === 'awaiting_input' ? (
              <span className="status-label">{statusConfig.label}</span>
            ) : (
              <>
                <span className="status-icon">{statusConfig.icon}</span>
                <span className="status-label">
                  {statusConfig.label}
                  {toolLabel}
                  {subagentLabel}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Permission Mode Indicator - Next to Status (clickable to cycle) */}
        {/* Hidden in terminal view since CLI handles its own permission mode */}
        {activeView !== 'terminal' && (
          <div
            className="agent-node-permission-indicator"
            onClick={(e) => {
              e.stopPropagation();
              permissionModeStore.cycleAgentMode(data.agentId);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                permissionModeStore.cycleAgentMode(data.agentId);
              }
            }}
            role="button"
            tabIndex={0}
            title={`${PERMISSION_MODE_CONFIG[permissionMode].tooltip} (Click to cycle)`}
          >
            <span
              className="permission-mode-badge"
              style={
                {
                  '--permission-color': PERMISSION_MODE_CONFIG[permissionMode].color,
                } as React.CSSProperties
              }
            >
              <span className="permission-icon">{PERMISSION_MODE_CONFIG[permissionMode].icon}</span>
              <span className="permission-label">
                {PERMISSION_MODE_CONFIG[permissionMode].label}
              </span>
            </span>
          </div>
        )}

        {/* View Switcher Buttons - Top Right */}
        <div
          className={`agent-node-view-switcher ${activeView === 'terminal' ? 'terminal-active' : ''}`}
        >
          <button
            className={`agent-view-button ${activeView === 'overview' ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              handleViewChange('overview');
            }}
            title="Overview"
          >
            {activeView === 'overview' ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 200 200"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g clipPath="url(#clip0_1020_300)">
                  <path
                    d="M199.219 99.6094C199.219 154.492 154.59 199.219 99.6094 199.219C44.7266 199.219 0 154.492 0 99.6094C0 44.6289 44.7266 0 99.6094 0C154.59 0 199.219 44.6289 199.219 99.6094ZM42.1875 133.008C42.1875 137.891 45.9961 141.699 50.7812 141.699C55.6641 141.699 59.4727 137.891 59.4727 133.008C59.4727 128.32 55.5664 124.316 50.7812 124.316C45.9961 124.316 42.1875 128.223 42.1875 133.008ZM75.0977 126.953C71.7773 126.953 69.043 129.688 69.043 133.008C69.043 136.426 71.582 139.16 75.0977 139.16H150.488C154.004 139.16 156.738 136.426 156.738 133.008C156.738 129.59 154.004 126.953 150.488 126.953H75.0977ZM42.1875 99.707C42.1875 104.59 45.9961 108.398 50.7812 108.398C55.5664 108.398 59.4727 104.492 59.4727 99.707C59.4727 94.9219 55.5664 91.0156 50.7812 91.0156C45.9961 91.0156 42.1875 94.8242 42.1875 99.707ZM75.0977 93.6523C71.7773 93.6523 69.043 96.3867 69.043 99.707C69.043 103.027 71.7773 105.859 75.0977 105.859H150.488C154.004 105.859 156.738 103.125 156.738 99.707C156.738 96.2891 154.004 93.6523 150.488 93.6523H75.0977ZM42.1875 66.4062C42.1875 71.1914 45.9961 75.0977 50.7812 75.0977C55.5664 75.0977 59.4727 71.0938 59.4727 66.4062C59.4727 61.5234 55.6641 57.7148 50.7812 57.7148C45.9961 57.7148 42.1875 61.5234 42.1875 66.4062ZM75.0977 60.3516C71.582 60.3516 69.043 62.9883 69.043 66.4062C69.043 69.7266 71.7773 72.5586 75.0977 72.5586H150.488C154.004 72.5586 156.738 69.8242 156.738 66.4062C156.738 62.9883 154.004 60.3516 150.488 60.3516H75.0977Z"
                    fill="currentColor"
                    fillOpacity="0.85"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_1020_300">
                    <rect width="199.219" height="199.316" fill="white" />
                  </clipPath>
                </defs>
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 200 200"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g clipPath="url(#clip0_1020_290)">
                  <path
                    d="M99.6094 199.219C154.59 199.219 199.219 154.59 199.219 99.6094C199.219 44.6289 154.59 0 99.6094 0C44.6289 0 0 44.6289 0 99.6094C0 154.59 44.6289 199.219 99.6094 199.219ZM99.6094 182.617C53.7109 182.617 16.6016 145.508 16.6016 99.6094C16.6016 53.7109 53.7109 16.6016 99.6094 16.6016C145.508 16.6016 182.617 53.7109 182.617 99.6094C182.617 145.508 145.508 182.617 99.6094 182.617Z"
                    fill="currentColor"
                    fillOpacity="0.85"
                  />
                  <path
                    d="M75.7812 73.2422H149.023C152.344 73.2422 154.98 70.7031 154.98 67.3828C154.98 63.9648 152.344 61.4258 149.023 61.4258H75.7812C72.4609 61.4258 69.9219 64.0625 69.9219 67.3828C69.9219 70.6055 72.5586 73.2422 75.7812 73.2422ZM75.7812 137.891H149.023C152.344 137.891 154.98 135.352 154.98 132.031C154.98 128.613 152.344 126.074 149.023 126.074H75.7812C72.5586 126.074 69.9219 128.809 69.9219 132.031C69.9219 135.352 72.4609 137.891 75.7812 137.891ZM75.7812 105.566H149.023C152.344 105.566 154.98 103.027 154.98 99.707C154.98 96.2891 152.344 93.75 149.023 93.75H75.7812C72.5586 93.75 69.9219 96.4844 69.9219 99.707C69.9219 102.93 72.5586 105.566 75.7812 105.566ZM52.2461 75.7812C56.8359 75.7812 60.6445 71.875 60.6445 67.3828C60.6445 62.6953 56.9336 58.9844 52.2461 58.9844C47.5586 58.9844 43.8477 62.6953 43.8477 67.3828C43.8477 71.9727 47.5586 75.7812 52.2461 75.7812ZM52.2461 108.105C56.8359 108.105 60.6445 104.199 60.6445 99.707C60.6445 95.1172 56.8359 91.3086 52.2461 91.3086C47.5586 91.3086 43.8477 95.0195 43.8477 99.707C43.8477 104.297 47.5586 108.105 52.2461 108.105ZM52.2461 140.43C56.9336 140.43 60.6445 136.621 60.6445 132.031C60.6445 127.441 56.8359 123.633 52.2461 123.633C47.5586 123.633 43.8477 127.344 43.8477 132.031C43.8477 136.621 47.5586 140.43 52.2461 140.43Z"
                    fill="currentColor"
                    fillOpacity="0.85"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_1020_290">
                    <rect width="199.219" height="199.316" fill="white" />
                  </clipPath>
                </defs>
              </svg>
            )}
          </button>
          <button
            className={`agent-view-button ${activeView === 'terminal' ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              handleViewChange('terminal');
            }}
            title="Terminal"
          >
            {activeView === 'terminal' ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 231 180"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g clipPath="url(#clip0_1020_338)">
                  <path
                    d="M230.273 30.2734V149.609C230.273 169.727 220.117 179.785 199.609 179.785H30.6641C10.2539 179.785 0 169.727 0 149.609V30.2734C0 10.1562 10.2539 0 30.6641 0H199.609C220.117 0 230.273 10.1562 230.273 30.2734ZM89.5508 80.4688C85.9375 80.4688 83.1055 83.3984 83.1055 87.0117C83.1055 90.625 85.9375 93.5547 89.5508 93.5547H127.93C131.641 93.5547 134.473 90.625 134.473 87.0117C134.473 83.3984 131.641 80.4688 127.93 80.4688H89.5508ZM40.625 46.582L64.8438 61.1328L40.625 75.8789C32.7148 80.5664 39.3555 92.6758 48.1445 87.207L77.0508 69.043C82.8125 65.4297 82.5195 56.8359 77.0508 53.3203L48.1445 35.2539C39.3555 29.7852 32.6172 41.6992 40.625 46.582Z"
                    fill="currentColor"
                    fillOpacity="0.85"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_1020_338">
                    <rect width="230.273" height="179.785" fill="white" />
                  </clipPath>
                </defs>
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 231 180"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g clipPath="url(#clip0_1020_328)">
                  <path
                    d="M30.6641 179.785H199.609C220.117 179.785 230.273 169.727 230.273 149.609V30.2734C230.273 10.1562 220.117 0 199.609 0H30.6641C10.2539 0 0 10.1562 0 30.2734V149.609C0 169.727 10.2539 179.785 30.6641 179.785ZM30.8594 164.062C21.0938 164.062 15.7227 158.887 15.7227 148.73V31.1523C15.7227 20.9961 21.0938 15.7227 30.8594 15.7227H199.414C209.082 15.7227 214.551 20.9961 214.551 31.1523V148.73C214.551 158.887 209.082 164.062 199.414 164.062H30.8594Z"
                    fill="currentColor"
                    fillOpacity="0.85"
                  />
                  <path
                    d="M41.9927 75.4896C34.3755 80.0794 40.8208 91.7005 49.2193 86.4271L77.3443 68.849C82.9107 65.3333 82.6177 57.0325 77.3443 53.7122L49.2193 36.1341C40.8208 30.8607 34.2778 42.3841 41.9927 47.0716L65.5278 61.2318L41.9927 75.4896ZM83.2036 86.3294C83.2036 89.7474 85.938 92.5794 89.4536 92.5794H126.661C130.177 92.5794 132.911 89.7474 132.911 86.3294C132.911 82.8138 130.177 79.9818 126.661 79.9818H89.4536C85.938 79.9818 83.2036 82.8138 83.2036 86.3294Z"
                    fill="currentColor"
                    fillOpacity="0.85"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_1020_328">
                    <rect width="230.273" height="179.785" fill="white" />
                  </clipPath>
                </defs>
              </svg>
            )}
          </button>
          <button
            className={`agent-view-button ${activeView === 'chat' ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              handleViewChange('chat');
            }}
            title="Chat"
          >
            {activeView === 'chat' ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 226 204"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g clipPath="url(#clip0_1020_347)">
                  <path
                    d="M112.891 187.891C178.418 187.891 225.879 148.34 225.879 93.9453C225.879 39.4531 178.32 0 112.891 0C47.4609 0 0 39.4531 0 93.9453C0 133.105 21.4844 143.652 21.4844 161.133C21.4844 168.75 19.043 173.73 13.1836 179.199C8.78906 183.105 11.1328 187.891 17.5781 187.891C31.0547 187.891 44.8242 183.496 54.8828 176.172C71.7773 183.887 91.4062 187.891 112.891 187.891Z"
                    fill="currentColor"
                    fillOpacity="0.85"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_1020_347">
                    <rect width="225.879" height="203.418" fill="white" />
                  </clipPath>
                </defs>
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 228 205"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g clipPath="url(#clip0_996_260)">
                  <path
                    d="M113.574 190.137C179.199 190.137 227.148 150.098 227.148 95.0195C227.148 39.7461 179.102 0 113.574 0C47.9492 0 0 39.7461 0 95.0195C0 113.281 5.37109 130.273 14.7461 144.043C19.3359 150.879 20.9961 155.664 20.9961 159.668C20.9961 164.844 19.4336 169.043 14.9414 172.949C7.22656 179.492 11.2305 190.137 21.3867 190.137C33.5938 190.137 47.168 185.938 57.2266 179.004C73.7305 186.23 92.9688 190.137 113.574 190.137ZM113.574 174.414C94.9219 174.414 78.2227 170.898 64.0625 164.551C57.8125 161.816 53.3203 162.598 47.3633 166.113C43.1641 168.75 38.2812 170.996 33.3008 172.07C35.3516 168.652 36.7188 164.746 36.7188 159.668C36.7188 152.441 34.082 144.531 27.832 135.156C20.0195 123.828 15.7227 110.059 15.7227 95.0195C15.7227 49.2188 56.1523 15.7227 113.574 15.7227C170.996 15.7227 211.426 49.2188 211.426 95.0195C211.426 140.82 170.996 174.414 113.574 174.414Z"
                    fill="currentColor"
                    fillOpacity="0.85"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_996_260">
                    <rect width="227.148" height="204.59" fill="white" />
                  </clipPath>
                </defs>
              </svg>
            )}
          </button>
          <AgentNodeChatHandle
            nodeId={nodeId}
            agentId={data.agentId}
            sessionId={data.sessionId}
            agentType={data.agentType}
            workspacePath={data.workspacePath}
            title={data.title.value}
          />
        </div>

        {/* Attachments (Linear issues only - workspace is shown in frame label) */}
        {attachments.filter(isLinearIssueAttachment).map((attachment, index) => (
          <AttachmentHeader
            key={`${attachment.type}-${attachment.id}-${index}`}
            attachment={attachment}
            onDetailsClick={() => handleAttachmentClick(attachment)}
          />
        ))}

        {/* Content Area - Conditional rendering to avoid Claude Code session conflicts */}
        {/* Terminal and Chat cannot be mounted simultaneously as they both use the same session */}
        <div className="agent-node-content">
          {activeView === 'overview' && (
            <AgentOverviewView
              agentId={data.agentId}
              title={data.title}
              summary={data.summary}
              status={data.status}
              statusInfo={data.statusInfo}
              progress={data.progress}
              workspacePath={workspacePath ?? undefined}
              sessionId={data.sessionId}
              onTitleChange={handleTitleChange}
              hideStatusIndicator={true}
              mostRecentUserMessage={sessionOverview.mostRecentUserMessage}
            />
          )}
          {activeView === 'terminal' && data.sessionId && data.workspacePath && (
            <AgentTerminalView
              workspacePath={data.workspacePath}
              sessionId={data.sessionId}
              initialPrompt={data.initialPrompt}
              selected={selected}
            />
          )}
          {activeView === 'chat' && data.sessionId && data.workspacePath && (
            <AgentChatView
              agentId={data.agentId}
              nodeId={nodeId || ''}
              sessionId={data.sessionId}
              workspacePath={data.workspacePath}
              agentType={data.agentType}
              initialPrompt={data.initialPrompt}
              initialInputText={data.initialInputText}
              onSessionCreated={(newSessionId) => onDataChange({ sessionId: newSessionId })}
              isSessionReady={isSessionReady}
              selected={selected}
            />
          )}
        </div>

        {/* Bottom buttons - fork */}
        <div className="agent-node-bottom-buttons">
          <AgentNodeForkHandle nodeId={nodeId} />
        </div>

        {/* Issue Details Modal */}
        {showIssueModal && selectedIssueId && (
          <IssueDetailsModal
            issueId={selectedIssueId}
            onClose={() => {
              setShowIssueModal(false);
              setSelectedIssueId(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

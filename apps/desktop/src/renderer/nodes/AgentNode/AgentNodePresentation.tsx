/**
 * AgentNodePresentation
 *
 * Presentation component for AgentNode that uses context hooks for services.
 * Handles UI rendering, status display, and user interactions.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import AgentOverviewView from '../../AgentOverviewView';
import AgentTerminalView from '../../AgentTerminalView';
import AgentChatView from '../../AgentChatView';
import AttachmentHeader from '../../AttachmentHeader';
import IssueDetailsModal from '../../IssueDetailsModal';
import {
  isLinearIssueAttachment,
  createLinearIssueAttachment,
  TerminalAttachment,
} from '../../types/attachments';
import type { AgentNodeData, AgentNodeView } from '../../types/agent-node';
import {
  useAgentService,
  useNodeInitialized,
} from '../../context';
import type { SessionReadiness } from '../../hooks/useAgentState';
import { getConversationFilePath } from '../../utils/getConversationFilePath';
import type { CodingAgentStatus } from '../../../../types/coding-agent-status';
import '../../AgentNode.css';

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
}: AgentNodePresentationProps) {
  const agent = useAgentService();
  const isInitialized = useNodeInitialized();
  const isSessionReady = sessionReadiness === 'ready';

  const [activeView, setActiveView] = useState<AgentNodeView>(
    data.activeView || 'overview'
  );
  const [isDragOver, setIsDragOver] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  
  // Forking check state
  const forking = data.forking ?? false;
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef(false);

  // Auto-start CLI when initialized (if enabled)
  useEffect(() => {
    if (isInitialized && agent.isAutoStartEnabled() && isSessionReady) {
      agent.start(undefined, data.sessionId, data.initialPrompt).catch((err) => {
        console.error('[AgentNode] Failed to auto-start agent:', err);
      });
    }

    console.log('[AgentNodePresentation] isInitialized:', isInitialized, 'isSessionReady:', isSessionReady, data);

    return () => {
      // Stop agent on unmount
      agent.stop().catch((err) => {
        console.error('[AgentNode] Failed to stop agent:', err);
      });
    };
  }, [isInitialized, agent, isSessionReady, data.sessionId, data.initialPrompt]);

  // Subscribe to status changes
  useEffect(() => {
    const unsubscribe = agent.onStatusChange((_agentId, _oldStatus, newStatus) => {
      // Update node data with new status
      onDataChange({
        status: newStatus.status,
        statusInfo: newStatus,
      });
    });

    return unsubscribe;
  }, [agent, onDataChange]);

  // Handle view change
  const handleViewChange = useCallback(
    (view: AgentNodeView) => {
      setActiveView(view);
      onDataChange({ activeView: view });
    },
    [onDataChange]
  );

  // Handle title change
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      onDataChange({
        title: { value: newTitle, isManuallySet: true },
      });
    },
    [onDataChange]
  );

  // Auto-update title from first user message
  useEffect(() => {
    // Only auto-update if title is not manually set
    if (data.title.isManuallySet) {
      return;
    }

    const messages = data.chatMessages || [];
    const firstUserMessage = messages.find((msg) => msg.role === 'user');

    if (firstUserMessage && firstUserMessage.content) {
      const content = firstUserMessage.content.trim();
      if (content && content !== data.title.value) {
        // Truncate to reasonable length for title (will be further limited by CSS)
        const maxLength = 100;
        let titleText = content;
        if (titleText.length > maxLength) {
          titleText = titleText.slice(0, maxLength).trim();
          // Try to cut at word boundary
          const lastSpace = titleText.lastIndexOf(' ');
          if (lastSpace > maxLength * 0.7) {
            titleText = titleText.slice(0, lastSpace);
          }
          titleText += '...';
        }

        onDataChange({
          title: { value: titleText, isManuallySet: false },
        });
      }
    }
  }, [data.chatMessages, data.title.isManuallySet, data.title.value, onDataChange]);

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
  const folderName = workspacePath
    ? workspacePath.split('/').pop() || 'Workspace'
    : null;
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
    awaiting_input: { label: 'Waiting for user response', color: '#888', icon: '', className: 'status-awaiting' },
    paused: { label: 'Paused', color: 'rgb(255, 204, 0)', icon: '●', className: 'status-paused' },
    completed: { label: 'Completed', color: 'rgb(52, 199, 89)', icon: '●', className: 'status-completed' },
    error: { label: 'Error', color: 'rgb(255, 56, 60)', icon: '●', className: 'status-error' },
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

      {/* View Switcher Buttons - Top Right */}
      <div className="agent-node-view-switcher">
        <button
          className={`agent-view-button ${activeView === 'overview' ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            handleViewChange('overview');
          }}
          title="Overview"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19,11 C20.0543909,11 20.9181678,11.81585 20.9945144,12.8507339 L21,13 L21,19 C21,20.0543909 20.18415,20.9181678 19.1492661,20.9945144 L19,21 L15,21 C13.9456091,21 13.0818322,20.18415 13.0054856,19.1492661 L13,19 L13,13 C13,11.9456091 13.81585,11.0818322 14.8507339,11.0054856 L15,11 L19,11 Z M9,15 C10.1046,15 11,15.8954 11,17 L11,19 C11,20.1046 10.1046,21 9,21 L5,21 C3.89543,21 3,20.1046 3,19 L3,17 C3,15.8954 3.89543,15 5,15 L9,15 Z M19,13 L15,13 L15,19 L19,19 L19,13 Z M9,17 L5,17 L5,19 L9,19 L9,17 Z M9,3 C10.1046,3 11,3.89543 11,5 L11,11 C11,12.1046 10.1046,13 9,13 L5,13 C3.89543,13 3,12.1046 3,11 L3,5 C3,3.89543 3.89543,3 5,3 L9,3 Z M9,5 L5,5 L5,11 L9,11 L9,5 Z M19,3 C20.1046,3 21,3.89543 21,5 L21,7 C21,8.10457 20.1046,9 19,9 L15,9 C13.8954,9 13,8.10457 13,7 L13,5 C13,3.89543 13.8954,3 15,3 L19,3 Z M19,5 L15,5 L15,7 L19,7 L19,5 Z" fill="currentColor"/>
          </svg>
        </button>
        <button
          className={`agent-view-button ${activeView === 'terminal' ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            handleViewChange('terminal');
          }}
          title="Terminal"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19,3 C20.1046,3 21,3.89543 21,5 L21,19 C21,20.1046 20.1046,21 19,21 L5,21 C3.89543,21 3,20.1046 3,19 L3,5 C3,3.89543 3.89543,3 5,3 L19,3 Z M19,5 L5,5 L5,19 L19,19 L19,5 Z M16.0001,14.0001 C16.5524,14.0001 17.0001,14.4478 17.0001,15.0001 C17.0001,15.51295 16.614073,15.9356092 16.1167239,15.9933725 L16.0001,16.0001 L14.0001,16.0001 C13.4478,16.0001 13.0001,15.5524 13.0001,15.0001 C13.0001,14.48725 13.386127,14.0645908 13.8834761,14.0068275 L14.0001,14.0001 L16.0001,14.0001 Z M9.05037,8.46459 L11.8788,11.293 C12.2693,11.6835 12.2693,12.3167 11.8788,12.7072 L9.05037,15.5357 C8.65985,15.9262 8.02668,15.9262 7.63616,15.5357 C7.24563,15.1451 7.24563,14.512 7.63616,14.1214 L9.75748,12.0001 L7.63616,9.8788 C7.24563,9.48828 7.24563,8.85511 7.63616,8.46459 C8.02668,8.07406 8.65985,8.07406 9.05037,8.46459 Z" fill="currentColor"/>
          </svg>
        </button>
        <button
          className={`agent-view-button ${activeView === 'chat' ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            handleViewChange('chat');
          }}
          title="Chat"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12,5 C7.40326,5 4,8.07312 4,11.5 C4,13.5136 5.14136,15.3721 7.0416,16.5964 C7.78041,17.0724 7.98058,17.9987 8.0143,18.8184 C8.76669,18.5086 9.27173,17.6587 10.1858,17.8316 C10.7677,17.9416 11.3749,18 12,18 C16.5967,18 20,14.9269 20,11.5 C20,8.07312 16.5967,5 12,5 Z M2,11.5 C2,6.64261 6.65561,3 12,3 C17.3444,3 22,6.64261 22,11.5 C22,16.3574 17.3444,20 12,20 C11.3472,20 10.708,19.9469 10.0886,19.8452 C9.99597,19.918 9.83571,20.0501 9.63851,20.1891 C9.0713,20.5887 8.24917,21 7,21 C6.44772,21 6,20.5523 6,20 C6,19.4499 6.14332,18.7663 5.90624,18.2438 C3.57701,16.7225 2,14.2978 2,11.5 Z" fill="currentColor"/>
          </svg>
        </button>
      </div>

      {/* Attachments (Linear issues only - workspace is shown in frame label) */}
      {attachments
        .filter(isLinearIssueAttachment)
        .map((attachment, index) => (
          <AttachmentHeader
            key={`${attachment.type}-${attachment.id}-${index}`}
            attachment={attachment}
            onDetailsClick={() => handleAttachmentClick(attachment)}
          />
        ))}

      {/* Content Area - Both views are always mounted, visibility controlled via CSS */}
      {/* This preserves terminal session state when switching between tabs */}
      <div className="agent-node-content">
        <div style={{ display: activeView === 'overview' ? 'contents' : 'none' }}>
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
          />
        </div>
        <div style={{ display: activeView === 'terminal' ? 'contents' : 'none' }}>
          <AgentTerminalView terminalId={data.terminalId} selected={selected} />
        </div>
        <div style={{ display: activeView === 'chat' ? 'contents' : 'none' }}>
          <AgentChatView
            agentId={data.agentId}
            sessionId={data.sessionId}
            agentType={data.agentType}
            workspacePath={workspacePath ?? undefined}
            initialMessages={data.chatMessages}
            onMessagesChange={(messages) => onDataChange({ chatMessages: messages })}
            onSessionCreated={(sessionId) => onDataChange({ sessionId })}
            isSessionReady={isSessionReady}
            selected={selected}
          />
        </div>
      </div>

      {/* Bottom buttons - chat and fork */}
      <div className="agent-node-bottom-buttons">
        {/* Chat button */}
        <button
          className="agent-node-chat-button"
          onClick={(e) => {
            e.stopPropagation();
            if (!nodeId) return;
            window.dispatchEvent(
              new CustomEvent('agent-node:create-chat-node', {
                detail: { 
                  nodeId,
                  agentId: data.agentId,
                  sessionId: data.sessionId,
                  agentType: data.agentType,
                  workspacePath: workspaceState?.path,
                  chatMessages: data.chatMessages || [],
                  title: data.title.value,
                },
                bubbles: true,
              })
            );
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          title="Create Chat Node"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12,5 C7.40326,5 4,8.07312 4,11.5 C4,13.5136 5.14136,15.3721 7.0416,16.5964 C7.78041,17.0724 7.98058,17.9987 8.0143,18.8184 C8.76669,18.5086 9.27173,17.6587 10.1858,17.8316 C10.7677,17.9416 11.3749,18 12,18 C16.5967,18 20,14.9269 20,11.5 C20,8.07312 16.5967,5 12,5 Z M2,11.5 C2,6.64261 6.65561,3 12,3 C17.3444,3 22,6.64261 22,11.5 C22,16.3574 17.3444,20 12,20 C11.3472,20 10.708,19.9469 10.0886,19.8452 C9.99597,19.918 9.83571,20.0501 9.63851,20.1891 C9.0713,20.5887 8.24917,21 7,21 C6.44772,21 6,20.5523 6,20 C6,19.4499 6.14332,18.7663 5.90624,18.2438 C3.57701,16.7225 2,14.2978 2,11.5 Z" fill="currentColor"/>
          </svg>
        </button>
        {/* Fork button */}
        <div
          className="agent-node-fork-button-wrapper"
          onClick={(e) => {
            // Prevent triggering drag when clicking
            e.stopPropagation();
            if (!nodeId) return;
            // Dispatch custom event for fork on click
            const forkEvent = new CustomEvent('agent-node:fork-click', {
              detail: { nodeId },
              bubbles: true,
            });
            e.currentTarget.dispatchEvent(forkEvent);
          }}
          onMouseDown={(e) => {
            // Allow drag to still work - only prevent if it's a pure click (no drag)
            // We'll track if mouse moves
            if (!nodeId) return;
            let hasMoved = false;
            const startX = e.clientX;
            const startY = e.clientY;
            const handleMouseMove = (moveEvent: MouseEvent) => {
              const deltaX = Math.abs(moveEvent.clientX - startX);
              const deltaY = Math.abs(moveEvent.clientY - startY);
              if (deltaX > 5 || deltaY > 5) {
                hasMoved = true;
              }
            };
            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
              // If mouse didn't move, it was a click, not a drag
              if (!hasMoved) {
                e.stopPropagation();
                const forkEvent = new CustomEvent('agent-node:fork-click', {
                  detail: { nodeId },
                  bubbles: true,
                });
                e.currentTarget.dispatchEvent(forkEvent);
              }
            };
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        >
          <Handle 
            type="source" 
            position={Position.Bottom}
          className="agent-node-bottom-handle"
        />
        </div>
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

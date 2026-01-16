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
          <svg width="16" height="16" viewBox="0 0 197 138" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M65.2344 135.742H188.77C193.164 135.742 196.777 132.324 196.777 127.93C196.777 123.438 193.164 120.02 188.77 120.02H65.2344C60.7422 120.02 57.3242 123.438 57.3242 127.93C57.3242 132.324 60.7422 135.742 65.2344 135.742Z" fill="currentColor" fillOpacity="0.85"/>
            <path d="M9.66797 137.598H26.3672C31.7383 137.598 36.1328 133.203 36.1328 127.93C36.1328 122.461 31.7383 118.164 26.3672 118.164H9.66797C4.29688 118.164 0 122.461 0 127.93C0 133.203 4.29688 137.598 9.66797 137.598Z" fill="currentColor" fillOpacity="0.85"/>
            <path d="M65.2344 76.7578H188.77C193.164 76.7578 196.777 73.2422 196.777 68.8477C196.777 64.4531 193.164 61.0352 188.77 61.0352H65.2344C60.7422 61.0352 57.3242 64.4531 57.3242 68.8477C57.3242 73.2422 60.7422 76.7578 65.2344 76.7578Z" fill="currentColor" fillOpacity="0.85"/>
            <path d="M9.66797 78.6133H26.3672C31.7383 78.6133 36.1328 74.2188 36.1328 68.8477C36.1328 63.4766 31.7383 59.1797 26.3672 59.1797H9.66797C4.29688 59.1797 0 63.4766 0 68.8477C0 74.2188 4.29688 78.6133 9.66797 78.6133Z" fill="currentColor" fillOpacity="0.85"/>
            <path d="M65.2344 17.6758H188.77C193.164 17.6758 196.777 14.2578 196.777 9.86329C196.777 5.3711 193.164 1.95312 188.77 1.95312H65.2344C60.7422 1.95312 57.3242 5.3711 57.3242 9.86329C57.3242 14.2578 60.7422 17.6758 65.2344 17.6758Z" fill="currentColor" fillOpacity="0.85"/>
            <path d="M9.66797 19.5312H26.3672C31.7383 19.5312 36.1328 15.1367 36.1328 9.86328C36.1328 4.39453 31.7383 0.0976562 26.3672 0.0976562H9.66797C4.29688 0.0976562 0 4.39453 0 9.86328C0 15.1367 4.29688 19.5312 9.66797 19.5312Z" fill="currentColor" fillOpacity="0.85"/>
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
          <svg width="16" height="16" viewBox="0 0 231 180" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10.4094 38.7404L94.9201 87.5327C97.9261 89.2682 102 88.5 105 84.5C107.197 80.6942 105.787 75.652 102.781 73.9165L18.2707 25.1243C15.1976 23.35 11.1504 24.96 8.95312 28.7658C6.75587 32.5716 7.33633 36.9662 10.4094 38.7404Z" fill="currentColor"/>
            <path d="M10.4094 121.955L94.9201 73.1626C97.9261 71.4271 104 73.5 105 76.5C107.197 80.3058 105.787 85.0433 102.781 86.7788L18.2707 135.571C15.1976 137.345 11.1504 135.735 8.95312 131.929C6.75587 128.124 7.33633 123.729 10.4094 121.955Z" fill="currentColor"/>
            <path d="M118.249 134H215.833C219.304 134 222.158 137.516 222.158 141.91C222.158 146.305 219.304 149.723 215.833 149.723H118.249C114.7 149.723 112 146.305 112 141.91C112 137.516 114.7 134 118.249 134Z" fill="currentColor"/>
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
          <svg width="16" height="16" viewBox="0 0 228 205" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#clip0_996_260)">
              <path d="M113.574 190.137C179.199 190.137 227.148 150.098 227.148 95.0195C227.148 39.7461 179.102 0 113.574 0C47.9492 0 0 39.7461 0 95.0195C0 113.281 5.37109 130.273 14.7461 144.043C19.3359 150.879 20.9961 155.664 20.9961 159.668C20.9961 164.844 19.4336 169.043 14.9414 172.949C7.22656 179.492 11.2305 190.137 21.3867 190.137C33.5938 190.137 47.168 185.938 57.2266 179.004C73.7305 186.23 92.9688 190.137 113.574 190.137ZM113.574 174.414C94.9219 174.414 78.2227 170.898 64.0625 164.551C57.8125 161.816 53.3203 162.598 47.3633 166.113C43.1641 168.75 38.2812 170.996 33.3008 172.07C35.3516 168.652 36.7188 164.746 36.7188 159.668C36.7188 152.441 34.082 144.531 27.832 135.156C20.0195 123.828 15.7227 110.059 15.7227 95.0195C15.7227 49.2188 56.1523 15.7227 113.574 15.7227C170.996 15.7227 211.426 49.2188 211.426 95.0195C211.426 140.82 170.996 174.414 113.574 174.414Z" fill="currentColor" fillOpacity="0.85"/>
            </g>
            <defs>
              <clipPath id="clip0_996_260">
                <rect width="227.148" height="204.59" fill="white"/>
              </clipPath>
            </defs>
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

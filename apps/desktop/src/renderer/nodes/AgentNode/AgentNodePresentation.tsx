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
  isWorkspaceMetadataAttachment,
  createLinearIssueAttachment,
  createWorkspaceMetadataAttachment,
  TerminalAttachment,
} from '../../types/attachments';
import type { AgentNodeData, AgentNodeView } from '../../types/agent-node';
import {
  useAgentService,
  useWorkspaceService,
  useNodeInitialized,
} from '../../context';
import type { WorkspaceState, SessionReadiness } from '../../hooks/useAgentState';
import { getConversationFilePath } from '../../utils/getConversationFilePath';
import '../../AgentNode.css';

export interface AgentNodePresentationProps {
  /** Agent node data */
  data: AgentNodeData;
  /** Callback when node data changes */
  onDataChange: (data: Partial<AgentNodeData>) => void;
  /** Whether the node is selected */
  selected?: boolean;
  /** Workspace state from useAgentState (optional for backwards compat) */
  workspaceState?: WorkspaceState;
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
  workspaceState,
  sessionReadiness = 'idle',
  nodeId,
}: AgentNodePresentationProps) {
  const agent = useAgentService();
  const workspace = useWorkspaceService();
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
        let newAttachment: TerminalAttachment | null = null;

        if (attachmentType === 'linear-issue' || droppedData.identifier) {
          newAttachment = createLinearIssueAttachment(droppedData);
        } else if (attachmentType === 'workspace-metadata' || droppedData.path) {
          newAttachment = createWorkspaceMetadataAttachment(droppedData);

          // Update workspace service with the dropped path
          if (droppedData.path) {
            workspace.setWorkspacePath(droppedData.path);
          }
        }

        if (newAttachment) {
          const currentAttachments = data.attachments || [];
          const isDuplicate = currentAttachments.some(
            (a) => a.type === newAttachment!.type && a.id === newAttachment!.id
          );

          if (!isDuplicate) {
            onDataChange({
              attachments: [...currentAttachments, newAttachment],
            });
          }
        }
      } catch (error) {
        console.error('[AgentNode] Error parsing dropped data', error);
      }
    },
    [data.attachments, onDataChange, workspace]
  );

  const attachments = data.attachments || [];

  // Get workspace info from props (passed from useAgentState in parent)
  const workspacePath = workspaceState?.path ?? null;
  const workspaceSource = workspaceState?.source ?? null;
  const gitInfo = workspaceState?.gitInfo ?? null;

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

  // Get workspace attachment for folder name
  const workspaceAttachment = attachments.find(isWorkspaceMetadataAttachment);
  const folderName = workspaceAttachment
    ? workspaceAttachment.name || workspaceAttachment.path.split('/').pop() || 'Workspace'
    : workspacePath
    ? workspacePath.split('/').pop() || 'Workspace'
    : null;
  const branch = gitInfo?.branch || workspaceAttachment?.git?.branch;

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
            target.closest('.agent-node-fork-button-wrapper')
          ) {
            return;
          }
          handleNodeClick();
        }}
      >
        {/* Debug: Big red true/false indicator */}
        <div className="agent-node-forking-debug">
          {forking ? 'TRUE' : 'FALSE'}
        </div>
        <NodeResizer
          minWidth={450}
          minHeight={350}
          isVisible={true}
          lineStyle={{ borderColor: 'transparent' }}
          handleStyle={{ width: 8, height: 8, borderRadius: '50%' }}
        />

      {/* Tab Bar */}
      <div className="agent-node-tabs">
        <button
          className={`agent-tab ${activeView === 'overview' ? 'active' : ''}`}
          onClick={() => handleViewChange('overview')}
        >
          Overview
        </button>
        <button
          className={`agent-tab ${activeView === 'terminal' ? 'active' : ''}`}
          onClick={() => handleViewChange('terminal')}
        >
          Terminal
        </button>
        <button
          className={`agent-tab ${activeView === 'chat' ? 'active' : ''}`}
          onClick={() => handleViewChange('chat')}
        >
          Chat
        </button>
      </div>

      {/* Attachments */}
      {attachments.map((attachment, index) => (
        <AttachmentHeader
          key={`${attachment.type}-${attachment.id}-${index}`}
          attachment={attachment}
          onDetailsClick={
            isLinearIssueAttachment(attachment)
              ? () => handleAttachmentClick(attachment)
              : undefined
          }
          isInherited={isWorkspaceMetadataAttachment(attachment) && workspaceSource === 'inherited'}
          gitInfo={isWorkspaceMetadataAttachment(attachment) ? gitInfo : undefined}
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

      {/* Bottom connection button - styled like conversation node plus button */}
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

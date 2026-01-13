/**
 * AgentNodePresentation
 *
 * Presentation component for AgentNode that uses context hooks for services.
 * Handles UI rendering, status display, and user interactions.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import AgentOverviewView from '../../AgentOverviewView';
import AgentTerminalView from '../../AgentTerminalView';
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
import { useWorkspaceDisplay } from '../../hooks';
import '../../AgentNode.css';

export interface AgentNodePresentationProps {
  /** Agent node data */
  data: AgentNodeData;
  /** Callback when node data changes */
  onDataChange: (data: Partial<AgentNodeData>) => void;
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
}: AgentNodePresentationProps) {
  const agent = useAgentService();
  const workspace = useWorkspaceService();
  const isInitialized = useNodeInitialized();

  const [activeView, setActiveView] = useState<AgentNodeView>(
    data.activeView || 'overview'
  );
  const [isDragOver, setIsDragOver] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  // Auto-start CLI when initialized (if enabled)
  useEffect(() => {
    if (isInitialized && agent.isAutoStartEnabled()) {
      agent.start().catch((err) => {
        console.error('[AgentNode] Failed to auto-start agent:', err);
      });
    }

    return () => {
      // Stop agent on unmount
      agent.stop().catch((err) => {
        console.error('[AgentNode] Failed to stop agent:', err);
      });
    };
  }, [isInitialized, agent]);

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

  // Use workspace display hook for live git info and inheritance detection
  const { workspacePath, source: workspaceSource, gitInfo } = useWorkspaceDisplay(
    data.agentId,
    attachments
  );

  return (
    <div
      className={`agent-node ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <NodeResizer
        minWidth={450}
        minHeight={350}
        isVisible={true}
        lineStyle={{ borderColor: 'transparent' }}
        handleStyle={{ width: 8, height: 8, borderRadius: '50%' }}
      />
      <Handle type="target" position={Position.Top} />

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

      {/* Content Area */}
      <div className="agent-node-content">
        {activeView === 'overview' ? (
          <AgentOverviewView
            agentId={data.agentId}
            title={data.title}
            summary={data.summary}
            status={data.status}
            statusInfo={data.statusInfo}
            progress={data.progress}
            workspacePath={workspacePath ?? undefined}
            onTitleChange={handleTitleChange}
          />
        ) : (
          <AgentTerminalView terminalId={data.terminalId} />
        )}
      </div>

      <Handle type="source" position={Position.Bottom} />

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
  );
}

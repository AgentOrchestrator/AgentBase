import React, { useState, useCallback, useEffect } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import './AgentNode.css';
import AgentOverviewView from './AgentOverviewView';
import AgentTerminalView from './AgentTerminalView';
import AttachmentHeader from './AttachmentHeader';
import IssueDetailsModal from './IssueDetailsModal';
import {
  isLinearIssueAttachment,
  isWorkspaceMetadataAttachment,
  createLinearIssueAttachment,
  createWorkspaceMetadataAttachment,
  TerminalAttachment,
} from './types/attachments';
import type { AgentNodeData, AgentNodeView } from './types/agent-node';
import { agentStore } from './stores';

/**
 * Agent Node
 *
 * Wrapper component that contains both AgentOverviewView and AgentTerminalView
 * with tab switching capability. Uses React Flow NodeProps pattern.
 */
function AgentNode({ data, id }: NodeProps) {
  const nodeData = data as unknown as AgentNodeData;
  const [activeView, setActiveView] = useState<AgentNodeView>(
    nodeData.activeView || 'overview'
  );
  const [isDragOver, setIsDragOver] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  // Subscribe to store updates for this agent
  const [agentData, setAgentData] = useState<AgentNodeData>(nodeData);

  useEffect(() => {
    // Try to get data from store first
    const storeData = agentStore.getAgent(nodeData.agentId);
    if (storeData) {
      setAgentData(storeData);
    }

    // Subscribe to updates
    const unsubscribe = agentStore.subscribe(nodeData.agentId, (updatedAgent) => {
      setAgentData(updatedAgent);
    });

    return unsubscribe;
  }, [nodeData.agentId]);

  // Handle view change
  const handleViewChange = useCallback(
    (view: AgentNodeView) => {
      setActiveView(view);
      // Notify canvas of view change
      window.dispatchEvent(
        new CustomEvent('update-node', {
          detail: { nodeId: id, data: { ...agentData, activeView: view } },
        })
      );
    },
    [id, agentData]
  );

  // Handle title change
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      const updatedData = {
        ...agentData,
        title: { value: newTitle, isManuallySet: true },
      };
      window.dispatchEvent(
        new CustomEvent('update-node', {
          detail: { nodeId: id, data: updatedData },
        })
      );
    },
    [id, agentData]
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
        }

        if (newAttachment) {
          const currentAttachments = agentData.attachments || [];
          const isDuplicate = currentAttachments.some(
            (a) => a.type === newAttachment!.type && a.id === newAttachment!.id
          );

          if (!isDuplicate) {
            const updatedData = {
              ...agentData,
              attachments: [...currentAttachments, newAttachment],
            };
            window.dispatchEvent(
              new CustomEvent('update-node', {
                detail: { nodeId: id, data: updatedData },
              })
            );
          }
        }
      } catch (error) {
        console.error('[AgentNode] Error parsing dropped data', error);
      }
    },
    [id, agentData]
  );

  const attachments = agentData.attachments || [];

  // Extract workspace path from attachments
  const workspacePath = attachments
    .filter(isWorkspaceMetadataAttachment)
    .map((a) => a.path)[0];

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
        />
      ))}

      {/* Content Area */}
      <div className="agent-node-content">
        {activeView === 'overview' ? (
          <AgentOverviewView
            agentId={agentData.agentId}
            title={agentData.title}
            summary={agentData.summary}
            status={agentData.status}
            statusInfo={agentData.statusInfo}
            progress={agentData.progress}
            workspacePath={workspacePath}
            onTitleChange={handleTitleChange}
          />
        ) : (
          <AgentTerminalView terminalId={agentData.terminalId} />
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

export default AgentNode;

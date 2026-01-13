/**
 * AgentNode (Container)
 *
 * Container component that sets up NodeContext for the agent node.
 * Wraps AgentNodePresentation with the appropriate context provider.
 */

import { useCallback, useEffect, useState } from 'react';
import { NodeProps } from '@xyflow/react';
import type { AgentNodeData } from '../../types/agent-node';
import { NodeContextProvider } from '../../context';
import { agentStore } from '../../stores';
import { AgentNodePresentation } from './AgentNodePresentation';
import { useWorkspaceInheritance } from '../../hooks';
import { WorkspaceSelectionModal } from '../../components/WorkspaceSelectionModal';
import { createWorkspaceMetadataAttachment } from '../../types/attachments';

/**
 * AgentNode
 *
 * Container component that:
 * 1. Sets up NodeContextProvider with agent-specific services
 * 2. Subscribes to the agent store for data updates
 * 3. Dispatches data changes to the canvas
 */
function AgentNode({ data, id }: NodeProps) {
  const nodeData = data as unknown as AgentNodeData;

  // Subscribe to store updates for this agent
  const [agentData, setAgentData] = useState<AgentNodeData>(nodeData);

  // Workspace selection modal state
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);

  // Get inherited workspace from parent nodes
  const { inheritedWorkspacePath } = useWorkspaceInheritance(id);

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

  // Handle data changes from presentation component
  const handleDataChange = useCallback(
    (updates: Partial<AgentNodeData>) => {
      const updatedData = { ...agentData, ...updates };

      // Update local state
      setAgentData(updatedData);

      // Notify canvas of changes
      window.dispatchEvent(
        new CustomEvent('update-node', {
          detail: { nodeId: id, data: updatedData },
        })
      );
    },
    [id, agentData]
  );

  // Extract workspace path from attachments
  const attachmentWorkspacePath = agentData.attachments
    ?.filter((a) => a.type === 'workspace-metadata')
    .map((a) => (a as { path: string }).path)[0];

  // Determine final workspace path (priority: attachment > selected > inherited)
  const workspacePath = attachmentWorkspacePath || selectedWorkspace || inheritedWorkspacePath;

  // Show modal if no workspace is available (auto-open on mount)
  useEffect(() => {
    if (!workspacePath && !showWorkspaceModal) {
      setShowWorkspaceModal(true);
    }
  }, [workspacePath, showWorkspaceModal]);

  // Handler for workspace selection
  const handleWorkspaceSelect = (path: string) => {
    setSelectedWorkspace(path);
    setShowWorkspaceModal(false);

    // Create workspace attachment and update node data
    const workspaceAttachment = createWorkspaceMetadataAttachment({
      path,
      name: path.split('/').pop() || 'Workspace',
    });

    const currentAttachments = agentData.attachments || [];
    const updatedData = {
      ...agentData,
      attachments: [...currentAttachments, workspaceAttachment],
    };

    setAgentData(updatedData);

    // Notify canvas of changes
    window.dispatchEvent(
      new CustomEvent('update-node', {
        detail: { nodeId: id, data: updatedData },
      })
    );
  };

  const handleWorkspaceCancel = () => {
    // Close modal - node will remain without workspace
    setShowWorkspaceModal(false);
  };

  // Always render the node structure - modal is overlaid when needed
  // Only auto-start CLI when workspace is available
  return (
    <NodeContextProvider
      nodeId={id}
      nodeType="agent"
      terminalId={agentData.terminalId}
      agentId={agentData.agentId}
      agentType={agentData.agentType}
      workspacePath={workspacePath}
      autoStartCli={!!workspacePath}
    >
      <AgentNodePresentation
        data={agentData}
        onDataChange={handleDataChange}
      />
      {/* Modal overlay - rendered inside node to maintain React tree */}
      <WorkspaceSelectionModal
        isOpen={showWorkspaceModal && !workspacePath}
        onSelect={handleWorkspaceSelect}
        onCancel={handleWorkspaceCancel}
      />
    </NodeContextProvider>
  );
}

export default AgentNode;

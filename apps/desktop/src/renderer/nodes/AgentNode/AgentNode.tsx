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
import { useWorkspaceInheritance, useRecentWorkspaces } from '../../hooks';
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

  // Get recent workspaces for the modal
  const { workspaces: recentWorkspaces, trackWorkspace } = useRecentWorkspaces(10);

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

  // Helper to update state and notify canvas (single source of truth)
  const dispatchNodeUpdate = useCallback(
    (updatedData: AgentNodeData) => {
      setAgentData(updatedData);
      window.dispatchEvent(
        new CustomEvent('update-node', {
          detail: { nodeId: id, data: updatedData },
        })
      );
    },
    [id]
  );

  // Handle data changes from presentation component
  const handleDataChange = useCallback(
    (updates: Partial<AgentNodeData>) => {
      dispatchNodeUpdate({ ...agentData, ...updates });
    },
    [agentData, dispatchNodeUpdate]
  );

  // Extract workspace path from attachments (use find instead of filter/map)
  const workspaceAttachment = agentData.attachments?.find(
    (a) => a.type === 'workspace-metadata'
  ) as { path: string } | undefined;
  const attachmentWorkspacePath = workspaceAttachment?.path;

  // Determine final workspace path (priority: attachment > selected > inherited)
  const workspacePath = attachmentWorkspacePath || selectedWorkspace || inheritedWorkspacePath;

  // Show modal if no workspace is available (auto-open on mount)
  useEffect(() => {
    if (!workspacePath && !showWorkspaceModal) {
      setShowWorkspaceModal(true);
    }
  }, [workspacePath, showWorkspaceModal]);

  // Handler for browsing directories
  const handleBrowse = useCallback(async (): Promise<string | null> => {
    if (!window.shellAPI?.openDirectoryDialog) {
      console.error('[AgentNode] openDirectoryDialog not available');
      return null;
    }
    return window.shellAPI.openDirectoryDialog({
      title: 'Select Workspace Directory',
    });
  }, []);

  // Handler for workspace selection
  const handleWorkspaceSelect = useCallback(
    async (path: string) => {
      setSelectedWorkspace(path);
      setShowWorkspaceModal(false);

      const name = path.split('/').pop() || 'Workspace';

      // Track as recently opened (non-blocking)
      try {
        let gitInfo: { branch?: string; remote?: string } | undefined;
        if (window.gitAPI?.getInfo) {
          const info = await window.gitAPI.getInfo(path);
          if (info) {
            gitInfo = { branch: info.branch, remote: info.remote };
          }
        }
        await trackWorkspace(path, name, gitInfo);
      } catch (err) {
        console.debug('[AgentNode] Failed to track recent workspace:', err);
      }

      // Create workspace attachment and update node data
      const newAttachment = createWorkspaceMetadataAttachment({
        path,
        name,
      });

      dispatchNodeUpdate({
        ...agentData,
        attachments: [...(agentData.attachments || []), newAttachment],
      });
    },
    [agentData, dispatchNodeUpdate, trackWorkspace]
  );

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
        recentWorkspaces={recentWorkspaces}
        onSelect={handleWorkspaceSelect}
        onCancel={handleWorkspaceCancel}
        onBrowse={handleBrowse}
      />
    </NodeContextProvider>
  );
}

export default AgentNode;

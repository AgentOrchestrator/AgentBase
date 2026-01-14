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
import { useWorkspaceInheritance, useSessionIdMatcher } from '../../hooks';
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
function AgentNode({ data, id, selected }: NodeProps) {
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

  // Check for prefilled workspace path (from locked folder)
  const prefilledWorkspacePath = (nodeData as any).prefilledWorkspacePath as string | undefined;

  // Determine final workspace path (priority: attachment > selected > inherited)
  const workspacePath = attachmentWorkspacePath || selectedWorkspace || inheritedWorkspacePath;

  // Log workspace path changes
  useEffect(() => {
    console.log('[AgentNode] Workspace path updated', {
      agentId: agentData.agentId,
      workspacePath,
      attachmentWorkspacePath,
      selectedWorkspace,
      inheritedWorkspacePath,
      hasSessionId: !!agentData.sessionId,
      createdAt: agentData.createdAt ? new Date(agentData.createdAt).toISOString() : undefined,
    });
  }, [workspacePath, agentData.agentId, agentData.sessionId, agentData.createdAt, attachmentWorkspacePath, selectedWorkspace, inheritedWorkspacePath]);

  // Match session ID when workspace is available
  useSessionIdMatcher({
    createdAt: agentData.createdAt,
    workspacePath: workspacePath || undefined,
    agentId: agentData.agentId,
    enabled: !!workspacePath && !agentData.sessionId, // Only match if workspace is set and not already matched
    onSessionIdFound: useCallback(
      (sessionId: string) => {
        console.log('[AgentNode] Session ID found!', {
          agentId: agentData.agentId,
          sessionId,
          workspacePath,
        });
        dispatchNodeUpdate({ ...agentData, sessionId });
      },
      [agentData, dispatchNodeUpdate, workspacePath]
    ),
  });

  // Show modal if no workspace is available (auto-open on mount)
  // Also show if there's a prefilled path (so user can confirm/change it)
  useEffect(() => {
    // Show modal if there's no workspace path, or if there's a prefilled path to show
    if (!workspacePath && !showWorkspaceModal) {
      setShowWorkspaceModal(true);
    }
  }, [workspacePath, showWorkspaceModal]);

  // Handler for workspace selection
  const handleWorkspaceSelect = useCallback(
    (path: string) => {
      setSelectedWorkspace(path);
      setShowWorkspaceModal(false);

      // Create workspace attachment and update node data
      const newAttachment = createWorkspaceMetadataAttachment({
        path,
        name: path.split('/').pop() || 'Workspace',
      });

      dispatchNodeUpdate({
        ...agentData,
        attachments: [...(agentData.attachments || []), newAttachment],
      });
    },
    [agentData, dispatchNodeUpdate]
  );

  const handleWorkspaceCancel = () => {
    // Remove the agent node from the canvas
    window.dispatchEvent(
      new CustomEvent('delete-node', {
        detail: { nodeId: id },
      })
    );
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
        selected={selected}
      />
      {/* Modal overlay - rendered inside node to maintain React tree */}
      <WorkspaceSelectionModal
        isOpen={showWorkspaceModal && !workspacePath}
        onSelect={handleWorkspaceSelect}
        onCancel={handleWorkspaceCancel}
        initialPath={prefilledWorkspacePath || null}
      />
    </NodeContextProvider>
  );
}

export default AgentNode;
